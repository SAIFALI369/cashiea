import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import {
  Loader2, FileCode2, FileDown, Boxes, Info, CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  buildTallyXml, buildTallyMastersXml, buildTallyVouchersXml,
  type TallySale, type TallyReceipt, type TallyPayment, type TallyParty, type TallyStockItem,
} from '../lib/tally'

/**
 * TallyExport — one file, two clicks: export this period's invoices,
 * POS sales, payments and expenses as a Tally import XML (masters +
 * vouchers), then *Gateway of Tally → Import → Vouchers* inside Tally.
 *
 * Same honesty rule as the GST sheet: this is a bookkeeping import.
 * Take the first import on a trial company and reconcile after.
 */
type Period = 'this_month' | 'last_month' | 'quarter' | 'fy'

function periodRange(p: Period): { from: string; to: string; label: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  switch (p) {
    case 'this_month':
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)), label: 'this month' }
    case 'last_month':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)), label: 'last month' }
    case 'quarter': {
      const qStart = new Date(y, Math.floor(m / 3) * 3, 1)
      return { from: iso(qStart), to: iso(now), label: 'this quarter' }
    }
    case 'fy': {
      const fyStart = m >= 3 ? new Date(y, 3, 1) : new Date(y - 1, 3, 1)
      return { from: iso(fyStart), to: iso(now), label: 'this financial year' }
    }
  }
}

interface InvoiceRow {
  id: string
  invoice_number: string
  client_name: string
  client_gstin: string | null
  items: any[]
  subtotal: number
  discount?: number | null
  tax_rate?: number | null
  tax_amount: number
  total: number
  is_interstate?: boolean | null
  notes: string | null
  created_at: string
  status: string
}

interface TxnRow {
  id: string
  receipt_number: string
  customer_id: string | null
  items: any[]
  subtotal: number
  discount: number
  tax_amount: number
  total: number
  payment_method: string
  status: string
  created_at: string
}

interface ExpenseRow {
  id: string
  category: string
  description: string
  amount: number
  payment_method: string | null
  date: string
  type: string
}

