import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import EmptyState from '../components/ui/EmptyState'
import { Loader2, FileSignature, FileDown, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportToCSV } from '../lib/export'
import { downloadXlsx } from '../lib/xlsx'

/**
 * GstExport — GSTR-1-style working sheet built from your REAL invoice
 * data (tax_rate / tax_amount / client_gstin / hsn_summary — the
 * columns that actually exist). Rate-wise summary, B2B/B2C split and
 * HSN summary, exportable to CSV or Excel for your CA.
 *
 * Informational export only — GSTR-1 must be filed on the GST portal.
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
      // Indian FY starts 1 April
      const fyStart = m >= 3 ? new Date(y, 3, 1) : new Date(y - 1, 3, 1)
      return { from: iso(fyStart), to: iso(now), label: 'this financial year' }
    }
  }
}

export default function GstExport() {
  const { ownerId } = useAuth()
  const [period, setPeriod] = useState<Period>('this_month')
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])

  const range = useMemo(() => periodRange(period), [period])

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('invoices')
      .select('id,invoice_number,client_name,client_gstin,items,subtotal,tax_rate,tax_amount,total,is_interstate,place_of_supply,hsn_summary,status,created_at')
      .eq('user_id', ownerId)
      .neq('status', 'draft')
      .gte('created_at', range.from)
      .lte('created_at', `${range.to}T23:59:59`)
      .order('created_at', { ascending: true })
      .limit(1000)
      .then(({ data }) => {
        if (cancelled) return
        setInvoices((data as any[]) || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [ownerId, range.from, range.to])

  // Rate-wise summary (GSTR-1 style: rate, taxable value, CGST, SGST, IGST)
  const rateSummary = useMemo(() => {
    const byRate = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number; count: number }>()
    for (const inv of invoices) {
      const rate = Number(inv.tax_rate) || 0
      const taxable = Number(inv.subtotal) || 0
      const tax = Number(inv.tax_amount) || 0
      const cur = byRate.get(rate) || { taxable: 0, cgst: 0, sgst: 0, igst: 0, count: 0 }
      cur.taxable += taxable
      if (inv.is_interstate) cur.igst += tax
      else { cur.cgst += tax / 2; cur.sgst += tax / 2 }
      cur.count++
      byRate.set(rate, cur)
    }
    return Array.from(byRate.entries()).sort((a, b) => a[0] - b[0])
  }, [invoices])

  const b2b = invoices.filter((i) => !!i.client_gstin)
  const b2c = invoices.filter((i) => !i.client_gstin)
  const totalTax = invoices.reduce((s, i) => s + (Number(i.tax_amount) || 0), 0)
  const totalTaxable = invoices.reduce((s, i) => s + (Number(i.subtotal) || 0), 0)

  const flatRows = () => [
    ['Invoice No.', 'Date', 'Customer', 'GSTIN', 'Type', 'Place of supply', 'Taxable value', 'Rate %', 'CGST', 'SGST', 'IGST', 'Total', 'Status'],
    ...invoices.map((i) => [
      i.invoice_number,
      new Date(i.created_at).toLocaleDateString('en-IN'),
      i.client_name || '',
      i.client_gstin || '',
      i.client_gstin ? 'B2B' : 'B2C',
      i.place_of_supply || '',
      Number(i.subtotal) || 0,
      Number(i.tax_rate) || 0,
      i.is_interstate ? 0 : Math.round((Number(i.tax_amount) / 2) * 100) / 100,
      i.is_interstate ? 0 : Math.round((Number(i.tax_amount) / 2) * 100) / 100,
      i.is_interstate ? Number(i.tax_amount) || 0 : 0,
      Number(i.total) || 0,
      i.status,
    ]),
  ]

  const exportCsv = () => {
    exportToCSV(`gstr1-sheet-${range.from}-to-${range.to}`, flatRows() as unknown as Record<string, unknown>[])
    toast.success('CSV downloaded')
  }
  const exportExcel = () => {
    downloadXlsx(`gstr1-sheet-${range.from}-to-${range.to}`, [
      { name: 'Rate summary', rows: [['Rate %', 'Invoices', 'Taxable value', 'CGST', 'SGST', 'IGST'], ...rateSummary.map(([rate, v]) => [rate, v.count, Math.round(v.taxable * 100) / 100, Math.round(v.cgst * 100) / 100, Math.round(v.sgst * 100) / 100, Math.round(v.igst * 100) / 100])] },
      { name: 'Invoices', rows: flatRows() },
    ])
    toast.success('Excel downloaded')
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="animate-fade-in">
      {/* Period switch + exports */}
      <div className="flex items-center justify-between gap-2 mb-5 flex-wrap">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {([['this_month', 'This month'], ['last_month', 'Last month'], ['quarter', 'This quarter'], ['fy', 'This FY']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setPeriod(k)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${period === k ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:text-fg'}`}>
              {label}
            </button>
          ))}
        </div>
        {invoices.length > 0 && (
          <div className="flex gap-2">
            <button onClick={exportExcel} className="btn-secondary text-xs"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</button>
            <button onClick={exportCsv} className="btn-secondary text-xs"><FileDown className="w-3.5 h-3.5" /> CSV</button>
          </div>
        )}
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={FileSignature} title={`No invoices ${range.label}`} description="Create invoices from the Bills page — this sheet builds itself from your real invoice data." />
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Invoices', value: String(invoices.length) },
              { label: 'B2B / B2C', value: `${b2b.length} / ${b2c.length}` },
              { label: 'Taxable value', value: formatINR(totalTaxable, 0) },
              { label: 'GST collected', value: formatINR(totalTax, 0) },
            ].map((s) => (
              <div key={s.label} className="card p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-fg-subtle mb-1">{s.label}</p>
                <p className="text-xl font-bold text-fg">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Rate-wise summary */}
          <div className="card overflow-hidden mb-5">
            <div className="p-4 pb-2"><h2 className="text-sm font-bold text-fg">Rate-wise summary (GSTR-1 style)</h2></div>
            <div className="overflow-x-auto scroll-area">
              <table className="w-full text-xs">
                <thead className="bg-surface-2">
                  <tr>
                    {['Rate %', 'Invoices', 'Taxable value', 'CGST', 'SGST', 'IGST'].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-semibold text-fg-muted whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rateSummary.map(([rate, v]) => (
                    <tr key={rate} className="border-t border-line">
                      <td className="px-3 py-2 text-fg font-semibold">{rate}%</td>
                      <td className="px-3 py-2 text-fg-muted">{v.count}</td>
                      <td className="px-3 py-2 text-fg tabular-nums">{formatINR(v.taxable)}</td>
                      <td className="px-3 py-2 text-fg-muted tabular-nums">{v.cgst ? formatINR(v.cgst) : '—'}</td>
                      <td className="px-3 py-2 text-fg-muted tabular-nums">{v.sgst ? formatINR(v.sgst) : '—'}</td>
                      <td className="px-3 py-2 text-fg-muted tabular-nums">{v.igst ? formatINR(v.igst) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoice list */}
          <div className="card overflow-hidden">
            <div className="p-4 pb-2"><h2 className="text-sm font-bold text-fg">Invoices ({invoices.length})</h2></div>
            <div className="overflow-x-auto scroll-area max-h-[420px]">
              <table className="w-full text-xs">
                <thead className="bg-surface-2 sticky top-0">
                  <tr>
                    {['Invoice', 'Date', 'Customer', 'Type', 'Rate', 'Tax', 'Total'].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-semibold text-fg-muted whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id} className="border-t border-line">
                      <td className="px-3 py-2 text-fg font-semibold whitespace-nowrap">{i.invoice_number}</td>
                      <td className="px-3 py-2 text-fg-muted whitespace-nowrap">{new Date(i.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="px-3 py-2 text-fg-muted max-w-40 truncate">{i.client_name}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${i.client_gstin ? 'bg-info/15 text-info' : 'bg-surface-2 text-fg-subtle'}`}>{i.client_gstin ? 'B2B' : 'B2C'}</span>
                      </td>
                      <td className="px-3 py-2 text-fg-muted">{Number(i.tax_rate) || 0}%</td>
                      <td className="px-3 py-2 text-fg-muted tabular-nums">{formatINR(Number(i.tax_amount) || 0)}</td>
                      <td className="px-3 py-2 text-fg font-semibold tabular-nums">{formatINR(Number(i.total) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-fg-subtle mt-4">
            A working sheet for your records and your CA — the official GSTR-1 return is filed on the GST portal (due the 11th of next month).
          </p>
        </>
      )}
    </div>
  )
}
