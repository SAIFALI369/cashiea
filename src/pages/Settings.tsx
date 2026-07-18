import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { Settings as SettingsIcon, User, Building2, Sparkles, Loader2, Save, Check, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import type { AIProvider } from '../lib/ai'

const providers: { value: AIProvider; label: string; desc: string }[] = [
  { value: 'vercel_gateway', label: 'Vercel AI Gateway', desc: '302 models (GPT-5.5, Claude, Gemini) — one key' },
  { value: 'openai', label: 'OpenAI', desc: 'GPT-4o — most versatile' },
  { value: 'gemini', label: 'Google Gemini', desc: 'Fast & cost-effective' },
  { value: 'anthropic', label: 'Anthropic Claude', desc: 'Best for writing & reasoning' },
]

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [companyName, setCompanyName] = useState(profile?.company_name || '')
  const [gstin, setGstin] = useState(profile?.gstin || '')
  const [businessAddress, setBusinessAddress] = useState(profile?.business_address || '')
  const [businessState, setBusinessState] = useState(profile?.business_state || '')
  const [upiId, setUpiId] = useState(profile?.upi_id || '')
  const [dailyBriefing, setDailyBriefing] = useState(profile?.daily_briefing !== false)
  const [aiProvider, setAiProvider] = useState<AIProvider>(profile?.ai_provider || 'openai')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          company_name: companyName,
          gstin: gstin || null,
          business_address: businessAddress || null,
          business_state: businessState || null,
          upi_id: upiId || null,
          daily_briefing: dailyBriefing,
          ai_provider: aiProvider,
        })
        .eq('id', profile!.id)

      if (error) throw error
      await refreshProfile()
      toast.success('Settings saved ✅')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Settings"
        subtitle="Manage your profile and AI preferences"
        icon={<SettingsIcon className="w-5 h-5" />}
      />

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-brand-400" /> Profile Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="label">Company Name</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="input-field"
                placeholder="Acme Inc"
              />
            </div>
            <div>
              <label className="label">GSTIN (for GST invoices)</label>
              <input
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="input-field font-mono"
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div>
              <label className="label">Business Address</label>
              <input
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                className="input-field"
                placeholder="123 Main St, City"
              />
            </div>
            <div>
              <label className="label">State</label>
              <input
                value={businessState}
                onChange={(e) => setBusinessState(e.target.value)}
                className="input-field"
                placeholder="Bihar"
              />
            </div>
            <div>
              <label className="label">UPI ID (for instant invoice payments)</label>
              <input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="input-field font-mono"
                placeholder="myshop@okhdfcbank"
              />
              <p className="text-xs text-slate-500 mt-1">Customers can pay any invoice by scanning a QR or tapping a link — works with PhonePe, GPay, Paytm, BHIM.</p>
            </div>
          </div>
        </div>

        {/* AI Provider */}
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-400" /> AI Provider
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Choose which AI model powers your automations. Switch anytime.
          </p>
          <div className="space-y-3">
            {providers.map((p) => (
              <button
                key={p.value}
                onClick={() => setAiProvider(p.value)}
                className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                  aiProvider === p.value
                    ? 'border-brand-600 bg-brand-600/10'
                    : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                }`}
              >
                <div>
                  <p className="font-semibold text-white">{p.label}</p>
                  <p className="text-sm text-slate-400">{p.desc}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    aiProvider === p.value ? 'border-brand-500 bg-brand-500' : 'border-slate-600'
                  }`}
                >
                  {aiProvider === p.value && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            ))}
          </div>

          {/* Daily briefing opt-in */}
          <div className="mt-6 p-4 rounded-xl border border-slate-700 bg-slate-900/50 flex items-center justify-between">
            <div className="flex-1 pr-4">
              <p className="font-semibold text-white flex items-center gap-2"><Mail className="w-4 h-4 text-brand-400" /> Daily AI Briefing</p>
              <p className="text-sm text-slate-400 mt-0.5">Every morning the AI scans your business, predicts tasks, and emails you a briefing with what needs attention.</p>
            </div>
            <button
              type="button"
              onClick={() => setDailyBriefing(!dailyBriefing)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${dailyBriefing ? 'bg-brand-500' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${dailyBriefing ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Usage info */}
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-400" /> Account Details
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Email</span>
              <span className="text-slate-200">{user?.email || '—'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Plan</span>
              <span className="text-slate-200 capitalize">{profile?.plan}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Actions Used</span>
              <span className="text-slate-200">{profile?.api_usage_count} / {profile?.api_usage_limit}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Member Since</span>
              <span className="text-slate-200">
                {profile ? new Date(profile.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Save button */}
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Changes
        </button>
      </div>
    </div>
  )
}
