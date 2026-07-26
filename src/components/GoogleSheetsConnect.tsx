import { useState } from 'react'
import { type AppCatalogEntry, type PermissionMode } from '../lib/app-catalog'
import { X, Check, Shield, ArrowRight, Loader2 } from 'lucide-react'

const C = { bg: 'rgb(var(--paper))', border: 'rgb(var(--line))', blue: 'rgb(var(--accent))', blueDark: 'rgb(var(--accent-strong))', green: 'rgb(var(--positive))', text: 'rgb(var(--fg))', textBody: 'rgb(var(--fg-muted))', muted: 'rgb(var(--fg-subtle))' }

export default function GoogleSheetsConnect({
  app,
  onClose,
  onStartAuth,
}: {
  app: AppCatalogEntry
  onClose: () => void
  onStartAuth: (permission: PermissionMode) => void
}) {
  const [selected, setSelected] = useState<PermissionMode>('read_only')
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-xl animate-fade-in" style={{ background: 'rgb(var(--surface))' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold" style={{ background: app.iconBg, color: app.iconText }}>{app.iconLetter}</div>
              <div>
                <h3 className="font-bold text-lg" style={{ color: C.text, fontFamily: '"Plus Jakarta Sans"' }}>{app.name}</h3>
                <p className="text-xs" style={{ color: C.muted }}>Connect your account securely</p>
              </div>
            </div>
            <button onClick={onClose} className="transition-colors" style={{ color: C.muted }}><X className="w-5 h-5" /></button>
          </div>

          {/* What will happen */}
          <div className="rounded-xl p-4" style={{ background: C.bg }}>
            <div className="flex items-start gap-2.5">
              <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.blue }} />
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: C.text }}>What happens next:</p>
                <ol className="text-sm space-y-1" style={{ color: C.textBody }}>
                  <li>1. You'll sign in with your Google account</li>
                  <li>2. Google will ask you to grant access</li>
                  <li>3. Choose a permission level below</li>
                  <li>4. Cashiea connects — ready to use</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Permission selection */}
        <div className="p-4">
          <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>Choose a permission level</p>
          <div className="space-y-2.5">
            {app.permissions.map((perm) => {
              const isSelected = selected === perm.mode
              return (
                <button
                  key={perm.mode}
                  onClick={() => setSelected(perm.mode)}
                  className="w-full text-left p-4 rounded-xl transition-all duration-200"
                  style={{
                    background: isSelected ? 'rgb(var(--accent) / 0.05)' : 'rgb(var(--surface))',
                    border: isSelected ? `2px solid ${C.blue}` : `1px solid ${C.border}`,
                  }}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all" style={{ borderColor: isSelected ? C.blue : C.border, background: isSelected ? C.blue : 'transparent' }}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="font-semibold text-sm" style={{ color: C.text }}>{perm.label}</span>
                    </div>
                  </div>
                  <p className="text-xs ml-7 mb-2" style={{ color: C.muted }}>{perm.description}</p>
                  <div className="ml-7 flex flex-wrap gap-1.5">
                    {perm.allows.slice(0, 3).map((a) => (
                      <span key={a} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: C.green + '15', color: C.green }}>{a}</span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
            <div className="relative mt-0.5">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="sr-only peer" />
              <div className="w-5 h-5 rounded-md border-2 transition-all peer-checked:bg-blue-500 peer-checked:border-blue-500 flex items-center justify-center" style={{ borderColor: C.border }}>
                {confirmed && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
            <span className="text-xs leading-relaxed" style={{ color: C.textBody }}>
              I understand Cashiea will access my Google Sheets with the selected permissions. I can disconnect anytime in Settings.
            </span>
          </label>

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all" style={{ background: C.bg, color: C.textBody, border: `1px solid ${C.border}` }}>
              Cancel
            </button>
            <button
              onClick={() => onStartAuth(selected)}
              disabled={!confirmed}
              className="flex-1 py-3 rounded-xl font-semibold text-white text-sm transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${C.blue}, rgb(var(--gold)))`, boxShadow: confirmed ? `0 4px 14px rgb(var(--accent) / 0.19)` : 'none' }}
            >
              Continue with Google <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
