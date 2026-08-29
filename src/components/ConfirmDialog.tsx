import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react'

/**
 * ConfirmDialog — modal confirmation for destructive actions.
 * Prevents accidental data loss from one mis-tap.
 *
 * Usage:
 *   const [confirmDelete, setConfirmDelete] = useState<Product | null>(null)
 *   <ConfirmDialog
 *     open={!!confirmDelete}
 *     title="Delete product?"
 *     message={`"${confirmDelete?.name}" will be permanently removed.`}
 *     confirmLabel="Delete"
 *     onConfirm={() => { doDelete(); setConfirmDelete(null) }}
 *     onClose={() => setConfirmDelete(null)}
 *   />
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[90]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[100] max-w-sm mx-auto"
          >
            <div className="card p-5 shadow-float">
              {/* Icon */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${danger ? 'bg-negative/10' : 'bg-warning/10'}`}>
                {danger ? <Trash2 className="w-6 h-6 text-negative" /> : <AlertTriangle className="w-6 h-6 text-warning" />}
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold text-fg text-center mb-1">{title}</h3>
              <p className="text-sm text-fg-muted text-center mb-6">{message}</p>

              {/* Actions */}
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-secondary flex-1 h-11 text-sm font-semibold">
                  {cancelLabel}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  className={`flex-1 h-11 text-sm font-semibold rounded-control transition-colors ${
                    danger
                      ? 'bg-negative text-white hover:bg-negative/90'
                      : 'bg-fg text-paper hover:opacity-90'
                  } disabled:opacity-50`}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
