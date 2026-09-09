import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Undo2, X, Zap, ChevronDown, ChevronUp, ReceiptText } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useAutomationCards, relTime, undoAutomationEvent, type AutomationEvent } from '../lib/automation'

/**
 * AutomationCards — "Action taken by Cashiea" notification cards.
 *
 * When the automation engine acts on its own, a card pops up (real-time)
 * with a receipt and — where possible — a one-tap UNDO.
 * Aesthetic: dark text on cream, deep drop shadow (the Command Center look).
 */

const SEVERITY: Record<string, { dot: string; label: string }> = {
  success: { dot: 'bg-emerald-600', label: 'Done' },
  info: { dot: 'bg-sky-600', label: 'FYI' },
  warning: { dot: 'bg-amber-600', label: 'Attention' },
  critical: { dot: 'bg-red-600', label: 'Urgent' },
}

function Card({ e, onClose }: { e: AutomationEvent; onClose: () => void }) {
  const [open, setOpen] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [undone, setUndone] = useState(false)
  const sev = SEVERITY[e.severity] || SEVERITY.info

  // Auto-dismiss: 12s (non-critical), sticky when critical or undoable-not-yet-acted
  useEffect(() => {
    if (e.severity === 'critical') return
    const t = setTimeout(onClose, 12000)
    return () => clearTimeout(t)
  }, [e.severity, onClose])

  const undo = async () => {
    setUndoing(true)
    const r = await undoAutomationEvent(e.id)
    setUndoing(false)
    if (r.ok) { setUndone(true); toast.success('Undone — order cancelled') }
    else toast.error(r.error || 'Could not undo')
  }

  const receiptRows = Object.entries(e.receipt || {}).filter(([, v]) => typeof v !== 'object' || v === null)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="pointer-events-auto w-full max-w-sm rounded-2xl border border-[#E7DCC8] bg-[#FBF7EF] text-[#221B12]
                 shadow-[0_18px_44px_-12px_rgba(34,27,18,0.4),0_2px_6px_rgba(34,27,18,0.12)]"
      role="status"
    >
      <div className="flex items-start gap-3 px-4 pt-3.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#221B12] text-[#FBF7EF]">
          <Zap className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A7A5E]">Action taken by Cashiea</p>
          <p className="mt-0.5 text-sm font-semibold leading-snug">{e.title}</p>
        </div>
        <button onClick={onClose} aria-label="Dismiss" className="rounded-md p-1 text-[#8A7A5E] hover:bg-[#EFE7D7]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {e.body && <p className="px-4 pt-1.5 text-[13px] leading-relaxed text-[#4A3F2D]">{e.body}</p>}

      <div className="mt-2.5 flex items-center gap-2 px-4 text-[11px] font-medium text-[#8A7A5E]">
        <span className={clsx('h-1.5 w-1.5 rounded-full', sev.dot)} />
        {sev.label} · {relTime(e.created_at)}
        {e.money_impact > 0 && <span className="ml-auto tabular-nums font-bold text-[#221B12]">₹{Math.round(e.money_impact).toLocaleString('en-IN')}</span>}
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-[#E7DCC8] px-3 py-2.5">
        {e.undo_kind && !undone && (
          <button
            onClick={undo}
            disabled={undoing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#221B12] px-3 py-1.5 text-[12px] font-semibold text-[#FBF7EF] transition hover:bg-[#3A3020] disabled:opacity-60"
          >
            <Undo2 className="h-3.5 w-3.5" />
            {undoing ? 'Undoing…' : 'Undo'}
          </button>
        )}
        {undone && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-[12px] font-semibold text-emerald-800">
            <Check className="h-3.5 w-3.5" /> Undone
          </span>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[#4A3F2D] hover:bg-[#EFE7D7]"
        >
          <ReceiptText className="h-3.5 w-3.5" /> Receipt
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <Link to="/app/command-center" className="ml-auto text-[12px] font-semibold text-[#8A6D3B] underline-offset-2 hover:underline">
          All actions
        </Link>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-[#E7DCC8] bg-[#F5EEDF]"
          >
            <div className="space-y-1 px-4 py-3 text-[12px] text-[#4A3F2D]">
              {receiptRows.length === 0 && <p className="italic">No extra detail.</p>}
              {receiptRows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="capitalize text-[#8A7A5E]">{k.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="text-right font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function AutomationCards() {
  const { ownerId } = useAuth()
  const { cards, dismiss } = useAutomationCards(ownerId)
  if (!ownerId) return null
  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:top-16 sm:items-end">
      <AnimatePresence>
        {cards.map((e) => <Card key={e.id} e={e} onClose={() => dismiss(e.id)} />)}
      </AnimatePresence>
    </div>
  )
}