function downloadXml(filename: string, xml: string) {
  const blob = new Blob([xml], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function TallyExport() {
  const { ownerId, profile } = useAuth()
  const { isOwner } = useCan()
  const [period, setPeriod] = useState<Period>('this_month')
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [txns, setTxns] = useState<TxnRow[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [includePos, setIncludePos] = useState(true)
  const [includeExpenses, setIncludeExpenses] = useState(true)

  const range = useMemo(() => periodRange(period), [period])

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    setLoading(true)
    const fromTs = `${range.from}T00:00:00`
    const toTs = `${range.to}T23:59:59`
    ;(async () => {
      // Invoices (non-draft) + completed POS sales + expenses for the
      // window, plus the customers/products catalogues for masters.
      const [inv, txn, exp, cust, prod] = await Promise.all([
        supabase.from('invoices')
          .select('id,invoice_number,client_name,client_gstin,items,subtotal,discount,tax_amount,total,is_interstate,notes,created_at,status')
          .eq('user_id', ownerId)
          .neq('status', 'draft')
          .gte('created_at', fromTs)
          .lte('created_at', toTs)
          .order('created_at', { ascending: true })
          .limit(2000),
        supabase.from('transactions')
          .select('id,receipt_number,customer_id,items,subtotal,discount,tax_amount,total,payment_method,status,created_at')
          .eq('user_id', ownerId)
          .eq('status', 'completed')
          .gte('created_at', fromTs)
          .lte('created_at', toTs)
          .order('created_at', { ascending: true })
          .limit(4000),
        supabase.from('expenses')
          .select('id,category,description,amount,payment_method,date,type')
          .eq('user_id', ownerId)
          .eq('type', 'expense')
          .gte('date', range.from)
          .lte('date', range.to)
          .order('date', { ascending: true })
          .limit(2000),
        supabase.from('customers')
          .select('id,name,phone,email,company,address,gstin')
          .eq('user_id', ownerId)
          .limit(1000),
        supabase.from('products')
          .select('id,name,hsn_code,gst_rate,units')
          .eq('user_id', ownerId)
          .eq('active', true)
          .limit(2000),
      ])
      if (cancelled) return
      setInvoices((inv.data as InvoiceRow[]) || [])
      setTxns((txn.data as TxnRow[]) || [])
      setExpenses((exp.data as ExpenseRow[]) || [])
      setCustomers(cust.data || [])
      setProducts(prod.data || [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId, range.from, range.to])

  // ── Map Cashiea rows → Tally models ─────────────────────────────
  const partyNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of txns) if (t.customer_id) map.set(t.customer_id, 'txn')
    for (const c of customers) if (!map.has(c.id)) map.set(c.id, c.name)
    return map
  }, [txns, customers])

  const { tallySales, tallyReceipts, tallyPayments, tallyParties, tallyStockItems, warnings } = useMemo(() => {
    const sales: TallySale[] = []
    const receipts: TallyReceipt[] = []
    const payments: TallyPayment[] = []
    const warns: string[] = []
    const seenInvoiceNumbers = new Set<string>()

    for (const inv of invoices) {
      if (seenInvoiceNumbers.has(inv.invoice_number)) {
        warns.push(`Invoice ${inv.invoice_number} appears more than once — only the first was exported`)
        continue
      }
      seenInvoiceNumbers.add(inv.invoice_number)
      const items = Array.isArray(inv.items) ? inv.items : []
      const lineDiscountTotal = items.reduce((s, it) => s + (Number(it.line_discount) || 0), 0)
      sales.push({
        number: inv.invoice_number,
        date: inv.created_at,
        party: inv.client_name || 'Cash',
        partyGstin: inv.client_gstin,
        items: items.map((it) => ({
          name: it.name || it.description || 'Item',
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unit_price) || 0,
          gstRate: Number(it.gst_rate ?? inv.tax_rate ?? 0) || 0,
          hsn: it.hsn_code || null,
          lineDiscount: Number(it.line_discount) || 0,
        })),
        // Invoices store subtotal AFTER a flat discount; the voucher
        // recomputes from lines, so pass the pre-discount taxable value.
        subtotal: Number(inv.subtotal) + lineDiscountTotal,
        taxAmount: Number(inv.tax_amount) || 0,
        total: Number(inv.total) || 0,
        interstate: !!inv.is_interstate,
        notes: inv.notes,
      })
    }

    if (includePos) {
      for (const t of txns) {
        const items = Array.isArray(t.items) ? t.items : []
        const party = t.customer_id ? (partyNames.get(t.customer_id) || 'Customer') : 'Cash'
        sales.push({
          number: `POS-${t.receipt_number}`,
          date: t.created_at,
          party,
          items: items.map((it: any) => ({
            name: it.name || 'Item',
            quantity: Number(it.quantity) || 0,
            unitPrice: Number(it.unit_price) || 0,
            gstRate: Number(it.gst_rate) || 0,
            hsn: it.hsn_code || null,
            unit: it.unit || null,
            lineDiscount: Number(it.line_discount) || 0,
          })),
          subtotal: Number(t.subtotal) || 0,
          taxAmount: Number(t.tax_amount) || 0,
          total: Number(t.total) || 0,
          notes: 'Counter sale',
        })
        // A fully-paid counter sale is also money in — a receipt voucher
        // keeps Tally's cash/bank matching the till.
        receipts.push({
          number: `RCP-${t.receipt_number}`,
          date: t.created_at,
          party: party === 'Cash' ? 'Cash' : party,
          amount: Number(t.total) || 0,
          method: t.payment_method === 'split' ? 'upi' : t.payment_method,
          against: `POS-${t.receipt_number}`,
        })
      }
    }

    if (includeExpenses) {
      expenses.forEach((e, i) => {
        payments.push({
          number: `EXP-${e.date}-${String(i + 1).padStart(3, '0')}`,
          date: `${e.date}T12:00:00`,
          party: e.category ? e.category.charAt(0).toUpperCase() + e.category.slice(1) : 'Expenses',
          amount: Number(e.amount) || 0,
          narration: `${e.description} (${e.payment_method || 'cash'})`,
        })
      })
    }

    const parties: TallyParty[] = customers.map((c) => ({
      name: c.name,
      gstin: c.gstin || null,
      phone: c.phone || null,
      address: c.address || null,
      email: c.email || null,
      kind: 'customer' as const,
    }))

    const stockItems: TallyStockItem[] = products.map((p) => {
      const units = Array.isArray(p.units) ? p.units : []
      return {
        name: p.name,
        hsn: p.hsn_code || null,
        gstRate: Number(p.gst_rate) || 0,
        unit: units.length ? String(units[0]?.unit || '') : null,
      }
    })

    return { tallySales: sales, tallyReceipts: receipts, tallyPayments: payments, tallyParties: parties, tallyStockItems: stockItems, warnings: warns }
  }, [invoices, txns, expenses, customers, products, includePos, includeExpenses, partyNames])

  const tallyInput = useMemo(() => ({
    company: profile?.company_name || undefined,
    sales: tallySales,
    receipts: tallyReceipts,
    payments: tallyPayments,
    parties: tallyParties,
    stockItems: tallyStockItems,
  }), [profile, tallySales, tallyReceipts, tallyPayments, tallyParties, tallyStockItems])

  const result = useMemo(() => buildTallyXml(tallyInput), [tallyInput])
  const nothing = tallySales.length === 0 && tallyReceipts.length === 0 && tallyPayments.length === 0

  const exportAll = () => {
    downloadXml(`cashiea-tally-${range.from}-to-${range.to}.xml`, result.xml)
    toast.success('Tally XML downloaded — import it from Gateway of Tally → Import → Vouchers')
  }
  const exportMasters = () => {
    downloadXml(`cashiea-tally-masters-${range.from}.xml`, buildTallyMastersXml(tallyInput))
    toast.success('Masters XML downloaded')
  }
  const exportVouchers = () => {
    downloadXml(`cashiea-tally-vouchers-${range.from}-to-${range.to}.xml`, buildTallyVouchersXml(tallyInput))
    toast.success('Vouchers XML downloaded')
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="tally-export-page animate-fade-in">
      <PageHeader
        icon={<FileCode2 className="w-5 h-5" />}
        title="Tally Export"
        subtitle="Your bills, payments and expenses as a Tally import file — masters and vouchers in one XML."
        action={
          !nothing && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={exportVouchers} className="btn-secondary text-xs">Vouchers only</button>
              <button onClick={exportMasters} className="btn-secondary text-xs">Masters only</button>
            </div>
          )
        }
      />

      {/* Period switch + sources */}
      <div className="flex items-center justify-between gap-2 mb-5 flex-wrap">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {([['this_month', 'This month'], ['last_month', 'Last month'], ['quarter', 'This quarter'], ['fy', 'This FY']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setPeriod(k)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${period === k ? 'bg-[#F3F4F6] text-[#111827]' : 'bg-transparent text-fg-subtle hover:text-fg'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 text-xs text-fg-muted">
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-fg-muted">
            <span className={`relative h-6 w-11 rounded-full p-1 transition-colors ${includePos ? 'bg-accent' : 'bg-line-2'}`}><span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${includePos ? 'translate-x-5' : ''}`} /></span>
            <input type="checkbox" checked={includePos} onChange={(e) => setIncludePos(e.target.checked)} className="sr-only" /> POS sales
          </label>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-fg-muted">
            <span className={`relative h-6 w-11 rounded-full p-1 transition-colors ${includeExpenses ? 'bg-accent' : 'bg-line-2'}`}><span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${includeExpenses ? 'translate-x-5' : ''}`} /></span>
            <input type="checkbox" checked={includeExpenses} onChange={(e) => setIncludeExpenses(e.target.checked)} className="sr-only" /> Expenses
          </label>
        </div>
      </div>

      {nothing ? (
        <EmptyState icon={FileCode2} title={`Nothing to export ${range.label}`} description="Create bills, make sales or record expenses — the Tally file builds itself from your real data." />
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Sales vouchers', value: String(result.stats.salesVouchers), sub: formatINR(result.stats.salesTotal, 0) },
              { label: 'Receipt vouchers', value: String(result.stats.receiptVouchers), sub: formatINR(result.stats.receiptsTotal, 0) },
              { label: 'Payment vouchers', value: String(result.stats.paymentVouchers), sub: formatINR(result.stats.paymentsTotal, 0) },
              { label: 'Masters created', value: String(result.stats.ledgers + result.stats.stockItems), sub: `${result.stats.ledgers} ledgers · ${result.stats.stockItems} stock items` },
            ].map((s) => (
              <div key={s.label} className="card p-5">
                <p className="mb-1 text-xs font-semibold text-fg-subtle">{s.label}</p>
                <p className="text-3xl font-extrabold text-[#111827]">{s.value}</p>
                <p className="mt-1 text-sm font-bold text-emerald-600">{s.sub}</p>
              </div>
            ))}
          </div>

          {warnings.length > 0 && (
            <div className="card p-4 mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-warning" />
                <h2 className="text-sm font-bold text-fg">{warnings.length} export note{warnings.length === 1 ? '' : 's'}</h2>
              </div>
              <ul className="space-y-1 text-xs text-fg-muted">
                {warnings.slice(0, 5).map((w, i) => <li key={i}>• {w}</li>)}
              </ul>
            </div>
          )}

          {/* How to import */}
          <section className="card mb-6 p-5">
            <div className="mb-4 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-accent" /><h2 className="text-base font-bold text-fg">How to import</h2></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ['1', 'Open your company in TallyPrime.', '↗'],
                ['2', 'Gateway of Tally → Import → Vouchers.', ''],
                ['3', 'Party ledgers and stock items auto-create.', ''],
                ['4', 'Check Day Book and reconcile.', ''],
              ].map(([number, text, mark]) => <div key={number} className="flex items-start gap-3 rounded-2xl bg-surface-2 p-4"><span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-white">{number}</span><p className="text-sm font-semibold leading-5 text-fg">{text} {mark && <span className="text-accent">{mark}</span>}</p></div>)}
            </div>
            <details className="mt-4 text-xs text-fg-subtle"><summary className="cursor-pointer font-semibold text-fg-muted">Read full guide</summary><p className="mt-2 leading-5">This is a bookkeeping import, not a GSTN filing. Take the first import on a trial company, verify the import report, then reconcile Day Book against Cashiea totals before repeating on live books. Masters include party ledgers, stock items and tax ledgers; vouchers include sales, receipts and payments.</p></details>
          </section>

          {/* Voucher preview */}
          <div className="card overflow-hidden mb-5">
            <div className="p-4 pb-2 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-fg-muted" />
              <h2 className="text-sm font-bold text-fg">Voucher preview (first {Math.min(tallySales.length, 3)} of {result.stats.salesVouchers + result.stats.receiptVouchers + result.stats.paymentVouchers})</h2>
            </div>
            <div className="overflow-x-auto scroll-area">
              <table className="w-full text-xs">
                <thead className="bg-surface-2">
                  <tr>
                    {['Type', 'Number', 'Date', 'Party', 'Taxable', 'Tax', 'Amount'].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-semibold text-fg-muted whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tallySales.slice(0, 3).map((s) => {
                    const taxable = s.items.reduce((sum, it) => sum + (it.quantity * it.unitPrice - (it.lineDiscount || 0)), 0)
                    return (
                      <tr key={s.number} className="border-t border-line">
                        <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded bg-positive/15 text-positive text-[10px] font-bold">SALE</span></td>
                        <td className="px-3 py-2 text-fg font-semibold whitespace-nowrap">{s.number}</td>
                        <td className="px-3 py-2 text-fg-muted whitespace-nowrap">{new Date(s.date).toLocaleDateString('en-IN')}</td>
                        <td className="px-3 py-2 text-fg-muted max-w-40 truncate">{s.party}</td>
                        <td className="px-3 py-2 text-fg-muted tabular-nums">{formatINR(taxable)}</td>
                        <td className="px-3 py-2 text-fg-muted tabular-nums">{s.taxAmount ? formatINR(s.taxAmount) : '—'}</td>
                        <td className="px-3 py-2 text-fg font-semibold tabular-nums">{formatINR(s.total)}</td>
                      </tr>
                    )
                  })}
                  {tallyReceipts.slice(0, 3).map((r) => (
                    <tr key={`r-${r.number}`} className="border-t border-line">
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded bg-info/15 text-info text-[10px] font-bold">RECEIPT</span></td>
                      <td className="px-3 py-2 text-fg font-semibold whitespace-nowrap">{r.number}</td>
                      <td className="px-3 py-2 text-fg-muted whitespace-nowrap">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                      <td className="px-3 py-2 text-fg-muted max-w-40 truncate">{r.party}</td>
                      <td className="px-3 py-2 text-fg-muted">—</td>
                      <td className="px-3 py-2 text-fg-muted">—</td>
                      <td className="px-3 py-2 text-fg font-semibold tabular-nums">{formatINR(r.amount)}</td>
                    </tr>
                  ))}
                  {tallyPayments.slice(0, 3).map((p) => (
                    <tr key={`p-${p.number}`} className="border-t border-line">
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning text-[10px] font-bold">PAYMENT</span></td>
                      <td className="px-3 py-2 text-fg font-semibold whitespace-nowrap">{p.number}</td>
                      <td className="px-3 py-2 text-fg-muted whitespace-nowrap">{new Date(p.date).toLocaleDateString('en-IN')}</td>
                      <td className="px-3 py-2 text-fg-muted max-w-40 truncate">{p.party}</td>
                      <td className="px-3 py-2 text-fg-muted">—</td>
                      <td className="px-3 py-2 text-fg-muted">—</td>
                      <td className="px-3 py-2 text-fg font-semibold tabular-nums">{formatINR(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Raw XML preview */}
          <div className="card overflow-hidden">
            <div className="p-4 pb-2"><h2 className="text-sm font-bold text-fg">XML preview (first vouchers)</h2></div>
            <pre className="px-4 pb-4 text-[10px] leading-relaxed text-fg-muted overflow-x-auto scroll-area max-h-72 whitespace-pre">{result.xml.split('\n').slice(0, 60).join('\n')}</pre>
          </div>
        </>
      )}

      <button onClick={exportAll} disabled={!isOwner} className="btn-primary mb-6 flex w-full items-center justify-center gap-2 rounded-full py-4 text-base font-bold disabled:opacity-50">📥 Download Tally XML</button>

      {!isOwner && (
        <p className="text-[11px] text-fg-subtle mt-4">Exports are read-only for your role — ask the owner if you need import rights in Tally.</p>
      )}
    </div>
  )
}
