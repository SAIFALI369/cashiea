import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { Settings as SettingsIcon, User, Building2, Sparkles, Loader2, Save, Check, Mail, Key, ExternalLink, Trash2, Eye, EyeOff, AlertCircle, Zap, Globe } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  PROVIDER_OPTIONS,
  detectProviderFromKey,
  getUserAPIKeyStatus,
  setUserAPIKey,
  deleteUserAPIKey,
  type UserAPIKeyStatus,
  type AIProviderId,
} from '../lib/userKeys'

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [companyName, setCompanyName] = useState(profile?.company_name || '')
  const [gstin, setGstin] = useState(profile?.gstin || '')
  const [businessAddress, setBusinessAddress] = useState(profile?.business_address || '')
  const [businessState, setBusinessState] = useState(profile?.business_state || '')
  const [upiId, setUpiId] = useState(profile?.upi_id || '')
  const [dailyBriefing, setDailyBriefing] = useState(profile?.daily_briefing !== false)
  const [reportTime, setReportTime] = useState(() => {
    if (!profile?.report_time_utc) return '22:30'
    const [h, m] = profile.report_time_utc.split(':').map(Number)
    let istMin = (h * 60 + m) + (5 * 60 + 30)
    if (istMin >= 24 * 60) istMin -= 24 * 60
    return `${String(Math.floor(istMin / 60)).padStart(2, '0')}:${String(istMin % 60).padStart(2, '0')}`
  })

  // ── AI key form state ──────────────────────────────────────
  const [keyStatus, setKeyStatus] = useState<UserAPIKeyStatus | null>(null)
  const [provider, setProvider] = useState<AIProviderId>('openrouter')
  const [newKey, setNewKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState('google/gemini-2.5-flash-lite')
  const [customModel, setCustomModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [deletingKey, setDeletingKey] = useState(false)

  const [saving, setSaving] = useState(false)

  const selectedProvider = useMemo(
    () => PROVIDER_OPTIONS.find((p) => p.id === provider) ?? PROVIDER_OPTIONS[0],
    [provider]
  )

  // Load the user's current AI key status on mount
  useEffect(() => {
    getUserAPIKeyStatus()
      .then((s) => {
        setKeyStatus(s)
        if (s.provider) {
          setProvider(s.provider as AIProviderId)
        }
        if (s.model) {
          setModel(s.model)
        }
      })
      .catch(() => setKeyStatus({ has_key: false, provider: null, hint: null, model: null }))
  }, [])

  // When the user types a key, auto-detect the provider (unless
  // they've already picked one that matches).
  useEffect(() => {
    if (!newKey.trim()) return
    const detected = detectProviderFromKey(newKey)
    if (detected !== provider) {
      // Only auto-switch if the user hasn't picked something different
      // intentionally. We always switch when the current selection is
      // 'openrouter' (the default) and the key is clearly something else.
      if (provider === 'openrouter' && detected !== 'openrouter') {
        setProvider(detected)
        const p = PROVIDER_OPTIONS.find((p) => p.id === detected)
        if (p) setModel(p.defaultModel)
      }
    }
  }, [newKey, provider])

  // When the user picks a different provider, reset the model to
  // that provider's default.
  function onProviderChange(newProv: AIProviderId) {
    setProvider(newProv)
    const p = PROVIDER_OPTIONS.find((p) => p.id === newProv)
    if (p) setModel(p.defaultModel)
  }

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
          report_time_utc: (() => {
            const [h, m] = reportTime.split(':').map(Number)
            let u = (h * 60 + m) - (5 * 60 + 30); if (u < 0) u += 24 * 60
            return `${String(Math.floor(u / 60)).padStart(2, '0')}:${String(u % 60).padStart(2, '0')}`
          })(),
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

  const handleSaveKey = async () => {
    if (!newKey.trim()) {
      toast.error('Paste your API key first')
      return
    }
    if (selectedProvider.requiresBaseUrl && !baseUrl.trim()) {
      toast.error('Custom provider requires a base URL')
      return
    }
    setSavingKey(true)
    try {
      const finalModel = model === '__custom__' ? (customModel.trim() || selectedProvider.defaultModel) : model
      const r = await setUserAPIKey(newKey.trim(), provider, finalModel, baseUrl.trim() || undefined)
      setKeyStatus({ has_key: true, provider: r.provider, hint: r.hint, model: r.model, baseUrl: r.baseUrl ?? null })
      setNewKey('')
      setShowKey(false)
      setModel(r.model)
      toast.success(`Connected to ${PROVIDER_OPTIONS.find((p) => p.id === r.provider)?.label || r.provider}. The AI assistant is now ready.`)
      await refreshProfile()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save key')
    } finally {
      setSavingKey(false)
    }
  }

  const handleDeleteKey = async () => {
    if (!confirm('Remove your API key? You can re-add it any time.')) return
    setDeletingKey(true)
    try {
      await deleteUserAPIKey()
      setKeyStatus({ has_key: false, provider: null, hint: null, model: null })
      toast.success('API key removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove key')
    } finally {
      setDeletingKey(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Settings"
        subtitle="Your profile, business details, and AI key"
        icon={<SettingsIcon className="w-5 h-5" />}
      />

      <div className="max-w-2xl space-y-6">
        {/* ═══════════════════════════════════════════════════
            AI SETUP — any provider. Users bring their own key
            (OpenAI, Anthropic, Google Gemini, OpenRouter,
            DeepSeek, Meta, Mistral, Groq, xAI, Cohere,
            Perplexity, or any OpenAI-compatible endpoint).
            Encrypted server-side, never leaves the backend.
           ═══════════════════════════════════════════════════ */}
        <div className="card p-7 border-[#0071e3]/30">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-apple-50 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-apple-500" strokeWidth={1.75} />
            </div>
            <h2 className="text-[20px] font-semibold tracking-tight text-ink-800">AI assistant</h2>
          </div>
          <p className="text-[14px] text-ink-500 mt-1 mb-5">
            The AI powers your assistant, daily briefings, low-stock alerts, Hindi/Hinglish customer replies,
            GST voice invoicing, campaign drafts, and every other automation. Pick any provider and paste
            your own key — your data stays in your account.
          </p>

          {/* Status row */}
          {keyStatus?.has_key ? (
            <div className="rounded-xl border border-[#00863a]/30 bg-[#e8f8ee] p-4 mb-5 flex items-center gap-3">
              <Check className="w-5 h-5 text-[#00863a] flex-shrink-0" strokeWidth={2.5} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#0a5a28]">
                  Connected to {PROVIDER_OPTIONS.find((p) => p.id === keyStatus.provider)?.label || keyStatus.provider}
                </p>
                <p className="text-[12px] text-[#0a5a28]/80 mt-0.5 font-mono">
                  ••••{keyStatus.hint} · {keyStatus.model}
                </p>
              </div>
              <button
                onClick={handleDeleteKey}
                disabled={deletingKey}
                className="text-[12px] text-[#ff3b30] hover:underline flex items-center gap-1 flex-shrink-0"
              >
                {deletingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Remove
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-[#ff9500]/30 bg-[#fff4e5] p-4 mb-5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#ff9500] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#8a5500]">No API key set yet</p>
                <p className="text-[12px] text-[#8a5500]/80 mt-0.5 leading-relaxed">
                  The AI assistant won't respond until you add a key. Pick a provider below and paste your key —
                  get one from the provider's website (most have free tiers).
                </p>
              </div>
            </div>
          )}

          {/* Provider picker */}
          <div className="space-y-4">
            <div>
              <label className="label">Provider</label>
              <select
                value={provider}
                onChange={(e) => onProviderChange(e.target.value as AIProviderId)}
                className="input-field"
              >
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {selectedProvider.signupUrl && (
                <p className="text-[12px] text-ink-500 mt-1.5">
                  Get a key at{' '}
                  <a href={selectedProvider.signupUrl} target="_blank" rel="noreferrer" className="text-apple-500 hover:underline font-medium">
                    {selectedProvider.signupUrl.replace(/^https?:\/\//, '')} <ExternalLink className="w-3 h-3 inline -mt-0.5" />
                  </a>
                </p>
              )}
            </div>

            {/* API key input */}
            <div>
              <label className="label">API key</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400" />
                <input
                  type={showKey ? 'text' : 'password'}
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="input-field pl-11 pr-11 font-mono text-[13px]"
                  placeholder={keyStatus?.has_key ? `••••••••••••${keyStatus.hint || ''}` : selectedProvider.keyPrefix || 'Paste your API key'}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                  title={showKey ? 'Hide' : 'Show'}
                >
                  {showKey ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
              <p className="text-[12px] text-ink-500 mt-1.5">
                Stored encrypted in your database. Never sent anywhere except your provider, never shown in the UI.
              </p>
            </div>

            {/* Custom base URL (only for "custom" provider) */}
            {selectedProvider.requiresBaseUrl && (
              <div>
                <label className="label">Base URL</label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400" />
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="input-field pl-11 font-mono text-[13px]"
                    placeholder="https://api.together.xyz/v1"
                  />
                </div>
                <p className="text-[12px] text-ink-500 mt-1.5">
                  Any OpenAI-compatible endpoint — Together, Anyscale, self-hosted llama.cpp / vLLM / ollama, etc.
                </p>
              </div>
            )}

            {/* Model */}
            <div>
              <label className="label">Default model</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="input-field font-mono text-[13px]"
                placeholder={selectedProvider.defaultModel}
              />
              <p className="text-[12px] text-ink-500 mt-1.5">
                The exact model name your provider expects. Leave as <code className="bg-ink-100 px-1.5 py-0.5 rounded text-[11px]">{selectedProvider.defaultModel}</code> for the provider's recommended default, or type any other.
              </p>
            </div>

            <button
              onClick={handleSaveKey}
              disabled={savingKey || !newKey.trim()}
              className="btn-primary w-full py-3"
            >
              {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {keyStatus?.has_key ? 'Update AI key' : 'Save and activate AI'}
            </button>
          </div>
        </div>

        {/* Profile */}
        <div className="card p-6">
          <h2 className="font-semibold text-ink-800 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-apple-500" /> Profile information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" placeholder="Ramesh Kumar" />
            </div>
            <div>
              <label className="label">Company / shop name</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-field" placeholder="Kumar General Store" />
            </div>
            <div>
              <label className="label">GSTIN (for GST invoices)</label>
              <input value={gstin} onChange={(e) => setGstin(e.target.value)} className="input-field font-mono" placeholder="22AAAAA0000A1Z5" />
            </div>
            <div>
              <label className="label">Business address</label>
              <input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="input-field" placeholder="123 Main St, City" />
            </div>
            <div>
              <label className="label">State</label>
              <input value={businessState} onChange={(e) => setBusinessState(e.target.value)} className="input-field" placeholder="Bihar" />
            </div>
            <div>
              <label className="label">UPI ID (for instant invoice payments)</label>
              <input value={upiId} onChange={(e) => setUpiId(e.target.value)} className="input-field font-mono" placeholder="myshop@okhdfcbank" />
              <p className="text-xs text-ink-500 mt-1">Customers can pay any invoice by scanning a QR or tapping a link — works with PhonePe, GPay, Paytm, BHIM.</p>
            </div>
            <div>
              <label className="label">Daily WhatsApp report time (IST)</label>
              <input type="time" value={reportTime} onChange={(e) => setReportTime(e.target.value)} className="input-field" />
              <p className="text-xs text-ink-500 mt-1">When your daily sales report arrives on WhatsApp. Default 10:30 PM IST.</p>
            </div>
          </div>
        </div>

        {/* Daily briefing toggle */}
        <div className="card p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="font-semibold text-ink-800 flex items-center gap-2"><Mail className="w-4 h-4 text-apple-500" /> Daily AI briefing</p>
              <p className="text-sm text-ink-500 mt-1">Every morning the AI scans your business, predicts tasks, and emails you a briefing with what needs attention.</p>
            </div>
            <button
              type="button"
              onClick={() => setDailyBriefing(!dailyBriefing)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${dailyBriefing ? 'bg-apple-500' : 'bg-ink-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${dailyBriefing ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Account details */}
        <div className="card p-6">
          <h2 className="font-semibold text-ink-800 mb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-apple-500" /> Account
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-ink-100">
              <span className="text-ink-500">Email</span>
              <span className="text-ink-800">{user?.email || '—'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-ink-100">
              <span className="text-ink-500">Plan</span>
              <span className="text-ink-800 capitalize">{profile?.plan}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-ink-100">
              <span className="text-ink-500">AI actions used</span>
              <span className="text-ink-800">{profile?.api_usage_count} / {profile?.api_usage_limit}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-ink-500">Member since</span>
              <span className="text-ink-800">
                {profile ? new Date(profile.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save profile changes
        </button>
      </div>
    </div>
  )
}
