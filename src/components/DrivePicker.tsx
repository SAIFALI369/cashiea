import { Check, FileText, FolderOpen, Loader2, X } from 'lucide-react'

export interface PickedFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
}

/**
 * Server-mediated Drive file selection. OAuth access tokens must never be
 * passed to browser JavaScript; integrations-api performs the Drive listing and
 * validates the selected IDs before persisting them.
 */
export default function DrivePicker({
  files,
  selectedIds,
  loading,
  saving,
  onRefresh,
  onChange,
  onSave,
  onClose,
}: {
  files: PickedFile[]
  selectedIds: string[]
  loading: boolean
  saving: boolean
  onRefresh: () => void
  onChange: (files: PickedFile[]) => void
  onSave: (files: PickedFile[]) => void
  onClose: () => void
}) {
  const selected = new Set(selectedIds)
  const toggle = (file: PickedFile) => {
    if (selected.has(file.id)) selected.delete(file.id)
    else if (selected.size < 20) selected.add(file.id)
    onChange(files.filter((candidate) => selected.has(candidate.id)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="drive-picker-title">
      <div className="w-full max-w-xl max-h-[85vh] overflow-hidden rounded-2xl p-5 bg-surface border border-line shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id="drive-picker-title" className="font-bold text-fg flex items-center gap-2"><FolderOpen className="w-5 h-5 text-accent" /> Select Drive files</h2>
            <p className="text-xs text-fg-muted mt-1">Cashiea lists basic metadata available to this Google account. Meraj reads content only for the up to 20 files you save.</p>
          </div>
          <button onClick={onClose} className="btn-ghost" aria-label="Close file selector"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-fg-muted">{selected.size} / 20 selected</span>
          <button onClick={onRefresh} disabled={loading || saving} className="btn-secondary text-xs">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Refresh list'}
          </button>
        </div>

        <div className="max-h-[48vh] overflow-y-auto space-y-1 pr-1">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-accent" /></div>
          ) : files.length === 0 ? (
            <div className="py-10 text-center text-sm text-fg-muted">No Drive files are accessible to this connected Google account yet. Refresh the list or reconnect the account.</div>
          ) : files.map((file) => {
            const isSelected = selected.has(file.id)
            return (
              <button key={file.id} onClick={() => toggle(file)} className={`w-full text-left flex items-center gap-3 rounded-xl p-3 border transition-colors ${isSelected ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`}>
                <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-accent border-accent text-accent-fg' : 'border-line'}`}>
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </span>
                <FileText className="w-4 h-4 text-accent flex-shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{file.name}</span>
                  <span className="block truncate text-[11px] text-fg-muted">{file.mimeType}{file.modifiedTime ? ` · ${new Date(file.modifiedTime).toLocaleDateString()}` : ''}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-line">
          <button onClick={onClose} disabled={saving} className="btn-secondary">Cancel</button>
          <button onClick={() => onSave(files.filter((file) => selected.has(file.id)))} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save selection
          </button>
        </div>
      </div>
    </div>
  )
}
