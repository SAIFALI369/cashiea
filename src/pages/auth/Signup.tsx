import { validatePassword, validateEmail, validatePhone } from '../../lib/validation'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft, ArrowRight, Check, Store, Phone, User, MapPin, Zap, TrendingUp, Shield, ShieldCheck, Timer, BadgeCheck, WifiOff, MessageCircle, Receipt, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { friendlyAuthError } from '../../lib/auth-errors'
import { useInputFocus, FOCUS_SCROLL_CLASS } from '../../lib/useInputFocus'

function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="rgb(var(--accent))" /><stop offset="100%" stopColor="rgb(var(--gold))" /></linearGradient></defs>
      <rect width="100" height="100" rx="24" fill="url(#sg)" />
      <path d="M62 28 A26 26 0 1 0 62 72" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" />
      <circle cx="55" cy="50" r="5" fill="white" />
      <path d="M55 30L55 42M55 58L55 70M35 50L47 50M63 50L75 50" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}

const C = { bg: 'rgb(var(--paper))', bgCard: 'rgb(var(--surface))', border: 'rgb(var(--line))', blue: 'rgb(var(--accent))', blueDark: 'rgb(var(--accent-strong))', blueLight: 'rgb(var(--gold))', green: 'rgb(var(--positive))', text: 'rgb(var(--fg))', textBody: 'rgb(var(--fg-muted))', muted: 'rgb(var(--fg-subtle))', red: 'rgb(var(--negative))', amber: 'rgb(var(--warning))' }

// ── Defined at MODULE scope on purpose ─────────────────────────────
// Defined inside the component before, every keystroke remounted the
// <input>, dropping focus and dismissing the mobile keyboard.
function Input({ icon: Icon, focusProps, ...props }: any) {
  return (
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors z-10" style={{ color: C.muted }} />
      <input
        {...props}
        {...focusProps}
        className={`${FOCUS_SCROLL_CLASS} w-full pl-12 pr-4 py-3.5 rounded-xl text-base outline-none transition-all duration-200`}
        style={{ background: 'rgb(var(--surface))', border: `1px solid ${C.border}`, color: C.text, boxShadow: '0 1px 2px rgb(var(--shadow) / 0.04)' }}
      />
    </div>
  )
}

// Password strength calculator
function getStrength(pwd: string): { label: string; color: string; pct: number } {
  if (!pwd) return { label: '', color: C.border, pct: 0 }
  let score = 0
  if (pwd.length >= 6) score++
  if (pwd.length >= 10) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (pwd.length >= 14) score++
  const levels = [
    { label: 'Too short', color: C.red, pct: 20 },
    { label: 'Weak', color: C.red, pct: 40 },
    { label: 'Fair', color: C.amber, pct: 60 },
    { label: 'Good', color: C.green, pct: 80 },
    { label: 'Strong', color: C.green, pct: 100 },
  ]
  return levels[score] || levels[0]
}

const GUARANTEES = [
  { icon: BadgeCheck, text: 'Free for 14 days' },
  { icon: ShieldCheck, text: 'No card required' },
  { icon: Timer, text: 'Setup in 5 minutes' },
  { icon: WifiOff, text: 'Works offline' },
  { icon: ShieldCheck, text: 'DPDP-ready' },
]

