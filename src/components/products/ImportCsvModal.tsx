import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import {
  parseCsv, autoMapHeaders, validateProductRows, buildProductCsvTemplate,
  PRODUCT_CSV_FIELDS, type ProductMapping, type ImportProductRow,
} from '../../lib/csv'
import { supabase } from '../../lib/supabase'
import { formatINR } from '../../lib/format'
import type { Product } from '../../lib/types'
import toast from 'react-hot-toast'

/**
 * ImportCsvModal — bulk product import:
 *   1. upload a CSV (or download the template)
 *   2. column mapping (auto-detected, editable)
 *   3. validation preview — invalid rows and duplicate SKUs are
 *      flagged BEFORE anything is written
 *   4. import the valid rows, skip the rest, report the result
 */
export function ImportCsvModal({
  open, ownerId, products, onImported, onClose,
}: {
  open: boolean
  ownerId: string
  products: Product[]
  onImported: () => void
  onClose: () => void
}) {
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [mapping, setMapping] = useState<ProductMapping>({})
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const existingSkus = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => { if (p.sku) set.add(p.sku.toLowerCase()) })
    return set
  }, [products])

  const existingCategories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category || 'general'))),
    [products],
  )

  const validated: ImportProductRow[] = useMemo(() => {
    if (!rows.length) return []
    return validateProductRows(rows, mapping, headers, existingSkus, existingCategories)
  }, [rows, mapping, headers, existingSkus, existingCategories])

  const validRows = validated.filter((r) => !r.errors.length)
  const invalidRows = validated.filter((r) => r.errors.length)
  const warnRows = validated.filter((r) => !r.errors.length && r.warnings.length)

  if (!open) return null

  const reset = () => {
    setFileName(''); setHeaders([]); setRows([]); setParseErrors([]); setMapping({}); setDone(null)
  }

  const downloadTemplate = () => {
    const blob = new Blob([buildProductCsvTemplate()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cashiea-products-template.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5_000)
    toast.success('Template downloaded')
  }

  const onFile = async (file: File) => {
    setDone(null)
    const text = await file.text()
    const parsed = parseCsv(text)
    setFileName(file.name)
    setHeaders(parsed.headers)
    setRows(parsed.rows)
    setParseErrors(parsed.errors)
    setMapping(autoMapHeaders(parsed.headers))
    if (!parsed.headers.length) toast.error('Could not find a header row in this file')
  }

  const setField = (field: string, column: string) => {
    setMapping((m) => {
      const next: ProductMapping = { ...m }
      // One column can only serve one field.
      for (const k of Object.keys(next) as (keyof ProductMapping)[]) {
        if (next[k] === column) next[k] = null
      }
      ;(next as Record<string, string | null>)[field] = column || null
      return next
    })
  }

  const doImport = async () => {
    if (!validRows.length) return
    if (!navigator.onLine) {
      toast.error('Connect to the internet to import')
      return
    }
    setImporting(true)
    try {
      const payload = validRows
        .filter((r) => !r.warnings.length) // existing-SKU rows are skipped
        .map((r) => ({ ...r.product!, user_id: ownerId, active: true }))
      let imported = 0
      // Batches of 50 — one insert statement per batch.
      for (let i = 0; i < payload.length; i += 50) {
        const batch = payload.slice(i, i + 50)
        const { error } = await supabase.from('products').insert(batch)
        if (error) throw error
        imported += batch.length
      }
      const skipped = validated.length - imported
      setDone({ imported, skipped })
      toast.success(`Imported ${imported} product${imported !== 1 ? 's' : ''}`)
      onImported()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="dialog" aria-label="Import products from CSV">
      <div
        className="card w-full sm:max-w-2xl rounded-b-none sm:rounded-card max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-line flex-shrink-0">
          <h3 className="font-bold text-fg flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-accent" /> Import products</h3>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-area p-4 space-y-4">
          {/* 1 — Upload */}
          <section>
            <p className="label">1 · CSV file</p>
            {!rows.length ? (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-8 rounded-xl border-2 border-dashed border-line-2 hover:border-accent text-center transition-colors"
                >
                  <Upload className="w-7 h-7 mx-auto text-fg-subtle mb-2" />
                  <span className="text-sm font-semibold text-fg block">Choose a CSV file</span>
                  <span className="text-xs text-fg-subtle">We auto-detect the columns — then you can adjust them</span>
                </button>
                <button onClick={downloadTemplate} className="mt-2 text-xs font-semibold text-accent hover:underline flex items-center gap-1.5 mx-auto">
                  <Download className="w-3.5 h-3.5" /> Download the CSV template
                </button>
              </>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-surface-2 border border-line px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg truncate">{fileName}</p>
                  <p className="text-xs text-fg-subtle">{rows.length} data rows · {headers.length} columns</p>
                </div>
                <button onClick={reset} className="text-xs font-semibold text-negative hover:underline">Choose another</button>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f) }} />
          </section>

          {parseErrors.length > 0 && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-fg">
              {parseErrors.map((err, i) => <p key={i} className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" /> {err}</p>)}
            </div>
          )}

          {/* 2 — Mapping */}
          {rows.length > 0 && (
            <section>
              <p className="label">2 · Map columns</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {PRODUCT_CSV_FIELDS.map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <span className={`text-xs font-semibold flex-shrink-0 w-32 ${f.required ? 'text-fg' : 'text-fg-muted'}`}>
                      {f.label}{f.required ? ' *' : ''}
                    </span>
                    <select
                      value={mapping[f.key] || ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="input-field py-2 text-xs flex-1"
                      aria-label={`CSV column for ${f.label}`}
                    >
                      <option value="">— not imported —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3 — Validation preview */}
          {validated.length > 0 && (
            <section>
              <p className="label">3 · Check before importing</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-xl bg-positive/10 border border-positive/30 p-2.5 text-center">
                  <p className="text-lg font-bold text-positive">{validRows.length}</p>
                  <p className="text-[11px] text-fg-muted">Ready to import</p>
                </div>
                <div className="rounded-xl bg-negative/10 border border-negative/30 p-2.5 text-center">
                  <p className="text-lg font-bold text-negative">{invalidRows.length}</p>
                  <p className="text-[11px] text-fg-muted">Invalid rows</p>
                </div>
                <div className="rounded-xl bg-warning/10 border border-warning/30 p-2.5 text-center">
                  <p className="text-lg font-bold text-warning">{warnRows.length}</p>
                  <p className="text-[11px] text-fg-muted">Duplicate SKUs</p>
                </div>
              </div>

              <div className="rounded-xl border border-line overflow-hidden">
                <div className="max-h-56 overflow-y-auto scroll-area">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-2 sticky top-0">
                      <tr>
                        <th className="text-left px-2.5 py-2 font-semibold text-fg-muted">Row</th>
                        <th className="text-left px-2.5 py-2 font-semibold text-fg-muted">Product</th>
                        <th className="text-right px-2.5 py-2 font-semibold text-fg-muted">Price</th>
                        <th className="text-left px-2.5 py-2 font-semibold text-fg-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validated.slice(0, 100).map((r) => (
                        <tr key={r.index} className={`border-t border-line ${r.errors.length ? 'bg-negative/5' : ''}`}>
                          <td className="px-2.5 py-2 text-fg-subtle tabular-nums">{r.index}</td>
                          <td className="px-2.5 py-2 text-fg max-w-40 truncate">{r.raw[mapping.name || ''] || '—'}</td>
                          <td className="px-2.5 py-2 text-right text-fg-muted tabular-nums">{r.raw[mapping.price || ''] ? formatINR(Number(r.raw[mapping.price || ''])) : '—'}</td>
                          <td className="px-2.5 py-2">
                            {r.errors.length ? (
                              <span className="text-negative" title={r.errors.join(' · ')}>{r.errors[0]}</span>
                            ) : r.warnings.length ? (
                              <span className="text-warning" title={r.warnings.join(' · ')}>Skipped — {r.warnings[0]}</span>
                            ) : (
                              <span className="text-positive flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {validated.length > 100 && (
                  <p className="text-[11px] text-fg-subtle px-2.5 py-2 border-t border-line bg-surface">
                    Showing the first 100 of {validated.length} rows — all rows are validated and imported.
                  </p>
                )}
              </div>
            </section>
          )}

          {done && (
            <div className="rounded-xl bg-positive/10 border border-positive/30 p-3 text-sm text-fg">
              <p className="font-semibold">Import complete</p>
              <p className="text-xs text-fg-muted mt-0.5">
                {done.imported} product{done.imported !== 1 ? 's' : ''} added · {done.skipped} row{done.skipped !== 1 ? 's' : ''} skipped (invalid or duplicate SKU)
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {rows.length > 0 && (
          <div className="border-t border-line p-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <p className="text-xs text-fg-subtle hidden sm:block">Invalid rows and existing SKUs are never imported.</p>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={onClose} className="btn-ghost flex-1 sm:flex-none py-3">{done ? 'Done' : 'Cancel'}</button>
              {!done && (
                <button onClick={doImport} disabled={importing || validRows.length === 0} className="btn-primary flex-1 sm:flex-none py-3 disabled:opacity-50 flex items-center justify-center gap-2">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Import {validRows.length} product{validRows.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
