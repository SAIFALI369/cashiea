import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { UserCog, Shield, Save, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Account() {
  const { profile, user, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFullName(profile?.full_name || '')
    setCompany(profile?.company_name || '')
    setPhone(profile?.phone || '')
    setEmail(user?.email || '')
  }, [profile, user])

  const save = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, company_name: company, phone })
        .eq('id', profile!.id)
      if (error) throw error
      if (email && email !== user?.email) {
        const { error: ae } = await supabase.auth.updateUser({ email })
        if (ae) throw ae
        toast.success('Profile saved. Email change needs confirmation.')
      } else {
        toast.success('Profile saved')
      }
      await refreshProfile()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const initial = (fullName || email || '?').charAt(0).toUpperCase()

  return (
    <div className="animate-fade-in max-w-xl">
      <PageHeader title="Edit Account" subtitle="Manage your profile & contact details" icon={<UserCog className="w-5 h-5" />} />

      <div className="card p-6 sm:p-8">
        {/* Profile photo placeholder */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-accent-strong text-accent-fg flex items-center justify-center text-2xl font-bold ring-1 ring-line">
            {initial}
          </div>
          <div>
            <p className="font-semibold text-fg">Profile photo</p>
            <p className="text-xs text-fg-subtle mt-0.5">Photo upload coming soon</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="label">Name</label>
            <input className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          </div>

          <div>
            <label className="label">Work</label>
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-2 border border-line">
              <Shield className="w-4 h-4 text-accent" />
              <span className="text-sm text-fg">Owner</span>
              <span className="ml-auto text-[11px] text-fg-subtle">Role</span>
            </div>
          </div>

          <div>
            <label className="label">Phone</label>
            <input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" inputMode="tel" />
          </div>

          <div>
            <label className="label">Email</label>
            <input className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@shop.com" inputMode="email" />
          </div>

          <button onClick={save} disabled={saving} className="btn-primary w-full mt-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mt-6 text-xs text-fg-subtle">
        <Link to="/privacy" className="hover:text-fg transition-colors">Privacy Policy</Link>
        <span>·</span>
        <Link to="/terms" className="hover:text-fg transition-colors">Terms &amp; Conditions</Link>
      </div>
    </div>
  )
}
