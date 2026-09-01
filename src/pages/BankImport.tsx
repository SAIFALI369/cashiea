import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import { parseCsv, autoMapHeaders } from '../lib/csv'
import EmptyState from '../components/ui/EmptyState'
import { Loader2, Landmark, Upload, CheckCircle2, X, FileSpreadsheet, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * BankImport — bring a bank statement in, match it to unpaid invoices.
 *
 * Uses the app's RFC-4180 CSV engine (handles quoted commas, Indian
 * bank statement headers, separate debit/credit columns) instead of a
 * naive split(','). Matching: exact amount (±₹1) against unpaid
 * invoices; confirm before anything is saved. Imported rows go to
 * bank_transactions (owner-only RLS) and matched invoices can be
 * marked paid on your confirmation.
 */
interface ParsedTxn {
  row: number
  date: string
  description: string
  amount: number
}

interface Match {
  txn: ParsedTxn
  invoiceId: string | null
  invoiceNumber: string | null
  clientName: string | null
  exact: boolean
}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ['date', 'txn date', 'transaction date', 'value date', 'posting date'],
  description: ['description', 'narration', 'particulars', 'remarks', 'details', 'transaction remarks'],
  amount: ['amount', 'credit', 'deposit', 'credit amount', 'deposits', 'withdrawal amt', 'credit(+)'],
  debit: ['debit', 'withdrawal', 'debit amount', 'debits', 'debit(-)', 'withdrawal amount'],
}

function mapBankColumns(headers: string[]): { date?: string; description?: string; amount?: string; debit?: string } {
  const clean = headers.map((h) => h.trim().toLowerCase())
  // Claim a column for a role: exact header match first, then partial —
  // never reusing a column already claimed by another role (so
  // "Withdrawal Amount" can't masquerade as the credit/amount column).
  const find = (aliases: string[], excludeIdx = -1): string | undefined => {
    for (const a of aliases) {
      const exact = clean.findIndex((h, i) => i !== excludeIdx && h === a)
      if (exact !== -1) return headers[exact]
    }
    for (const a of aliases) {
      const partial = clean.findIndex((h, i) => i !== excludeIdx && h.includes(a))
      if (partial !== -1) return headers[partial]
    }
    return undefined
  }
  const debit = find(HEADER_ALIASES.debit)
  const debitIdx = debit ? headers.indexOf(debit) : -1
  const amount = find(HEADER_ALIASES.amount, debitIdx)
  return {
    date: find(HEADER_ALIASES.date),
    description: find(HEADER_ALIASES.description),
    amount,
    debit,
  }
}

function parseAmount(raw: string): number {
  if (!raw) return NaN
  // Indian formats: "1,23,456.78", "Rs 1,234", "(1,234)" = negative, trailing "Cr"/"Dr"
  let s = raw.replace(/[₹Rs,\s]/gi, '').replace(/(cr|dr)\.?$/i, '')
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  const n = Number(s)
  return negative ? -n : n
}

