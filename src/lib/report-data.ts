// ════════════════════════════════════════════════════════════════
// Auto business-data snapshot — feeds Meraj reports from the real
// Cashiea data (transactions, expenses, invoices, stock, customers)
// so the owner never pastes raw numbers by hand. Also produces the
// row tables used by the Excel export.
// ════════════════════════════════════════════════════════════════

import { supabase } from './supabase'
import { round2 } from './pos'

export interface BusinessDataSnapshot {
  from: string
  to: string
  /** Compact human-readable summary — this is what the AI receives. */
  summaryText: string
  /** Source tables for the Excel export. */
  salesRows: (string | number)[][]
  expenseRows: (string | number)[][]
  /** True when at least some data was available. */
  hasData: boolean
}

const rs = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export async function gatherBusinessData(ownerId: string, days = 30): Promise<BusinessDataSnapshot> {
  const to = new Date()
  const from = new Date(to.getTime() - days * 86_400_000)
  const fromIso = from.toISOString()
  const empty = {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    summaryText: '',
    salesRows: [] as (string | number)[][],
    expenseRows: [] as (string | number)[][],
    hasData: false,
  }
  if (!ownerId) return empty

  const [txRes, expRes, invRes, prodRes, custRes] = await Promise.all([
    supabase.from('transactions').select('receipt_number,items,subtotal,tax_amount,discount,total,payment_method,status,created_at')
      .eq('user_id', ownerId).gte('created_at', fromIso).order('created_at', { ascending: false }).limit(500),
    supabase.from('expenses').select('category,description,amount,type,date').eq('user_id', ownerId)
      .gte('date', from.toISOString().slice(0, 10)).order('date', { ascending: false }).limit(500),
    supabase.from('invoices').select('invoice_number,client_name,total,status,due_date').eq('user_id', ownerId)
      .neq('status', 'draft').order('created_at', { ascending: false }).limit(200),
    supabase.from('products').select('id,name,category,price,cost,stock_quantity,low_stock_threshold').eq('user_id', ownerId).limit(1000),
    supabase.from('customers').select('id,name,created_at,total_spent,total_orders').eq('user_id', ownerId).limit(2000),
  ])

  const txns = (txRes.data as any[]) || []
  const expenses = (expRes.data as any[]) || []
  const invoices = (invRes.data as any[]) || []
  const products = (prodRes.data as any[]) || []
  const customers = (custRes.data as any[]) || []

  // ── Sales aggregates ──
  const completed = txns.filter((t) => t.status === 'completed')
  const revenue = round2(completed.reduce((s, t) => s + Number(t.total || 0), 0))
  const discountTotal = round2(completed.reduce((s, t) => s + Number(t.discount || 0), 0))
  const taxTotal = round2(completed.reduce((s, t) => s + Number(t.tax_amount || 0), 0))
  const avgSale = completed.length ? round2(revenue / completed.length) : 0

  // Top products by line frequency
  const prodCount = new Map<string, { name: string; units: number; revenue: number }>()
  for (const t of completed) {
    for (const it of t.items || []) {
      if (!it?.product_id && !it?.name) continue
      const key = it.product_id || it.name
      const cur = prodCount.get(key) || { name: it.name || key, units: 0, revenue: 0 }
      cur.units += Number(it.quantity) || 0
      cur.revenue += (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)
      prodCount.set(key, cur)
    }
  }
  const topProducts = Array.from(prodCount.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  // Payment mix
  const byMethod = new Map<string, number>()
  for (const t of completed) {
    const m = t.payment_method || 'other'
    byMethod.set(m, (byMethod.get(m) || 0) + Number(t.total || 0))
  }

  // ── Expenses ──
  const expTotal = round2(expenses.filter((e) => e.type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0))
  const incomeTotal = round2(expenses.filter((e) => e.type === 'income').reduce((s, e) => s + Number(e.amount || 0), 0))
  const expByCategory = new Map<string, number>()
  for (const e of expenses) {
    if (e.type !== 'expense') continue
    expByCategory.set(e.category || 'other', (expByCategory.get(e.category || 'other') || 0) + Number(e.amount || 0))
  }
  const topExpenses = Array.from(expByCategory.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // ── Receivables ──
  const unpaid = invoices.filter((i) => ['sent', 'viewed', 'partial', 'overdue'].includes(i.status))
  const unpaidTotal = round2(unpaid.reduce((s, i) => s + Number(i.total || 0), 0))
  const overdue = unpaid.filter((i) => i.status === 'overdue' || (i.due_date && new Date(i.due_date) < to))

  // ── Stock ──
  const lowStock = products.filter((p) => Number(p.stock_quantity) <= Number(p.low_stock_threshold))
  const stockValue = round2(products.reduce((s, p) => s + Number(p.cost || 0) * Number(p.stock_quantity || 0), 0))

  // ── Customers ──
  const newCustomers = customers.filter((c) => c.created_at && new Date(c.created_at) >= from).length

  const hasData = txns.length > 0 || expenses.length > 0 || invoices.length > 0 || products.length > 0
  if (!hasData) {
    return { ...empty, hasData: false, summaryText: 'No business data recorded yet in this period.' }
  }

  // ── Summary text for the AI prompt ──
  const lines: string[] = [
    `Business data from Cashiea for the last ${days} days (${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}):`,
    '',
    `SALES: ${completed.length} completed sales, revenue ${rs(revenue)}, average sale ${rs(avgSale)}.`,
    `Taxes collected: ${rs(taxTotal)}. Discounts given: ${rs(discountTotal)}.`,
    `Payment mix: ${Array.from(byMethod.entries()).map(([m, v]) => `${m} ${rs(v)}`).join(', ') || 'no sales'}.`,
  ]
  if (topProducts.length) {
    lines.push(`TOP PRODUCTS: ${topProducts.map((p) => `${p.name} (${p.units} units, ${rs(p.revenue)})`).join('; ')}.`)
  }
  if (expenses.length) {
    lines.push(`EXPENSES: total ${rs(expTotal)}${incomeTotal ? `, other income ${rs(incomeTotal)}` : ''}.`)
    if (topExpenses.length) lines.push(`Top expense categories: ${topExpenses.map(([c, v]) => `${c} ${rs(v)}`).join(', ')}.`)
    lines.push(`Net profit (sales − expenses): ${rs(revenue - expTotal)}.`)
  }
  if (invoices.length) {
    lines.push(`RECEIVABLES: ${unpaid.length} unpaid invoices worth ${rs(unpaidTotal)}${overdue.length ? `, ${overdue.length} overdue` : ''}.`)
  }
  if (products.length) {
    lines.push(`STOCK: ${products.length} products, inventory value ${rs(stockValue)}, ${lowStock.length} low or out of stock${lowStock.length ? ` (${lowStock.slice(0, 5).map((p) => p.name).join(', ')})` : ''}.`)
  }
  if (customers.length) {
    lines.push(`CUSTOMERS: ${customers.length} total, ${newCustomers} new in this period.`)
  }

  // ── Excel tables ──
  const salesRows: (string | number)[][] = [
    ['Date', 'Receipt', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment', 'Status'],
    ...completed.map((t) => [
      new Date(t.created_at).toLocaleDateString('en-IN'),
      t.receipt_number || '',
      (t.items || []).reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0),
      Number(t.subtotal) || 0,
      Number(t.discount) || 0,
      Number(t.tax_amount) || 0,
      Number(t.total) || 0,
      t.payment_method || '',
      t.status || '',
    ]),
  ]
  const expenseRows: (string | number)[][] = [
    ['Date', 'Type', 'Category', 'Description', 'Amount'],
    ...expenses.map((e) => [
      String(e.date || '').slice(0, 10),
      e.type || 'expense',
      e.category || '',
      e.description || '',
      Number(e.amount) || 0,
    ]),
  ]

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    summaryText: lines.join('\n'),
    salesRows,
    expenseRows,
    hasData: true,
  }
}
