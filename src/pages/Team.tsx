import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, edgeFunctionUrl } from '../lib/supabase'
import type { TeamMember } from '../lib/types'
import { validateEmail, validatePassword } from '../lib/validation'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Workforce } from '../components/team/Workforce'
import { MoreMenu } from '../components/MoreMenu'
import { Users, Plus, Loader2, Trash2, Crown, Calculator, UserCheck, Eye, EyeOff, ShieldOff, ArrowLeftRight } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Team — REAL account linking. The owner enters an email + password;
 * on confirm, an actual Cashiea account is created for that email and
 * connected to the owner's business (they see the owner's data through
 * the existing team-RLS). Only Cashier or Accountant roles, maximum
 * TWO linked accounts. The owner can change a role or remove an
 * account (revoke = keep login but block access; delete = remove the
 * account entirely).
 */

type LinkRole = 'cashier' | 'accountant'

const ROLES: { value: LinkRole; label: string; icon: typeof Crown; desc: string; color: string }[] = [
  { value: 'cashier', label: 'Cashier', icon: UserCheck, desc: 'Rings up sales at the POS counter. Cannot change stock, prices or accounts.', color: 'text-positive' },
  { value: 'accountant', label: 'Accountant', icon: Calculator, desc: 'Reviews invoices, accounts and reports. No POS counter access.', color: 'text-info' },
]

const roleIcon: Record<string, typeof Crown> = { owner: Crown, accountant: Calculator, staff: UserCheck, manager: UserCheck }
const roleColor: Record<string, string> = { owner: 'text-warning', accountant: 'text-info', staff: 'text-positive', manager: 'text-info' }
const roleLabel: Record<string, string> = { owner: 'Owner', accountant: 'Accountant', staff: 'Cashier', manager: 'Manager' }

const MAX_LINKED = 2

