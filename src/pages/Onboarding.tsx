import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { onboardingQuestions, onboardingPersona, type OnboardingQuestion, type OnboardingPersona } from '../lib/ai'
import MerajDevice from '../components/MerajDevice'
import { ArrowRight, Check, Loader2, MapPin, MessageCircle, Store, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { value: 'Grocery / Kirana', icon: '🛒' },
  { value: 'Pharmacy', icon: '💊' },
  { value: 'Hardware / Building material', icon: '🔧' },
  { value: 'Electronics / Mobile', icon: '📱' },
  { value: 'Clothing / Fashion', icon: '👕' },
  { value: 'Restaurant / Bakery', icon: '🍽️' },
  { value: 'Beauty / Cosmetics', icon: '💄' },
  { value: 'Auto parts', icon: '🚗' },
  { value: 'Stationery / Books', icon: '📚' },
  { value: 'Agri supplies', icon: '🌾' },
  { value: 'Jewellery', icon: '💍' },
  { value: 'Other', icon: '🏪' },
]

/**
 * Onboarding — the 3-page signup wizard.
 *   Page 1: business basics (options-first, near-zero friction)
 *   Page 2: Meraj himself drafts 3-5 quick questions for THIS trade
 *   Page 3: Meraj becomes the shop's dedicated expert (pharmacy →
 *           doctor-style expert w/ seasonal medicine predictions, hardware →
 *           CEO/salesman, … — adapted even for custom categories)
 * The persona is stored in business_memory.preferences.persona and injected
 * into every future Meraj conversation by the ai-assistant edge function.
 */
