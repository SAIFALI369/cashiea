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
    <div className="inline-flex p-0.5 rounded-control bg-surface-2">
      {MODE_META.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={clsx(
            'min-h-[32px] min-w-[44px] rounded-[8px] px-2 py-1 text-[12px] font-semibold transition-colors',
            value === m.key
              ? m.key === 'approved'
                ? 'bg-[#FEF3C7] text-[#92400E]'
                : m.key === 'direct'
                  ? 'bg-[#ECFDF5] text-[#065F46]'
                  : 'bg-[#F3F4F6] text-[#6B7280]'
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
    <div className="permissions-page animate-fade-in">
      <PageHeader title="Permission Chamber" subtitle="Control who can do what — and what needs your approval" icon={<ShieldCheck className="w-5 h-5" />} />

      <details className="card mb-5 p-4"><summary className="cursor-pointer list-none text-sm font-semibold text-fg">ℹ️ How permissions work. Tap to read.</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-fg-muted"><li>Your own changes always apply instantly.</li><li>Managers and accountants can require approval for money and inventory actions.</li><li>Direct lets a role act without approval; Off blocks that action.</li></ul></details>

      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-subtle"><span className="w-2 h-2 rounded-full bg-warning" /> Approval</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-subtle"><span className="w-2 h-2 rounded-full bg-positive" /> Direct</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-subtle"><span className="w-2 h-2 rounded-full bg-negative" /> Off</span>
        {saving && <Loader2 className="w-3.5 h-3.5 text-fg-subtle animate-spin ml-auto" />}
      </div>

      <div className="permissions-table"><div className="permissions-table-head"><span>Role</span><span>Products &amp; Stock</span><span>New Sale</span><span>Invoices &amp; Payments</span><span>Expenses</span></div><div className="space-y-5">
        {TUNABLE_ROLES.map((role) => (
          <section key={role.key} className="permissions-role card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-fg">{role.label}</h2>
              <div className="flex gap-2">
                <button onClick={() => allFor(role.key, 'approved')} className="btn-ghost text-xs h-8 px-2.5">Approve all</button>
                <button onClick={() => allFor(role.key, 'direct')} className="btn-ghost text-xs h-8 px-2.5">Trust all</button>
              </div>
            </div>
            <div className="permission-rows space-y-2.5">
              {MONEY_CAPABILITIES.map((cap) => (
                <div key={cap.key} className="permission-row flex items-center justify-between gap-3 py-1.5">
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
      </div></div>
    </div>
  )
}