const LEFT_LIST = [
  { icon: Sparkles, text: 'Meraj does billing, reports & follow-ups — 90% of a manager’s work' },
  { icon: MessageCircle, text: 'Daily sales report + payment reminders on WhatsApp' },
  { icon: Receipt, text: 'GST-ready invoices, khata and stock alerts built in' },
  { icon: Shield, text: 'Your data stays yours. Cancel anytime.' },
]

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [shopName, setShopName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agree, setAgree] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const strength = getStrength(password)

  // Mobile-friendly focus: keeps the focused input in view when the
  // on-screen keyboard opens so the keyboard doesn't auto-dismiss.
  const focusProps = useInputFocus({ focusBorderColor: C.blue, focusShadow: `0 0 0 3px ${C.blue}15`, blurBorderColor: C.border })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!fullName.trim() || !shopName.trim() || !phone.trim()) { setError('Please fill in all required fields.'); return }
    if (!agree) { setError('Please accept the Terms to continue.'); return }
    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) { setError(pwCheck.message || 'Invalid password'); return }
    const emailCheck = validateEmail(email)
    if (!emailCheck.valid) { setError(emailCheck.message || 'Invalid email'); return }
    const phoneCheck = validatePhone(phone)
    if (!phoneCheck.valid) { setError(phoneCheck.message || 'Invalid phone'); return }
    setLoading(true)
    try {
      await signUp(email, password, fullName, shopName, phone)
      navigate('/app/onboarding', { replace: true })
    } catch (err) {
      if (err instanceof Error && err.message === 'EMAIL_CONFIRMATION_REQUIRED') {
        setNeedsConfirmation(true)
      } else {
        setError(friendlyAuthError(err, 'Could not create account. Please try again.'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (needsConfirmation) {
    return (
      <div className="flex items-center justify-center p-4" style={{ background: C.bg, minHeight: '100dvh' }}>
        <div className="max-w-md w-full text-center" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: C.blue + '12' }}><Mail className="w-10 h-10" style={{ color: C.blue }} /></div>
          <h2 className="font-bold text-xl mb-3" style={{ fontFamily: '"Plus Jakarta Sans"', color: C.text }}>Check your email</h2>
          <p className="mb-6 leading-relaxed" style={{ color: C.textBody }}>We sent a confirmation link to <span className="font-semibold" style={{ color: C.text }}>{email}</span>. Click it to activate your account.</p>
          <div className="p-4 rounded-xl text-left mb-6" style={{ background: 'rgb(var(--warning) / 0.12)', border: '1px solid rgb(var(--warning) / 0.3)' }}>
            <p className="text-sm" style={{ color: 'rgb(var(--warning))' }}><strong>Tip:</strong> To skip this for testing, go to Supabase Dashboard → Authentication → Email → turn off "Confirm email".</p>
          </div>
          <Link to="/login" className="inline-flex font-semibold text-white px-8 py-3.5 rounded-xl transition-all hover:scale-[1.02]" style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})` }}>Go to Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen" style={{ background: C.bg }}>
      {/* ═══ LEFT: Brand Panel ═══ */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] p-12 xl:p-16 relative overflow-hidden" style={{ background: `linear-gradient(145deg, ${C.blueDark} 0%, ${C.blue} 100%)`, minHeight: '100dvh' }}>
        <div className="absolute top-24 right-0 w-[26rem] h-[26rem] rounded-full" style={{ background: `radial-gradient(circle, ${C.blueLight}30 0%, transparent 70%)` }} />
        <div className="absolute -bottom-24 -left-16 w-96 h-96 rounded-full" style={{ background: `radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)` }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center p-1.5 shadow-float"><Logo size={36} /></div>
            <div>
              <span className="text-white font-bold text-xl" style={{ fontFamily: '"Plus Jakarta Sans"' }}>Cashiea</span>
              <p className="text-white/60 text-[11px] font-mono uppercase tracking-wider">AI for your shop</p>
            </div>
          </div>

          <h1 className="text-white font-bold mb-6" style={{ fontFamily: '"Plus Jakarta Sans"', fontSize: '38px', lineHeight: 1.2 }}>
            Your shop’s hardest worker<br />is now <span style={{ color: 'rgb(var(--gold))' }}>one form away.</span>
          </h1>
          <p className="text-white/75 text-lg leading-relaxed mb-9 max-w-md">
            Start free for 14 days. If Meraj doesn’t recover at least one pending payment or save you an evening of bookkeeping in that time, walk away. No card. No lock-in.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-9 max-w-md">
            {[
              { stat: '6 hrs', label: 'saved/week' },
              { stat: '₹12K', label: 'extra/month' },
              { stat: '90%', label: 'faster billing' },
            ].map((s, i) => (
              <div key={i} className="text-center p-3 rounded-2xl bg-white/10 backdrop-blur border border-white/10" style={{ animation: `slideUp 0.5s ease-out ${0.3 + i * 0.1}s both` }}>
                <p className="text-xl font-bold text-white">{s.stat}</p>
                <p className="text-xs text-white/60">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3 max-w-md">
            {LEFT_LIST.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-white/90 p-3 rounded-2xl bg-white/[0.07] border border-white/10" style={{ animation: `slideUp 0.5s ease-out ${0.55 + i * 0.1}s both` }}>
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0"><item.icon className="w-4 h-4" /></div>
                <span className="text-sm leading-relaxed">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-12 rounded-3xl p-5 bg-white/10 backdrop-blur-xl border border-white/15" style={{ animation: 'slideUp 0.6s ease-out 0.8s both' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1 text-white"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>
            <MonoLabel /> 
          </div>
          <p className="text-sm text-white/90 leading-relaxed">“I used to lose maybe ₹8,000–₹10,000 a month in forgotten udhaar. Now Meraj reminds them, and most people pay.”</p>
          <p className="mt-3 text-xs font-semibold text-white">{'Ramesh Kumar'} · <span className="text-white/65">Kirana, Patna</span></p>
        </div>

        <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      </div>

      {/* ═══ RIGHT: Signup Form ═══ */}
      <div className="flex-1 flex items-start justify-center p-4 sm:p-8 py-10 overflow-y-auto cashiea-form-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="w-full max-w-[480px] py-6" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
          <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <Logo size={40} />
            <div>
              <span className="font-bold text-xl" style={{ fontFamily: '"Plus Jakarta Sans"', color: C.text }}>Cashiea</span>
              <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: C.muted }}>AI for your shop</p>
            </div>
          </div>

          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors" style={{ color: C.muted }} onMouseEnter={e => e.currentTarget.style.color = C.blue} onMouseLeave={e => e.currentTarget.style.color = C.muted}>
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          <h2 className="font-bold mb-1" style={{ fontFamily: '"Plus Jakarta Sans"', fontSize: '30px', color: C.text }}>Create your shop’s <span style={{ color: C.blue }}>smart manager.</span></h2>
          <p className="mb-4" style={{ fontSize: '16px', color: C.muted }}>Free for 14 days. No credit card. Cancel anytime.</p>

          <div className="flex flex-wrap gap-2 mb-6">
            {GUARANTEES.map((g) => (
              <span key={g.text} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium" style={{ color: C.textBody }}>
                <g.icon className="w-3.5 h-3.5" style={{ color: C.blue }} /> {g.text}
              </span>
            ))}
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl text-sm animate-fade-in flex items-center gap-2" style={{ background: C.red + '10', border: `1px solid ${C.red}30`, color: C.red }}>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name + Shop name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: C.text }}>Your Name *</label>
                <Input icon={User} focusProps={focusProps} type="text" required value={fullName} onChange={(e: any) => setFullName(e.target.value)} placeholder="Ramesh Kumar" autoComplete="name" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: C.text }}>Shop Name *</label>
                <Input icon={Store} focusProps={focusProps} type="text" required value={shopName} onChange={(e: any) => setShopName(e.target.value)} placeholder="Sharma Store" autoComplete="organization" />
              </div>
            </div>

            {/* Phone + City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: C.text }}>Phone *</label>
                <Input icon={Phone} focusProps={focusProps} type="tel" required value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" inputMode="tel" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: C.text }}>City</label>
                <Input icon={MapPin} focusProps={focusProps} type="text" value={city} onChange={(e: any) => setCity(e.target.value)} placeholder="Gaya" autoComplete="address-level2" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.text }}>Email *</label>
              <Input icon={Mail} focusProps={focusProps} type="email" required value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="you@shop.com" autoComplete="email" inputMode="email" />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.text }}>Password *</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10" style={{ color: C.muted }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  {...focusProps}
                  className={`${FOCUS_SCROLL_CLASS} w-full pl-12 pr-12 py-3.5 rounded-xl text-base outline-none transition-all duration-200`}
                  style={{ background: 'rgb(var(--surface))', border: `1px solid ${C.border}`, color: C.text, boxShadow: '0 1px 2px rgb(var(--shadow) / 0.04)' }}
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: C.muted }} onMouseEnter={e => e.currentTarget.style.color = C.blue} onMouseLeave={e => e.currentTarget.style.color = C.muted}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {/* Strength bar */}
              {password && (
                <div className="mt-2 flex items-center gap-2 animate-fade-in">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${strength.pct}%`, background: strength.color }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <div className="relative mt-0.5">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="sr-only peer" />
                <div className="w-5 h-5 rounded-md border-2 transition-all peer-checked:bg-info peer-checked:border-info flex items-center justify-center" style={{ borderColor: C.border }}>
                  {agree && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
              </div>
              <span className="text-sm leading-relaxed" style={{ color: C.textBody }}>
                I agree to Cashiea's{' '}
                <Link to="/terms" className="font-medium transition-colors" style={{ color: C.blue }}>Terms</Link> and{' '}
                <Link to="/privacy" className="font-medium transition-colors" style={{ color: C.blue }}>Privacy Policy</Link>
              </span>
            </label>

            {/* Submit */}
            <button type="submit" disabled={loading} className="w-full font-semibold text-white py-4 rounded-xl transition-all hover:scale-[1.01] hover:shadow-xl flex items-center justify-center gap-2" style={{ fontSize: '16px', background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`, boxShadow: `0 8px 24px ${C.blue}25` }}>
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Creating account...</> : <>Create Free Account <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

          {/* Trust footer */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: C.muted }}><ShieldCheck className="w-3.5 h-3.5" style={{ color: C.green }} /> DPDP-ready</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: C.muted }}><Shield className="w-3.5 h-3.5" style={{ color: C.green }} /> Your data stays yours</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: C.muted }}><Zap className="w-3.5 h-3.5" style={{ color: C.green }} /> No lock-in</span>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px" style={{ background: C.border }} />
            <span className="text-sm" style={{ color: C.muted }}>or</span>
            <div className="flex-1 h-px" style={{ background: C.border }} />
          </div>

          <p className="text-center text-sm" style={{ color: C.textBody }}>
            Already have an account?{' '}
            <Link to="/login" className="font-bold transition-colors" style={{ color: C.blue }} onMouseEnter={e => e.currentTarget.style.color = C.blueDark} onMouseLeave={e => e.currentTarget.style.color = C.blue}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function MonoLabel() {
  return <span className="text-[10px] font-mono uppercase tracking-wider text-white/60">Verified owner</span>
}
