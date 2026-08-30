import { useEffect, useState } from 'react'
import { Delete, X } from 'lucide-react'

/**
 * NumpadModal — direct numeric entry for high-unit-count sales.
 * Opens on long-press of a cart line's quantity (or tap of the
 * quantity value). Big touch targets for counter use.
 */
export function NumpadModal({
  open, title, initialValue, allowDecimal = false, max, onDone, onClose,
}: {
  open: boolean
  title: string
  initialValue: number | string
  allowDecimal?: boolean
  max?: number
  onDone: (value: number) => void
  onClose: () => void
}) {
  const [entry, setEntry] = useState(String(initialValue ?? ''))

  useEffect(() => {
    if (open) setEntry(String(initialValue ?? ''))
  }, [open, initialValue])

  if (!open) return null

  const press = (d: string) => {
    setEntry((prev) => {
      let next = prev
      if (d === 'back') next = prev.slice(0, -1)
      else if (d === '.') {
        if (allowDecimal && !prev.includes('.')) next = prev === '' ? '0.' : prev + '.'
      } else next = prev + d
      // Keep entries sane: 5 integer digits, 2 decimals.
      const [int, dec] = next.split('.')
      let cleaned = int.slice(0, 5)
      if (dec !== undefined) cleaned += '.' + dec.slice(0, 2)
      return cleaned
    })
  }

  const submit = () => {
    const n = Number(entry)
    if (!Number.isFinite(n) || n < 0) return
    onDone(max !== undefined ? Math.min(n, max) : n)
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', allowDecimal ? '.' : '', '0', 'back']

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="dialog" aria-label={title}>
      <div
        className="card p-4 w-full sm:max-w-xs rounded-b-none sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-fg text-sm">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-right text-3xl font-extrabold text-fg bg-surface-2 rounded-xl px-4 py-3 mb-3 tabular-nums">
          {entry === '' ? <span className="text-fg-subtle">0</span> : entry}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {keys.map((k, i) =>
            k === '' ? <span key={i} /> : (
              <button
                key={i}
                onClick={() => press(k)}
                className="h-12 rounded-xl bg-surface-2 hover:bg-surface-3 text-fg text-lg font-bold active:scale-95 transition-transform"
                aria-label={k === 'back' ? 'Backspace' : k}
              >
                {k === 'back' ? <Delete className="w-5 h-5 mx-auto" /> : k}
              </button>
            ),
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <button onClick={() => setEntry('')} className="btn-ghost flex-1 py-3">Clear</button>
          <button onClick={submit} className="btn-primary flex-1 py-3">Set</button>
        </div>
      </div>
    </div>
  )
}
