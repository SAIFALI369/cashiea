import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import {
  usePermissionConfig, resolveMode, MONEY_CAPABILITIES, TUNABLE_ROLES,
  type AccessMode, type MoneyCapability, type TunableRole, type PermissionConfig,
} from '../lib/approvals'
import PageHeader from '../components/ui/PageHeader'
import { Shield, ShieldCheck, Loader2 } from 'lucide-react'
import clsx from 'clsx'

const MODE_META: { key: AccessMode; label: string }[] = [
  { key: 'approved', label: 'Approval' },
  { key: 'direct', label: 'Direct' },
  { key: 'denied', label: 'Off' },
]

function Segment({ value, onChange }: { value: AccessMode; onChange: (m: AccessMode) => void }) {
  return (
    <div className="inline-flex p-0.5 rounded-control bg-surface-2 border border-line">
      {MODE_META.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={clsx(
            'px-2.5 py-1 rounded-[8px] text-[11px] font-semibold transition-colors min-w-[44px]',
            value === m.key
              ? m.key === 'approved'
                ? 'bg-warning text-white'
                : m.key === 'direct'
                  ? 'bg-positive text-white'
                  : 'bg-negative text-white'
              : 'text-fg-subtle hover:text-fg'
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

export default function PermissionsPage() {
  const { isOwner } = useCan()
  const { config, save, saving } = usePermissionConfig()

  if (!isOwner) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Permissions" subtitle="Owner approval controls" icon={<Shield className="w-5 h-5" />} />
        <div className="card p-8 text-center">
          <Shield className="w-10 h-10 mx-auto text-fg-subtle mb-3" />
          <p className="text-sm text-fg-muted">Only the owner can configure permissions. Ask the owner to approve your money &amp; inventory changes.</p>
        </div>
      </div>
    )
  }

  const setMode = (role: TunableRole, cap: MoneyCapability, mode: AccessMode) => {
    const next: PermissionConfig = { ...config, [role]: { ...(config[role] || {}), [cap]: mode } }
    save(next)
  }
  const allFor = (role: TunableRole, mode: AccessMode) => {
    const caps = Object.fromEntries(MONEY_CAPABILITIES.map((c) => [c.key, mode])) as Record<MoneyCapability, AccessMode>
    save({ ...config, [role]: caps })
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader title="Permission Chamber" subtitle="Control who can do what — and what needs your approval" icon={<ShieldCheck className="w-5 h-5" />} />

      <div className="card p-4 mb-5 flex items-start gap-3" style={{ background: 'rgb(var(--accent-soft) / 0.4)' }}>
        <ShieldCheck className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <p className="text-xs text-fg-muted leading-relaxed">
          Your own changes always apply instantly. By default, <strong>managers &amp; accountants need your approval</strong> for money and inventory actions
          (sales, payments, invoices, expenses, adding/removing products). Use the controls below to trust someone fully, require approval, or turn an action off.
          Minor non-money edits (like fixing a phone number) are always allowed directly.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-subtle"><span className="w-2 h-2 rounded-full bg-warning" /> Approval</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-subtle"><span className="w-2 h-2 rounded-full bg-positive" /> Direct</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-subtle"><span className="w-2 h-2 rounded-full bg-negative" /> Off</span>
        {saving && <Loader2 className="w-3.5 h-3.5 text-fg-subtle animate-spin ml-auto" />}
      </div>

      <div className="space-y-5">
        {TUNABLE_ROLES.map((role) => (
          <section key={role.key} className="card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-fg">{role.label}</h2>
              <div className="flex gap-2">
                <button onClick={() => allFor(role.key, 'approved')} className="btn-ghost text-xs h-8 px-2.5">Approve all</button>
                <button onClick={() => allFor(role.key, 'direct')} className="btn-ghost text-xs h-8 px-2.5">Trust all</button>
              </div>
            </div>
            <div className="space-y-2.5">
              {MONEY_CAPABILITIES.map((cap) => (
                <div key={cap.key} className="flex items-center justify-between gap-3 py-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{cap.label}</p>
                    <p className="text-[11px] text-fg-subtle truncate">{cap.desc}</p>
                  </div>
                  <Segment value={resolveMode(role.key, cap.key, config)} onChange={(m) => setMode(role.key, cap.key, m)} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
