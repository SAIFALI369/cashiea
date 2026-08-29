import { validateGstin, validateUpiId, validatePhone } from '../lib/validation'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import ThemeToggle from '../components/ThemeToggle'
import {
  Settings as SettingsIcon, Loader2, Save, Check,
  ShoppingCart, Brain, Mail, FileSignature, ScrollText, Database, History, Key,
  Shield, ShieldCheck, CreditCard, Network, LifeBuoy, ChevronRight, Sun,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import type { AIProvider } from '../lib/ai'
import { fetchBusinessMemory, saveOwnerNotes } from '../lib/useDailyIntelligence'

const providers: { value: AIProvider; label: string; desc: string }[] = [
  { value: 'openrouter', label: 'OpenRouter', desc: 'Gemini → Kimi → Llama auto-fallback' },
  { value: 'gemini', label: 'Google Gemini', desc: 'Fast & cost-effective' },
  { value: 'openai', label: 'OpenAI', desc: 'GPT-4o — most versatile' },
  { value: 'anthropic', label: 'Anthropic Claude', desc: 'Best for writing & reasoning' },
]

interface NavLinkItem { to: string; label: string; desc: string; icon: LucideIcon }
const WORKSPACE: NavLinkItem[] = [
  { to: '/app/pos', label: 'New Sale (POS)', desc: 'Ring up a sale', icon: ShoppingCart },
  { to: '/app/assistant', label: 'Ask AI (Meraj)', desc: 'Chat with Meraj', icon: Brain },
  { to: '/app/email-assistant', label: 'Email Assistant', desc: 'Draft customer emails', icon: Mail },
  { to: '/app/quotations', label: 'Quotations', desc: 'Price quotes', icon: FileSignature },
  { to: '/app/summaries', label: 'Summaries', desc: 'Summarize text', icon: ScrollText },
  { to: '/app/data-entry', label: 'Data Entry', desc: 'Extract data', icon: Database },
  { to: '/app/activity', label: 'Activity Logs', desc: 'Your history', icon: History },
]
const ACCOUNT_TOOLS: NavLinkItem[] = [
  { to: '/app/api-keys', label: 'API Keys', desc: 'For third-party integrations, if you use any', icon: Key },
  { to: '/app/integrations', label: 'Integrations', desc: 'Connect Cashiea to other tools', icon: Network },
  { to: '/app/compliance', label: 'Compliance', desc: 'Data handling and security info', icon: Shield },
  { to: '/app/permissions', label: 'Permissions', desc: 'Control what staff accounts can access', icon: ShieldCheck },
  { to: '/app/subscription', label: 'Subscription', desc: 'Plan & billing', icon: CreditCard },
  { to: '/app/support', label: 'Support', desc: 'Get help', icon: LifeBuoy },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-1 mb-2 text-[11px] font-bold tracking-[0.12em] uppercase text-fg-subtle">{title}</h2>
      <div className="card p-4 sm:p-5 space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-fg-subtle mt-1">{hint}</p>}
    </div>
  )
}

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
  const [aiProvider, setAiProvider] = useState<AIProvider>(profile?.ai_provider || 'openai')
  const [saving, setSaving] = useState(false)
  const [businessSummary, setBusinessSummary] = useState('')
  const [businessFacts, setBusinessFacts] = useState<string[]>([])
  const [ownerNotes, setOwnerNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [memoryLoading, setMemoryLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const id = profile.business_owner_id || profile.id
    fetchBusinessMemory(id).then((mem) => {
      if (mem) {
        setBusinessSummary(mem.summary || '')
        setBusinessFacts(Array.isArray(mem.key_facts) ? mem.key_facts.map((f: any) => typeof f === 'string' ? f : f?.fact || JSON.stringify(f)) : [])
        setOwnerNotes(mem.preferences?.owner_notes || '')
      }
      setMemoryLoading(false)
    })
  }, [profile])

  const handleSaveNotes = async () => {
    const id = profile?.business_owner_id || profile?.id
    if (!id) return
    setSavingNotes(true)
    const ok = await saveOwnerNotes(id, ownerNotes)
    toast.success(ok ? 'Notes saved — Meraj will use them' : 'Could not save')
    setSavingNotes(false)
  }

  const [gstinError, setGstinError] = useState<string | null>(null)
  const [upiError, setUpiError] = useState<string | null>(null)

  const validateFields = () => {
    const g = validateGstin(gstin)
    const u = validateUpiId(upiId)
    setGstinError(g.valid ? null : g.message || null)
    setUpiError(u.valid ? null : u.message || null)
    return g.valid && u.valid
  }

  const handleSave = async () => {
    if (!validateFields()) { toast.error('Please fix the errors first'); return }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName, company_name: companyName, gstin: gstin || null,
          business_address: businessAddress || null, business_state: businessState || null,
          upi_id: upiId || null, daily_briefing: dailyBriefing,
          report_time_utc: (() => {
            const [h, m] = reportTime.split(':').map(Number)
            let u = (h * 60 + m) - (5 * 60 + 30); if (u < 0) u += 24 * 60
            return `${String(Math.floor(u / 60)).padStart(2, '0')}:${String(u % 60).padStart(2, '0')}`
          })(),
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
      <PageHeader title="Settings" subtitle="Preferences, business profile, and AI" icon={<SettingsIcon className="w-5 h-5" />} />

      <div className="max-w-2xl space-y-6">
        {/* Preferences */}
        <Section title="Preferences">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-control bg-accent-soft text-accent flex items-center justify-center"><Sun className="w-[18px] h-[18px]" /></span>
              <div>
                <p className="text-sm font-semibold text-fg">Appearance</p>
                <p className="text-xs text-fg-subtle">Light or dark theme</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </Section>

        {/* Business profile */}
        <Section title="Business profile">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" placeholder="Jane Doe" /></Field>
            <Field label="Business name"><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-field" placeholder="Sharma General Store" /></Field>
            <Field label="GSTIN">
            <input value={gstin} onChange={(e) => { setGstin(e.target.value); setGstinError(null) }} className={`input-field font-mono ${gstinError ? 'border-negative' : ''}`} placeholder="22AAAAA0000A1Z5" />
            {gstinError && <p className="text-xs text-negative mt-1">{gstinError}</p>}
          </Field>
            <Field label="State"><input value={businessState} onChange={(e) => setBusinessState(e.target.value)} className="input-field" placeholder="Bihar" /></Field>
            <Field label="Business address"><input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="input-field" placeholder="123 Main St, City" /></Field>
            <Field label="UPI ID" hint="For instant invoice payments"><input value={upiId} onChange={(e) => setUpiId(e.target.value)} className="input-field font-mono" placeholder="myshop@okhdfcbank" /></Field>
            <Field label="Daily report time (IST)" hint="When your WhatsApp sales report arrives"><input type="time" value={reportTime} onChange={(e) => setReportTime(e.target.value)} className="input-field" /></Field>
          </div>
        </Section>

        {/* AI */}
        <Section title="AI">
          <div className="space-y-2.5">
            {providers.map((p) => {
              const selected = aiProvider === p.value
              return (
                <button key={p.value} onClick={() => setAiProvider(p.value)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-control border text-left transition-all ${selected ? 'border-accent bg-accent-soft/40' : 'border-line hover:bg-surface-2'}`}>
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-accent bg-accent' : 'border-line-2'}`}>
                    {selected && <Check className="w-3 h-3 text-accent-fg" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-fg">{p.label}</p>
                    <p className="text-xs text-fg-subtle">{p.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-line">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-accent" />
              <div>
                <p className="text-sm font-semibold text-fg">Daily AI briefing</p>
                <p className="text-xs text-fg-subtle">Morning tasks & what needs attention</p>
              </div>
            </div>
            <button type="button" onClick={() => setDailyBriefing(!dailyBriefing)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${dailyBriefing ? 'bg-accent' : 'bg-line-2'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${dailyBriefing ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </Section>

        {/* Plan & usage */}
        <Section title="Plan & usage">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-fg-subtle">Email</span><span className="text-fg truncate ml-2">{user?.email || '—'}</span></div>
            <div className="flex justify-between"><span className="text-fg-subtle">Plan</span><span className="text-fg capitalize">{profile?.plan}</span></div>
            <div className="flex justify-between"><span className="text-fg-subtle">Actions used</span><span className="text-fg">{profile?.api_usage_count} / {profile?.api_usage_limit}</span></div>
            <div className="flex justify-between"><span className="text-fg-subtle">Member since</span><span className="text-fg">{profile ? new Date(profile.created_at).toLocaleDateString() : '—'}</span></div>
          </div>
        </Section>

        {/* Workspace + account nav */}
        <Section title="Workspace">
          <div className="-mx-1">
            {WORKSPACE.map((it) => <NavRow key={it.to} {...it} />)}
          </div>
        </Section>
        <Section title="Account & security">
          <div className="-mx-1">
            {ACCOUNT_TOOLS.map((it) => <NavRow key={it.to} {...it} />)}
          </div>
        </Section>

        {/* Business insights — what Meraj knows + owner-editable notes */}
        <Section title="Business insights">
          <p className="text-sm text-fg-subtle mb-3">What Meraj knows about your business. Add your own notes below and Meraj will use them to give better advice.</p>
          {memoryLoading ? (
            <div className="flex items-center gap-2 text-sm text-fg-muted"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
          ) : (
            <>
              {businessSummary && (
                <div className="mb-3 p-3 rounded-control bg-surface-2">
                  <p className="text-xs font-semibold text-fg-subtle mb-1">Meraj's understanding</p>
                  <p className="text-sm text-fg leading-snug">{businessSummary}</p>
                </div>
              )}
              {businessFacts.length > 0 && (
                <div className="mb-3 space-y-1">
                  <p className="text-xs font-semibold text-fg-subtle mb-1">Key facts learned</p>
                  {businessFacts.slice(0, 5).map((f, i) => (
                    <p key={i} className="text-xs text-fg-muted flex items-start gap-1.5">
                      <span className="text-accent mt-0.5">●</span> {f}
                    </p>
                  ))}
                </div>
              )}
              <div>
                <label className="label">Your business notes</label>
                <textarea
                  value={ownerNotes}
                  onChange={(e) => setOwnerNotes(e.target.value)}
                  rows={4}
                  className="input-field resize-none"
                  placeholder="Add insights Meraj should know — supplier details, seasonal trends, customer preferences, business goals..."
                />
                <p className="text-[11px] text-fg-subtle mt-1">Non-confidential only. Meraj uses these for better advice.</p>
              </div>
              <button onClick={handleSaveNotes} disabled={savingNotes} className="btn-secondary text-sm mt-3">
                {savingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save notes
              </button>
            </>
          )}
        </Section>

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save changes
        </button>
      </div>
    </div>
  )
}

function NavRow({ to, label, desc, icon: Icon }: NavLinkItem) {
  return (
    <Link to={to} className="flex items-center gap-3 p-2.5 rounded-control hover:bg-surface-2 transition-colors group">
      <span className="w-9 h-9 rounded-control bg-surface-2 text-fg-muted group-hover:bg-accent-soft group-hover:text-accent flex items-center justify-center flex-shrink-0 transition-colors">
        <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="text-[11px] text-fg-subtle truncate">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-fg-subtle group-hover:text-fg" />
    </Link>
  )
}