function parseBankDate(raw: string): string {
  const s = (raw || '').trim()
  if (!s) return ''
  // dd/mm/yyyy and dd-mm-yyyy (Indian default)
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (dmy) {
    const d = dmy[1].padStart(2, '0'), m = dmy[2].padStart(2, '0')
    let y = dmy[3]; if (y.length === 2) y = `20${y}`
    return `${y}-${m}-${d}`
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return ''
}

export default function BankImport() {
  const { ownerId } = useAuth()
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedTxn[]>([])
  const [parseIssues, setParseIssues] = useState<string[]>([])
  const [unpaid, setUnpaid] = useState<any[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [matches, setMatches] = useState<Match[]>([])
  const [importing, setImporting] = useState(false)
  const [markPaid, setMarkPaid] = useState(true)
  const [done, setDone] = useState<{ imported: number; matchedCount: number; markedPaid: number } | null>(null)

  useEffect(() => {
    if (!ownerId) return
    supabase
      .from('invoices')
      .select('id,invoice_number,client_name,total,due_date,status')
      .eq('user_id', ownerId)
      .in('status', ['sent', 'viewed', 'partial', 'overdue'])
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => { setUnpaid((data as any[]) || []); setLoadingInvoices(false) })
  }, [ownerId])

  const onFile = async (file: File) => {
    setDone(null)
    const text = await file.text()
    const csv = parseCsv(text)
    if (!csv.headers.length) { toast.error('Could not read this CSV'); return }

    const cols = mapBankColumns(csv.headers)
    const issues: string[] = []
    if (!cols.date) issues.push('No date column found — expected "Date" / "Value Date"')
    if (!cols.amount && !cols.debit) issues.push('No amount column found — expected "Amount", "Credit" or "Debit"')

    const at = (row: string[], col?: string) => (col ? (row[csv.headers.indexOf(col)] ?? '').trim() : '')

    const txns: ParsedTxn[] = []
    csv.rows.forEach((row, i) => {
      const dateRaw = at(row, cols.date)
      const desc = at(row, cols.description) || 'Bank transaction'
      let amount = parseAmount(at(row, cols.amount))
      const debit = parseAmount(at(row, cols.debit))
      // Separate debit column (or negative amounts) → money out; skip those for matching
      if (!Number.isFinite(amount) || amount === 0) {
        if (Number.isFinite(debit) && debit !== 0) return // withdrawal row
        if (!Number.isFinite(amount)) { issues.push(`Row ${i + 2}: unreadable amount — skipped`); return }
      }
      if (amount <= 0) return // payments out
      const date = parseBankDate(dateRaw)
      if (!date) { issues.push(`Row ${i + 2}: unreadable date "${dateRaw}" — skipped`); return }
      txns.push({ row: i + 2, date, description: desc, amount: Math.abs(amount) })
    })

    setFileName(file.name)
    setParseIssues(issues.slice(0, 5))
    setParsed(txns)
    // Match: exact amount ±₹1 against unpaid invoices (each invoice once)
    const available = [...unpaid]
    setMatches(txns.map((t) => {
      const idx = available.findIndex((inv) => Math.abs(Number(inv.total) - t.amount) <= 1)
      if (idx !== -1) {
        const inv = available[idx]
        available.splice(idx, 1)
        return { txn: t, invoiceId: inv.id, invoiceNumber: inv.invoice_number, clientName: inv.client_name, exact: true }
      }
      return { txn: t, invoiceId: null, invoiceNumber: null, clientName: null, exact: false }
    }))
  }

  const matchedCount = matches.filter((m) => m.invoiceId).length
  const totalImported = matches.length

  const setMatch = (i: number, invoiceId: string | null) => {
    setMatches((prev) => prev.map((m, idx) => {
      if (idx !== i) return m
      const inv = unpaid.find((x) => x.id === invoiceId)
      return { ...m, invoiceId, invoiceNumber: inv?.invoice_number || null, clientName: inv?.client_name || null, exact: false }
    }))
  }

  const doImport = async () => {
    if (!matches.length || !ownerId) return
    setImporting(true)
    try {
      let imported = 0
      let markedPaid = 0
      for (const m of matches) {
        const { error } = await supabase.from('bank_transactions').insert({
          user_id: ownerId,
          invoice_id: m.invoiceId,
          transaction_date: m.txn.date,
          amount: m.txn.amount,
          description: m.txn.description,
          matched: !!m.invoiceId,
        })
        if (error) throw error
        imported++
        if (m.invoiceId && markPaid) {
          const { error: paidErr } = await supabase.from('invoices')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', m.invoiceId).eq('user_id', ownerId)
          if (!paidErr) markedPaid++
        }
      }
      setDone({ imported, matchedCount, markedPaid })
      toast.success(`Imported ${imported} transaction${imported !== 1 ? 's' : ''}`)
      setParsed([]); setMatches([]); setFileName('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  if (loadingInvoices) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="animate-fade-in">
      {/* Upload */}
      {!parsed.length ? (
        done ? (
          <div className="card p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-positive mx-auto mb-3" />
            <h2 className="text-lg font-bold text-fg">Import complete</h2>
            <p className="text-sm text-fg-muted mt-1">
              {done.imported} transactions saved · {done.matchedCount} matched to invoices{done.markedPaid ? ` · ${done.markedPaid} marked paid` : ''}
            </p>
            <button onClick={() => setDone(null)} className="btn-primary mt-4">Import another statement</button>
          </div>
        ) : (
          <>
            <label className="card p-8 border-2 border-dashed border-line-2 hover:border-accent flex flex-col items-center text-center cursor-pointer transition-colors">
              <Upload className="w-8 h-8 text-fg-subtle mb-3" />
              <span className="text-sm font-semibold text-fg">Upload a bank statement CSV</span>
              <span className="text-xs text-fg-subtle mt-1">We read Date / Narration / Amount (or separate Credit &amp; Debit columns) — Indian date and number formats supported</span>
              <input type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f) }} />
            </label>
            {unpaid.length === 0 ? (
              <p className="text-xs text-fg-subtle text-center mt-4">No unpaid invoices right now — you can still import the statement for record-keeping.</p>
            ) : (
              <p className="text-xs text-fg-subtle text-center mt-4">{unpaid.length} unpaid invoice{unpaid.length !== 1 ? 's' : ''} will be matched by amount (±₹1).</p>
            )}
          </>
        )
      ) : (
        <>
          {/* Preview + match */}
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg truncate">{fileName}</p>
              <p className="text-xs text-fg-subtle">{totalImported} credits parsed · {matchedCount} matched to unpaid invoices</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setParsed([]); setMatches([]) }} className="btn-ghost text-xs"><X className="w-3.5 h-3.5" /> Cancel</button>
              <button onClick={doImport} disabled={importing} className="btn-primary text-xs">
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Import {totalImported} rows{markPaid && matchedCount ? ` · mark ${matchedCount} paid` : ''}
              </button>
            </div>
          </div>

          {parseIssues.length > 0 && (
            <div className="card p-3 mb-4 bg-warning/10 border border-warning/30">
              {parseIssues.map((issue, i) => <p key={i} className="text-xs text-fg">{issue}</p>)}
            </div>
          )}

          <label className="flex items-center gap-2 mb-4 text-xs text-fg-muted">
            <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} className="w-4 h-4 accent-[rgb(var(--accent-strong))]" />
            Mark matched invoices as paid during import
          </label>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto scroll-area max-h-[480px]">
              <table className="w-full text-xs">
                <thead className="bg-surface-2 sticky top-0">
                  <tr>
                    {['Date', 'Description', 'Amount', 'Matched invoice'].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-semibold text-fg-muted whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m, i) => (
                    <tr key={m.txn.row} className="border-t border-line">
                      <td className="px-3 py-2 text-fg-muted whitespace-nowrap">{m.txn.date}</td>
                      <td className="px-3 py-2 text-fg-muted max-w-52 truncate">{m.txn.description}</td>
                      <td className="px-3 py-2 text-fg font-semibold tabular-nums whitespace-nowrap">{formatINR(m.txn.amount)}</td>
                      <td className="px-3 py-2">
                        <select
                          value={m.invoiceId || ''}
                          onChange={(e) => setMatch(i, e.target.value || null)}
                          className={`input-field py-1.5 text-xs min-w-44 ${m.invoiceId ? 'border-positive/40' : ''}`}
                          aria-label={`Match row ${m.txn.row}`}
                        >
                          <option value="">No match</option>
                          {unpaid.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.invoice_number} · {inv.client_name} · {formatINR(Number(inv.total))}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-fg-subtle mt-4 flex items-start gap-1.5 max-w-xl">
            <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Nothing is saved until you tap Import. Rows are stored under your account only, and matches are suggestions — correct any row before importing.
          </p>
        </>
      )}
    </div>
  )
}
