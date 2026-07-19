import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  Sparkles, Store, ShoppingCart, Smartphone, ArrowRight, ArrowLeft,
  Plus, X, Check, Loader2, Tag, Package, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { value: 'Grocery', icon: '🛒', desc: 'Kirana, provisions, daily needs' },
  { value: 'Electronics', icon: '📱', desc: 'Phones, gadgets, accessories' },
  { value: 'Clothing', icon: '👕', desc: 'Apparel, fashion, textiles' },
  { value: 'Pharmacy', icon: '💊', desc: 'Medicines, health, wellness' },
  { value: 'Hardware', icon: '🔧', desc: 'Tools, building materials, paint' },
  { value: 'Restaurant', icon: '🍽️', desc: 'Food, cafe, cloud kitchen' },
  { value: 'Other', icon: '🏪', desc: 'Something else' },
]

interface InvItem { name: string; quantity: string }

export default function Onboarding() {
  const navigate = useNavigate()
  const { profile, refreshProfile, loading: authLoading } = useAuth()

  // Start from wherever the user left off (resume-on-reload)
  const initialStep = profile?.onboarding_step && profile.onboarding_step >= 1 && profile.onboarding_step <= 3
    ? profile.onboarding_step
    : 1
  const [step, setStep] = useState(initialStep)
  const [saving, setSaving] = useState(false)

  // Step 1: category
  const [category, setCategory] = useState(profile?.shop_category || '')

  // Step 2: 3 inventory items
  const [items, setItems] = useState<InvItem[]>([
    { name: '', quantity: '' },
    { name: '', quantity: '' },
    { name: '', quantity: '' },
  ])

  // Step 3: WhatsApp number (separate from login phone) + report time
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp_number || profile?.phone || '')
  const [reportTime, setReportTime] = useState('22:30')  // IST display; default 10:30 PM IST

  // Wait for auth/profile to load before showing the wizard
  useEffect(() => {
    if (authLoading) return
    if (!profile) return
    // If they already finished onboarding, skip straight to dashboard
    if (profile.onboarding_step >= 4) {
      navigate('/app', { replace: true })
      return
    }
    // Resume at saved step
    if (profile.onboarding_step >= 1 && profile.onboarding_step <= 3) {
      setStep(profile.onboarding_step)
      setCategory(profile.shop_category || '')
      setWhatsapp(profile.whatsapp_number || profile.phone || '')
    }
  }, [profile, authLoading, navigate])

  // ── Step 1: save category ──────────────────────────────────────
  const finishStep1 = async () => {
    if (!category) return toast.error('Pick a category')
    setSaving(true)
    try {
      const { error } = await supabase.rpc('update_onboarding_step', {
        step: 1, data: { shop_category: category },
      })
      if (error) throw error
      await refreshProfile()
      setStep(2)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally { setSaving(false) }
  }

  // ── Step 2: insert inventory items ─────────────────────────────
  const updateItem = (i: number, field: keyof InvItem, val: string) => {
    const next = [...items]; next[i] = { ...next[i], [field]: val }; setItems(next)
  }
  const addItem = () => setItems([...items, { name: '', quantity: '' }])
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))

  const finishStep2 = async () => {
    const valid = items.filter((it) => it.name.trim())
    if (valid.length === 0) return toast.error('Add at least one product')
    setSaving(true)
    try {
      // Insert the products
      const rows = valid.map((it) => ({
        user_id: profile!.id,
        name: it.name.trim(),
        stock_quantity: Number(it.quantity) || 0,
        category: 'general',
        price: 0, cost: 0,
      }))
      const { error: insertErr } = await supabase.from('products').insert(rows)
      if (insertErr) throw insertErr

      // Mark step 2 done
      const { error: rpcErr } = await supabase.rpc('update_onboarding_step', { step: 2, data: {} })
      if (rpcErr) throw rpcErr
      await refreshProfile()
      setStep(3)
      toast.success(`${valid.length} products added!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally { setSaving(false) }
  }

  // ── Step 3: WhatsApp number + report time + finish ────────────
  const finishStep3 = async () => {
    if (!whatsapp.trim()) return toast.error('Enter a WhatsApp number')
    setSaving(true)
    try {
      // Convert IST HH:MM -> UTC HH:MM (IST = UTC+5:30)
      const [h, m] = reportTime.split(':').map(Number)
      let utcMin = (h * 60 + m) - (5 * 60 + 30)
      if (utcMin < 0) utcMin += 24 * 60
      const utcH = Math.floor(utcMin / 60)
      const utcM = utcMin % 60
      const reportTimeUtc = `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`

      const { error } = await supabase.rpc('update_onboarding_step', {
        step: 3,
        data: { whatsapp_number: whatsapp.trim(), report_time_utc: reportTimeUtc },
      })
      if (error) throw error
      await refreshProfile()
      toast.success('You are all set! Welcome to BizAutomate')
      navigate('/app', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally { setSaving(false) }
  }

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    )
  }

  const steps = [
    { n: 1, label: 'Category' },
    { n: 2, label: 'Products' },
    { n: 3, label: 'WhatsApp' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Progress dots (Typeform-style) */}
      <div className="pt-8 pb-4">
        <div className="flex items-center justify-center gap-3">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center">
              <div className={`flex flex-col items-center gap-1.5`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > s.n ? 'bg-green-500 text-white' :
                  step === s.n ? 'bg-brand-500 text-white scale-110' :
                  'bg-slate-800 text-slate-500'
                }`}>
                  {step > s.n ? <Check className="w-4 h-4" /> : s.n}
                </div>
                <span className={`text-xs ${step >= s.n ? 'text-slate-300' : 'text-slate-600'}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-10 sm:w-16 h-0.5 mx-1.5 mb-5 ${step > s.n ? 'bg-green-500' : 'bg-slate-800'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Let\u2019s set up your shop</h1>
            <p className="text-slate-400 text-sm mt-1">Takes under a minute \u2014 you\u2019re on step {step} of 3</p>
          </div>

          {/* Step 1: Category */}
          {step === 1 && (
            <div className="card p-6 animate-fade-in">
              <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
                <Tag className="w-5 h-5 text-brand-400" /> What do you sell?
              </h2>
              <p className="text-sm text-slate-400 mb-4">Pick the closest match. Helps us tailor reports & insights.</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                      category === c.value ? 'border-brand-600 bg-brand-600/10' : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-2xl">{c.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">{c.value}</p>
                      <p className="text-xs text-slate-500 truncate">{c.desc}</p>
                    </div>
                    {category === c.value && <Check className="w-4 h-4 text-brand-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
              <button onClick={finishStep1} disabled={saving || !category} className="btn-primary w-full mt-5 py-3">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-5 h-5" /></>}
              </button>
            </div>
          )}

          {/* Step 2: First 3 products */}
          {step === 2 && (
            <div className="card p-6 animate-fade-in">
              <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
                <Package className="w-5 h-5 text-brand-400" /> Add your first products
              </h2>
              <p className="text-sm text-slate-400 mb-4">Add at least one. You can do everything else later.</p>
              <div className="space-y-2.5">
                {items.map((it, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={it.name}
                      onChange={(e) => updateItem(i, 'name', e.target.value)}
                      className="input-field flex-1"
                      placeholder={`Product ${i + 1} name`}
                    />
                    <input
                      type="number"
                      value={it.quantity}
                      onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                      className="input-field w-24"
                      placeholder="Qty"
                    />
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="text-slate-500 hover:text-red-400 px-2">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addItem} className="btn-ghost text-xs mt-3">
                <Plus className="w-3.5 h-3.5" /> Add another
              </button>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setStep(1)} className="btn-secondary py-3">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button onClick={finishStep2} disabled={saving} className="btn-primary flex-1 py-3">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Add & Continue <ArrowRight className="w-5 h-5" /></>}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: WhatsApp number + report time */}
          {step === 3 && (
            <div className="card p-6 animate-fade-in">
              <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-brand-400" /> Where should we send alerts?
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                Daily closing reports, low-stock alerts, and payment notifications go to this WhatsApp number.
                Separate from your login phone.
              </p>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="input-field pl-11"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="mt-4">
                <label className="label flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-400" /> Daily report time (IST)
                </label>
                <input
                  type="time"
                  value={reportTime}
                  onChange={(e) => setReportTime(e.target.value)}
                  className="input-field"
                />
                <p className="text-xs text-slate-500 mt-1">
                  When should your daily sales report arrive each day? Default 10:30 PM IST. Change anytime in Settings.
                </p>
              </div>

              <p className="text-xs text-slate-500 mt-2">
                \u2709\ufe0f We\u2019ll never spam. You can change this anytime in Settings.
              </p>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setStep(2)} className="btn-secondary py-3">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button onClick={finishStep3} disabled={saving || !whatsapp.trim()} className="btn-primary flex-1 py-3">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Finish Setup <Check className="w-5 h-5" /></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
