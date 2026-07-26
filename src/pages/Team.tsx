import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { TeamMember, TeamRole } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Users, Plus, Loader2, Trash2, Crown, Shield, Calculator, UserCheck, Mail, X } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES: { value: TeamRole; label: string; icon: typeof Crown; desc: string; color: string }[] = [
  { value: 'manager', label: 'Manager', icon: Shield, desc: 'Can approve invoices, view reports, manage staff', color: 'text-blue-400' },
  { value: 'accountant', label: 'Accountant', icon: Calculator, desc: 'Reviews invoices, accounts, and reports', color: 'text-purple-400' },
  { value: 'staff', label: 'Staff', icon: UserCheck, desc: 'POS access only — rings up sales', color: 'text-green-400' },
]

const roleIcon: Record<string, typeof Crown> = { owner: Crown, manager: Shield, accountant: Calculator, staff: UserCheck }
const roleColor: Record<string, string> = { owner: 'text-amber-400', manager: 'text-blue-400', accountant: 'text-purple-400', staff: 'text-green-400' }

export default function Team() {
  const { profile } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<{ email: string; name: string; role: TeamRole }>({ email: '', name: '', role: 'staff' })

  useEffect(() => { loadMembers() }, [])

  const loadMembers = async () => {
    setLoading(true)
    const { data } = await supabase.from('team_members').select('*').eq('user_id', profile!.id).order('created_at', { ascending: false })
    setMembers((data as TeamMember[]) || [])
    setLoading(false)
  }

  const invite = async () => {
    if (!form.email.trim()) return toast.error('Email is required')
    const perms = form.role === 'manager'
      ? { pos: true, invoices: true, reports: true, accounts: true, team: true }
      : form.role === 'accountant'
      ? { pos: false, invoices: true, reports: true, accounts: true, team: false }
      : { pos: true, invoices: false, reports: false, accounts: false, team: false }
    const { data, error } = await supabase.from('team_members').insert({
      user_id: profile!.id, member_email: form.email, name: form.name || null,
      role: form.role, status: 'invited', permissions: perms,
    }).select().single()
    if (error) { toast.error(error.message); return }
    setMembers([data as TeamMember, ...members])
    setForm({ email: '', name: '', role: 'staff' })
    setShowForm(false)
    toast.success(`Invitation sent to ${form.email}`)
  }

  const revoke = async (id: string) => {
    const { error } = await supabase.from('team_members').update({ status: 'revoked' }).eq('id', id)
    if (!error) { setMembers(members.map((m) => m.id === id ? { ...m, status: 'revoked' } : m)); toast.success('Access revoked') }
  }

  const removeMember = async (id: string) => {
    const { error } = await supabase.from('team_members').delete().eq('id', id)
    if (!error) { setMembers(members.filter((m) => m.id !== id)); toast.success('Removed') }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Team"
        subtitle="Invite staff — managers approve, accountants review, staff run the counter"
        icon={<Users className="w-5 h-5" />}
        action={<button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> {showForm ? 'Close' : 'Invite member'}</button>}
      />

      {/* Role legend */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {ROLES.map((r) => (
          <div key={r.value} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <r.icon className={`w-5 h-5 ${r.color}`} />
              <h3 className="font-semibold text-white text-sm">{r.label}</h3>
            </div>
            <p className="text-xs text-slate-400">{r.desc}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card p-4 mb-6 animate-slide-up">
          <h3 className="font-semibold text-white mb-4">Invite a team member</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div><label className="label">Email *</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="staff@shop.com" /></div>
            <div><label className="label">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Ramesh" /></div>
            <div><label className="label">Role</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as TeamRole })} className="input-field">{ROLES.map((r) => <option key={r.value} value={r.value} className="bg-slate-900">{r.label}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={invite} className="btn-primary text-sm"><Mail className="w-4 h-4" /> Send invitation</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
      ) : members.length === 0 ? (
        <EmptyState icon={Users} title="No team members yet" description="Invite your staff. Managers can approve invoices, accountants review accounts, and staff run the POS counter." />
      ) : (
        <div className="space-y-2">
          {/* Owner row */}
          <div className="card p-4 border-amber-600/30 bg-amber-600/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center"><Crown className="w-5 h-5 text-white" /></div>
              <div>
                <p className="font-semibold text-white">{profile?.full_name} <span className="text-xs text-amber-400">(you)</span></p>
                <p className="text-xs text-slate-500">{profile?.company_name}</p>
              </div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Owner</span>
          </div>

          {members.map((m) => {
            const Icon = roleIcon[m.role] || UserCheck
            return (
              <div key={m.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0"><Icon className={`w-5 h-5 ${roleColor[m.role]}`} /></div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{m.name || m.member_email}</p>
                    <p className="text-xs text-slate-500 truncate">{m.member_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                    m.status === 'active' ? 'bg-green-500/15 text-green-400' :
                    m.status === 'revoked' ? 'bg-red-500/15 text-red-400' :
                    'bg-amber-500/15 text-amber-400'
                  }`}>{m.status}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 capitalize hidden sm:inline">{m.role}</span>
                  {m.status !== 'revoked'
                    ? <button onClick={() => revoke(m.id)} className="btn-ghost text-xs text-amber-400"><X className="w-3.5 h-3.5" /></button>
                    : <button onClick={() => removeMember(m.id)} className="btn-ghost text-xs text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