export default function Team() {
  const { profile, ownerId } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{ name: string; email: string; password: string; role: LinkRole }>({ name: '', email: '', password: '', role: 'cashier' })
  const [confirmCreate, setConfirmCreate] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState<TeamMember | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null)
  const [roleSwitch, setRoleSwitch] = useState<{ member: TeamMember; role: LinkRole } | null>(null)

  const isOwnerProfile = profile?.role === 'owner' && !profile.business_owner_id

  useEffect(() => { if (ownerId) loadMembers() }, [ownerId])

  const loadMembers = async () => {
    setLoading(true)
    const { data } = await supabase.from('team_members').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
    setMembers((data as TeamMember[]) || [])
    setLoading(false)
  }

  const linkedCount = useMemo(() => members.filter((m) => m.status !== 'revoked').length, [members])
  const canLinkMore = isOwnerProfile && linkedCount < MAX_LINKED

  // ── Create + link the account (edge function does the real work) ──
  const validateForm = (): string | null => {
    if (!form.email.trim()) return 'Email is required'
    const e = validateEmail(form.email)
    if (!e.valid) return e.message || 'Enter a valid email'
    const p = validatePassword(form.password)
    if (!p.valid) return p.message || 'Password must be at least 8 characters with a letter and a number'
    if (!form.role) return 'Pick a role'
    return null
  }

  const createLinked = async () => {
    setConfirmCreate(false)
    const invalid = validateForm()
    if (invalid) { toast.error(invalid); return }
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(edgeFunctionUrl('team-link'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ email: form.email.trim(), password: form.password, name: form.name.trim() || undefined, role: form.role }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not create the account')
      toast.success(`Account created — ${form.email.trim()} can now sign in`)
      setForm({ name: '', email: '', password: '', role: 'cashier' })
      setShowForm(false)
      await loadMembers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the account')
    } finally {
      setSaving(false)
    }
  }

  const changeRole = async (member: TeamMember, role: LinkRole) => {
    setRoleSwitch(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(edgeFunctionUrl('team-link'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ memberId: member.id, role }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not change the role')
      toast.success(`${member.name || member.member_email} is now ${role === 'cashier' ? 'a Cashier' : 'an Accountant'}`)
      await loadMembers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not change the role')
    }
  }

  const revoke = async (member: TeamMember) => {
    setConfirmRevoke(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${edgeFunctionUrl('team-link')}?memberId=${member.id}&deleteAccount=false`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not revoke')
      toast.success('Access revoked — the login stays but sees nothing of your business')
      await loadMembers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not revoke')
    }
  }

  const deleteAccount = async (member: TeamMember) => {
    setConfirmDelete(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${edgeFunctionUrl('team-link')}?memberId=${member.id}&deleteAccount=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not delete')
      toast.success('Account deleted')
      await loadMembers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete')
    }
  }

  const formError = form.email || form.password ? validateForm() : null

  return (
    <div className="team-page animate-fade-in">
      <PageHeader
        title="Team"
        subtitle="Link staff accounts to your business — cashier or accountant"
        icon={<Users className="w-5 h-5" />}
        action={isOwnerProfile ? (
          <button onClick={() => setShowForm(!showForm)} disabled={!canLinkMore} className="btn-primary text-sm disabled:opacity-50">
            <Plus className="w-4 h-4" /> {showForm ? 'Close' : 'Link account'}
          </button>
        ) : undefined}
      />

      {/* Linked slots indicator */}
      <div className="card p-4 mb-6 flex items-center gap-4">
        <span className="h-2 w-2 rounded-full bg-accent" />
        <p className="text-sm text-fg-muted">
          <span className="font-bold text-fg">{linkedCount} of {MAX_LINKED}</span> linked accounts used
          {!isOwnerProfile && ' — only the owner can manage linking'}
        </p>
      </div>

      {/* Role cards */}
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {ROLES.map((r) => (
          <div key={r.value} className="card card-hover p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2"><r.icon className={`w-5 h-5 ${r.color}`} /></span>
              <h3 className="font-semibold text-fg text-sm">{r.label}</h3>
            </div>
            <p className="text-xs text-fg-muted">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Link form — email + password create a REAL account */}
      {showForm && canLinkMore && (
        <div className="card p-4 mb-6 animate-slide-up">
          <h3 className="font-semibold text-fg mb-1">Link a new account</h3>
          <p className="text-xs text-fg-subtle mb-4">An account is created for this email — they sign in with this email and the password you set, and see your business data in their role.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Ramesh" autoComplete="off" />
            </div>
            <div>
              <label className="label">Role *</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm({ ...form, role: r.value })}
                    className={`p-2.5 rounded-xl border text-left transition-all ${form.role === r.value ? 'border-accent bg-accent-soft/40' : 'border-line hover:bg-surface-2'}`}
                    aria-pressed={form.role === r.value}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-fg"><r.icon className={`w-4 h-4 ${r.color}`} /> {r.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-field"
                placeholder="cashier@shop.com"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-field pr-12"
                  placeholder="Min 8 chars, letter + number"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-fg-subtle hover:text-fg"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          {formError && <p className="text-xs text-negative mt-3" role="alert">{formError}</p>}
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            <button
              onClick={() => { const e = validateForm(); if (e) { toast.error(e); return } setConfirmCreate(true) }}
              disabled={saving}
              className="btn-primary text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />} Confirm & create
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : (
        <div className="space-y-2">
          {/* Owner row */}
          <div className="card flex items-center justify-between border-t-2 border-blue-600 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50"><Crown className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="font-semibold text-fg">{profile?.full_name} <span className="text-xs text-fg-subtle">(you)</span></p>
                <p className="text-xs text-fg-subtle">{profile?.company_name}</p>
              </div>
            </div>
            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">Owner</span>
          </div>

          {members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No linked accounts"
              description={`Link up to ${MAX_LINKED} staff accounts — a cashier for the counter, an accountant for the books. You create their login; they see your business in their role only.`}
            />
          ) : members.map((m) => {
            const Icon = roleIcon[m.role] || UserCheck
            const isLinked = m.status === 'active'
            return (
              <div key={m.id} className={`card relative p-5 ${m.status === 'revoked' ? 'opacity-70' : ''}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0"><Icon className={`w-5 h-5 ${roleColor[m.role] || 'text-fg-muted'}`} /></div>
                    <div className="min-w-0">
                      <p className="font-semibold text-fg truncate">{m.name || m.member_email}</p>
                      <p className="text-xs text-fg-subtle truncate">{m.member_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-positive/15 text-positive' : m.status === 'revoked' ? 'bg-negative/15 text-negative' : 'bg-surface-2 text-fg-subtle'}`}>
                      {m.status === 'active' ? 'Linked' : m.status}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">{roleLabel[m.role] || m.role}</span>
                  </div>
                </div>

                {/* Compact overflow actions */}
                {isOwnerProfile && <div className="absolute right-3 top-3"><MoreMenu label={`Actions for ${m.name || m.member_email}`} items={[
                  ...(isLinked ? [{ label: `Make ${m.role === 'accountant' ? 'Cashier' : 'Accountant'}`, icon: <ArrowLeftRight className="h-4 w-4" />, onClick: () => setRoleSwitch({ member: m, role: m.role === 'accountant' ? 'cashier' : 'accountant' }) }] : []),
                  ...(isLinked ? [{ label: 'Revoke access', icon: <ShieldOff className="h-4 w-4" />, onClick: () => setConfirmRevoke(m) }] : []),
                  { label: m.status === 'revoked' ? 'Delete' : 'Delete account', icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => setConfirmDelete(m) },
                ]} /></div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Shift clock + commission — staff see their own clock, owner sees all */}
      <Workforce
        ownerId={ownerId}
        profileId={profile?.id ?? null}
        staffName={profile?.full_name || 'Staff'}
        isOwner={isOwnerProfile}
      />

      {/* Confirm create */}
      <ConfirmDialog
        open={confirmCreate}
        title="Create this account?"
        message={`A Cashiea account will be created for ${form.email || 'this email'} with the password you set, linked to your business as ${form.role === 'cashier' ? 'a Cashier' : 'an Accountant'}. They can sign in immediately.`}
        confirmLabel="Create & link"
        danger={false}
        loading={saving}
        onConfirm={createLinked}
        onClose={() => setConfirmCreate(false)}
      />

      {/* Confirm revoke */}
      <ConfirmDialog
        open={!!confirmRevoke}
        title="Revoke access?"
        message={`${confirmRevoke?.name || confirmRevoke?.member_email} will immediately lose access to your business data. Their login stays — you can delete it entirely afterwards.`}
        confirmLabel="Revoke access"
        danger={true}
        onConfirm={() => confirmRevoke && revoke(confirmRevoke)}
        onClose={() => setConfirmRevoke(null)}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete this account?"
        message={`${confirmDelete?.name || confirmDelete?.member_email}'s account will be permanently deleted and the link removed. They will not be able to sign in with this email unless you create it again.`}
        confirmLabel="Delete account"
        danger={true}
        onConfirm={() => confirmDelete && deleteAccount(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />

      {/* Confirm role switch */}
      <ConfirmDialog
        open={!!roleSwitch}
        title="Change role?"
        message={`${roleSwitch?.member.name || roleSwitch?.member.member_email} will become ${roleSwitch?.role === 'cashier' ? 'a Cashier (POS counter access)' : 'an Accountant (invoices, accounts and reports)'} on next sign-in.`}
        confirmLabel="Change role"
        danger={false}
        onConfirm={() => roleSwitch && changeRole(roleSwitch.member, roleSwitch.role)}
        onClose={() => setRoleSwitch(null)}
      />
    </div>
  )
}