export default function Onboarding() {
  const navigate = useNavigate()
  const { profile, ownerId, refreshProfile, loading: authLoading } = useAuth()

  const initialStep = profile?.onboarding_step && profile.onboarding_step >= 1 && profile.onboarding_step <= 3
    ? profile.onboarding_step
    : 1
  const [step, setStep] = useState(initialStep)
  const [saving, setSaving] = useState(false)

  // Page 1 — basics
  const [name, setName] = useState(profile?.company_name || '')
  const [category, setCategory] = useState(profile?.shop_category || '')
  const [customCategory, setCustomCategory] = useState('')
  const [city, setCity] = useState('')
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp_number || profile?.phone || '')

  // Page 2 — Meraj's questions
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  // Page 3 — the persona reveal
  const [persona, setPersona] = useState<OnboardingPersona | null>(null)
  const [loadingPersona, setLoadingPersona] = useState(false)

  const resolvedCategory = category === 'Other' ? customCategory.trim() : category
  const fetchedStep = useRef<number>(0)

  // Redirect if already done; resume at the saved step
  useEffect(() => {
    if (authLoading || !profile) return
    if (profile.onboarding_step >= 4) { navigate('/app', { replace: true }); return }
    setStep(profile.onboarding_step >= 1 && profile.onboarding_step <= 3 ? profile.onboarding_step : 1)
  }, [profile, authLoading, navigate])

  // Fetch Meraj's questions when entering page 2 (once)
  useEffect(() => {
    if (step !== 2 || questions.length || loadingQuestions || fetchedStep.current === 2) return
    fetchedStep.current = 2
    ;(async () => {
      setLoadingQuestions(true)
      try {
        const qs = await onboardingQuestions({ category: resolvedCategory || 'retail', businessName: name || undefined, city: city || undefined })
        setQuestions(qs)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not load questions — tap retry')
      } finally { setLoadingQuestions(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Build the persona when entering page 3 (once)
  useEffect(() => {
    if (step !== 3 || persona || loadingPersona || fetchedStep.current === 3) return
    fetchedStep.current = 3
    ;(async () => {
      setLoadingPersona(true)
      try {
        const p = await onboardingPersona({ category: resolvedCategory || 'retail', businessName: name || undefined, city: city || undefined, answers })
        setPersona(p)
      } catch (e) {
        // Deterministic fallback so onboarding never blocks
        setPersona({
          headline: `Your ${resolvedCategory || 'Business'} Expert`,
          persona: `Meraj is your dedicated ${(resolvedCategory || 'retail').toLowerCase()} business manager. He tracks your sales, stock, and customers every day, spots what sells and what stalls, and tells you plainly what to do next.`,
          skills: ['Watches daily sales and profit', 'Predicts seasonal demand', 'Flags low stock before you run out', 'Suggests customer follow-ups'],
        })
        toast.error(e instanceof Error ? e.message : 'Showing a default persona')
      } finally { setLoadingPersona(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Merge-patch business_memory (read → merge → upsert; only sent columns update)
  const saveMemory = async (patch: { business_type?: string; facts?: string[]; preferences?: Record<string, any> }) => {
    const { data: existing } = await supabase.from('business_memory').select('key_facts, preferences').eq('user_id', ownerId).maybeSingle()
    const facts = [...(Array.isArray(existing?.key_facts) ? existing.key_facts : []), ...(patch.facts || [])]
    const preferences = { ...((existing?.preferences && typeof existing.preferences === 'object') ? existing.preferences : {}), ...(patch.preferences || {}) }
    const { error } = await supabase.from('business_memory').upsert({
      user_id: ownerId,
      ...(patch.business_type ? { business_type: patch.business_type } : {}),
      key_facts: facts,
      preferences,
      last_updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) throw error
  }

  // ── Page 1: save basics ─────────────────────────────────────────
  const finishStep1 = async () => {
    if (!category || (category === 'Other' && !customCategory.trim())) return toast.error('Pick your shop type')
    setSaving(true)
    try {
      const { error } = await supabase.rpc('update_onboarding_step', { step: 1, data: { shop_category: resolvedCategory } })
      if (error) throw error
      // Name + city are direct profile fields the owner may always edit
      const profilePatch: Record<string, string> = {}
      if (name.trim()) profilePatch.company_name = name.trim()
      if (city.trim()) profilePatch.business_address = city.trim()
      if (Object.keys(profilePatch).length) {
        await supabase.from('profiles').update(profilePatch).eq('id', ownerId)
      }
      await refreshProfile()
      setStep(2)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally { setSaving(false) }
  }

  // ── Page 2: save Meraj's answers as business facts ─────────────
  const finishStep2 = async () => {
    setSaving(true)
    try {
      const facts = Object.entries(answers)
        .filter(([, a]) => a && a.trim())
        .map(([q, a]) => `${q} → ${a.trim()}`)
      if (city.trim()) facts.unshift(`Located in ${city.trim()}`)
      if (facts.length) await saveMemory({ business_type: resolvedCategory, facts })
      const { error } = await supabase.rpc('update_onboarding_step', { step: 2, data: {} })
      if (error) throw error
      await refreshProfile()
      setStep(3)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally { setSaving(false) }
  }

  // ── Page 3: store the persona, finish ───────────────────────────
  const finishStep3 = async () => {
    setSaving(true)
    try {
      if (persona) {
        await saveMemory({ preferences: { persona: persona.persona, persona_headline: persona.headline, persona_skills: persona.skills, onboarded: true } })
      }
      const { error } = await supabase.rpc('update_onboarding_step', {
        step: 3,
        data: whatsapp.trim() ? { whatsapp_number: whatsapp.trim() } : {},
      })
      if (error) throw error
      await refreshProfile()
      toast.success(`Welcome to Cashiea — ${persona?.headline || "you're all set"}!`)
      navigate('/app', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally { setSaving(false) }
  }

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-fg-subtle" />
      </div>
    )
  }

  // Onboarding changes the business owner's profile and shared memory. A
  // linked team account (even one with onboarding_step = 5) must never reach
  // this screen by typing the URL directly.
  if (profile.role !== 'owner' || profile.business_owner_id) {
    return <Navigate to="/app" replace />
  }

  const steps = [
    { n: 1, label: 'Your shop' },
    { n: 2, label: 'Meraj asks' },
    { n: 3, label: 'Meraj adapts' },
  ]

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Progress */}
      <div className="pt-8 pb-2 px-4">
        <div className="flex items-center justify-center gap-3">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > s.n ? 'bg-positive text-paper' : step === s.n ? 'bg-accent text-accent-fg scale-110' : 'bg-surface-2 text-fg-subtle'
                }`}>
                  {step > s.n ? <Check className="w-4 h-4" /> : s.n}
                </div>
                <span className={`text-xs ${step >= s.n ? 'text-fg-muted' : 'text-fg-subtle'}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-10 sm:w-16 h-0.5 mx-1.5 mb-5 ${step > s.n ? 'bg-positive' : 'bg-line'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-start sm:items-center justify-center px-4 py-6 pb-12 overflow-y-auto">
        <div className="w-full max-w-lg">

          {/* ── PAGE 1: business basics ── */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-11 h-11 rounded-control bg-accent-soft text-accent flex items-center justify-center flex-shrink-0"><Store className="w-5 h-5" /></span>
                <div>
                  <h1 className="text-xl font-bold text-fg leading-tight">Tell us about your shop</h1>
                  <p className="text-sm text-fg-muted">60 seconds — then Meraj takes over.</p>
                </div>
              </div>

              <div className="card p-5 space-y-5">
                <div>
                  <label className="label">Shop name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g. Sharma Medical Store" />
                </div>

                <div>
                  <label className="label">What kind of shop is it?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setCategory(c.value)}
                        className={`flex flex-col items-center gap-1.5 rounded-control border p-3 transition-all active:scale-95 ${
                          category === c.value ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-fg-muted hover:border-accent/40'
                        }`}
                      >
                        <span className="text-xl leading-none">{c.icon}</span>
                        <span className="text-[11px] font-semibold text-center leading-tight">{c.value}</span>
                      </button>
                    ))}
                  </div>
                  {category === 'Other' && (
                    <input
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="input-field mt-2"
                      placeholder="Type your shop type — e.g. Medical lab, Photostudio…"
                      autoFocus
                    />
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label"><MapPin className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />City <span className="text-fg-subtle font-normal">(optional)</span></label>
                    <input value={city} onChange={(e) => setCity(e.target.value)} className="input-field" placeholder="e.g. Gaya" />
                  </div>
                  <div>
                    <label className="label"><MessageCircle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />WhatsApp <span className="text-fg-subtle font-normal">(optional)</span></label>
                    <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="input-field" placeholder="For daily reports" inputMode="tel" />
                  </div>
                </div>

                <button onClick={finishStep1} disabled={saving} className="btn-primary w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* ── PAGE 2: Meraj's questions ── */}
          {step === 2 && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-5">
                <MerajDevice interactionState="idle" size="md" context="panel" />
                <div>
                  <h1 className="text-xl font-bold text-fg leading-tight">Meraj has a few quick questions</h1>
                  <p className="text-sm text-fg-muted">Tap to answer — 30 seconds, skippable.</p>
                </div>
              </div>

              <div className="card p-5">
                {loadingQuestions ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <MerajDevice interactionState="thinking" size="md" context="panel" />
                    <p className="text-sm text-fg-muted">Meraj is thinking about your {resolvedCategory || 'shop'}…</p>
                  </div>
                ) : questions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <p className="text-sm text-fg-muted">Couldn't load the questions.</p>
                    <button
                      onClick={() => { fetchedStep.current = 0; setQuestions([]) }}
                      className="btn-secondary text-sm"
                    >
                      <Sparkles className="w-4 h-4" /> Retry
                  </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {questions.map((q, i) => (
                      <div key={i}>
                        <p className="text-sm font-semibold text-fg mb-2">{i + 1}. {q.q}</p>
                        {q.type === 'choice' && Array.isArray(q.options) && q.options.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {q.options.map((opt) => (
                              <button
                                key={opt}
                                onClick={() => setAnswers((a) => ({ ...a, [q.q]: opt }))}
                                className={`text-xs font-semibold rounded-full border px-3.5 py-2 transition-all active:scale-95 ${
                                  answers[q.q] === opt ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-fg-muted hover:border-accent/40'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <input
                            value={answers[q.q] || ''}
                            onChange={(e) => setAnswers((a) => ({ ...a, [q.q]: e.target.value }))}
                            className="input-field"
                            placeholder="Type a short answer…"
                          />
                        )}
                      </div>
                    ))}
                    <button onClick={finishStep2} disabled={saving} className="btn-primary w-full">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PAGE 3: Meraj becomes YOUR expert ── */}
          {step === 3 && (
            <div className="animate-fade-in">
              <div className="card p-6 sm:p-8 text-center">
                {loadingPersona || !persona ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-4">
                    <MerajDevice interactionState="thinking" size="lg" context="panel" />
                    <p className="text-sm text-fg-muted">
                      Meraj is becoming your {resolvedCategory || 'business'} expert…
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center mb-3">
                      <MerajDevice interactionState="idle" size="lg" context="panel" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-accent mb-1">Meraj is now</p>
                    <h1 className="text-2xl font-bold text-fg leading-tight mb-3">{persona.headline}</h1>
                    <p className="text-sm text-fg-muted leading-relaxed mb-5">{persona.persona}</p>
                    {persona.skills.length > 0 && (
                      <div className="text-left space-y-2 mb-6 max-w-sm mx-auto">
                        {persona.skills.map((s, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-positive/10 text-positive flex items-center justify-center flex-shrink-0 mt-0.5"><Check className="w-3 h-3" /></span>
                            <p className="text-sm text-fg">{s}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={finishStep3} disabled={saving} className="btn-primary w-full">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Start using Cashiea <ArrowRight className="w-4 h-4" /></>}
                    </button>
                    <p className="text-xs text-fg-subtle mt-3">Chat with Meraj anytime — he already knows your shop.</p>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
