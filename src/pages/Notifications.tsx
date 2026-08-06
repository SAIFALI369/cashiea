import { useState } from 'react'
import { useCan } from '../lib/permissions'
import {
  usePendingApprovals, executeChangeRequest, denyChangeRequest,
  type ChangeRequest,
} from '../lib/approvals'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Bell, Check, X, ShieldAlert, Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const CAP_LABEL: Record<string, string> = {
  'products:manage': 'Products & stock',
  'sales:create': 'New sale',
  'billing:manage': 'Invoices & payments',
  'expenses:manage': 'Expenses',
}

type ConfirmState = { cr: ChangeRequest; action: 'accept' | 'deny'; step: 1 | 2 } | null

export default function Notifications() {
  const { isOwner } = useCan()
  const { items, loading, reload } = usePendingApprovals()
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [busy, setBusy] = useState(false)

  const start = (cr: ChangeRequest, action: 'accept' | 'deny') => setConfirm({ cr, action, step: 1 })

  const advance = async () => {
    if (!confirm) return
    const { cr, action } = confirm
    // Accept non-money = 1 step; Accept money & Deny = 2 steps.
    if (confirm.step === 1 && !(action === 'accept' && cr.money_related)) {
      // (deny always needs step 2; accept-money needs step 2) → but accept-non-money applies now
    }
    if (confirm.step === 1 && action === 'accept' && !cr.money_related) {
      // single-step apply
      setConfirm(null); await run(cr, 'accept'); return
    }
    if (confirm.step === 1) { setConfirm({ ...confirm, step: 2 }); return }
    // step 2
    setConfirm(null)
    await run(cr, action)
  }

  const run = async (cr: ChangeRequest, action: 'accept' | 'deny') => {
    setBusy(true)
    try {
      if (action === 'accept') {
        await executeChangeRequest(cr)
        toast.success('Change applied ✅')
      } else {
        await denyChangeRequest(cr.id)
        toast.success('Request denied & removed')
      }
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (!isOwner) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Notifications" subtitle="Approvals & alerts" icon={<Bell className="w-5 h-5" />} />
        <div className="card p-8 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto text-fg-subtle mb-3" />
          <p className="text-sm text-fg-muted">Approvals are managed by the owner. Your money &amp; inventory requests will appear here for the owner to accept or deny.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader title="Notifications" subtitle="Approvals waiting on you" icon={<Bell className="w-5 h-5" />} />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-accent" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Sparkles} title="All clear" description="No approvals waiting. New money & inventory requests from your team will appear here for you to accept or deny." />
      ) : (
        <div className="space-y-3">
          {items.map((cr) => (
            <div key={cr.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-control bg-accent-soft text-accent flex items-center justify-center flex-shrink-0"><ShieldAlert className="w-5 h-5" /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-fg">{CAP_LABEL[cr.capability] || cr.capability}</p>
                    {cr.money_related && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning text-white">MONEY</span>}
                    <span className="text-[11px] text-fg-subtle">· {new Date(cr.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-fg-muted mt-1 leading-relaxed">{cr.summary}</p>
                  <p className="text-[11px] text-fg-subtle mt-1.5">Requested by <span className="font-medium text-fg-muted">{cr.requester_name || 'a team member'}</span>{cr.requester_role ? ` · ${cr.requester_role}` : ''}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => start(cr, 'accept')} className="btn-primary text-sm flex-1 h-9"><Check className="w-4 h-4" /> Accept</button>
                <button onClick={() => start(cr, 'deny')} className="btn-secondary text-sm flex-1 h-9"><X className="w-4 h-4" /> Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Two-step confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => !busy && setConfirm(null)}>
          <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-fg">{confirm.action === 'accept' ? 'Accept this change?' : 'Deny this request?'}</p>
            <p className="text-xs text-fg-muted mt-1.5 leading-relaxed">{confirm.cr.summary}</p>
            {confirm.step === 2 && (
              <p className="text-xs font-semibold text-negative mt-3 p-2 rounded-control bg-error/10">
                {confirm.action === 'accept' ? 'Final confirm — this will apply the change now.' : 'Final confirm — this will delete the request.'}
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setConfirm(null)} disabled={busy} className="btn-secondary text-sm flex-1 h-9">Cancel</button>
              <button onClick={advance} disabled={busy} className={clsx('text-sm flex-1 h-9', confirm.action === 'accept' ? 'btn-primary' : 'btn-secondary')} style={confirm.action === 'deny' ? { color: 'rgb(var(--negative))' } : undefined}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : confirm.action === 'accept' ? (confirm.step === 2 ? 'Apply now' : 'Continue') : (confirm.step === 2 ? 'Delete' : 'Continue')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
