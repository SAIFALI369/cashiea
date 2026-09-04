import { validatePassword, validateEmail, validatePhone } from '../../lib/validation'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft, ArrowRight, Check, Store, Phone, User, MapPin, Zap, TrendingUp, Shield } from 'lucide-react'
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
      <path d="M55 30 L55 42 M55 58 L55 70 M35 50 L47 50 M63 50 L75 50" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}

// ── Defined at MODULE scope on purpose ─────────────────────────────
// Defined inside the component before, every keystroke remounted the
// <input>, dropping focus and dismissing the mobile keyboard.
function Input({ icon: Icon, focusProps, ...props }: any) {
  return (
    <div className="relative group">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 text-fg-subtle pointer-events-none transition-colors group-focus-within:text-accent" />
      <input
        {...props}
        {...focusProps}
        className={`${FOCUS_SCROLL_CLASS} w-full pl-12 pr-4 py-3.5 rounded-xl text-base bg-surface border border-line text-fg
                    placeholder:text-fg-subtle outline-none transition-all duration-200 ease-butter
                    focus:border-accent focus:ring-4 focus:ring-accent/15`}
      />
    </div>
  )
}

// Password strength calculator (semantic tone classes)
function getStrength(pwd: string): { label: string; tone: string; pct: number } {
  if (!pwd) return { label: '', tone: 'bg-line-2 text-fg-subtle', pct: 0 }
  let score = 0
  if (pwd.length >= 6) score++
  if (pwd.length >= 10) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (pwd.length >= 14) score++
  const levels = [
    { label: 'Too short', tone: 'bg-negative text-negative', pct: 20 },
    { label: 'Weak', tone: 'bg-negative text-negative', pct: 40 },
    { label: 'Fair', tone: 'bg-warning text-warning', pct: 60 },
    { label: 'Good', tone: 'bg-positive text-positive', pct: 80 },
    { label: 'Strong', tone: 'bg-positive text-positive', pct: 100 },
  ]
  return levels[score] || levels[0]
}

const CATEGORIES = ['Grocery / Kirana', 'Electronics', 'Pharmacy', 'Clothing / Fashion', 'Hardware / Building', 'Restaurant / Food', 'Other']

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
  const focusProps = useInputFocus({
    focusBorderColor: 'rgb(var(--accent))',
    focusShadow: '0 0 0 3px rgb(var(--accent) / 0.15)',
    blurBorderColor: 'rgb(var(--line))',
  })

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
      <div className="flex items-center justify-center p-4 bg-paper min-h-dvh">
        <div className="max-w-md w-full text-center animate-fade-in">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute -inset-3 rounded-full bg-accent/10 blur-xl" aria-hidden="true" />
            <div className="relative w-20 h-20 rounded-full mx-auto flex items-center justify-center bg-accent-soft">
              <Mail className="w-10 h-10 text-accent-strong" />
            </div>
          </div>
          <h2 className="font-bold text-xl mb-3 text-fg tracking-tight">Check your email</h2>
          <p className="mb-6 leading-relaxed text-fg-muted">We sent a confirmation link to <span className="font-semibold text-fg">{email}</span>. Click it to activate your account.</p>
          <div className="card p-4 text-left mb-6 bg-warning/10 border-warning/30">
            <p className="text-sm text-warning"><strong>Tip:</strong> To skip this for testing, go to Supabase Dashboard → Authentication → Email → turn off "Confirm email".</p>
          </div>
          <Link to="/login" className="btn-primary px-8 py-3.5">Go to Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh bg-paper">
      {/* ═══ LEFT: Brand Panel (desktop) ═══ */}
      <div className="hidden lg:flex flex-col justify-center w-[42%] p-16 relative overflow-hidden bg-gradient-to-br from-accent-strong via-accent-strong to-accent min-h-dvh">
        <div className="absolute top-20 right-0 w-96 h-96 rounded-full bg-gold/25 blur-3xl animate-drift" aria-hidden="true" />

        <div className="relative max-w-md">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-2xl bg-accent-fg/15 backdrop-blur flex items-center justify-center p-1.5"><Logo size={36} /></div>
            <span className="font-bold text-xl text-accent-fg">Cashiea</span>
          </div>
          <h1 className="text-accent-fg font-bold mb-6 text-4xl leading-[1.2] tracking-tight">Start automating your shop in 5 minutes.</h1>
          <p className="text-accent-fg/75 text-lg leading-relaxed mb-10">Join 47+ shop owners who save hours every week with AI-powered billing, reports, and customer follow-ups.</p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { stat: '6 hrs', label: 'saved/week' },
              { stat: '₹12K', label: 'extra/month' },
              { stat: '90%', label: 'faster billing' },
            ].map((s, i) => (
              <div key={i} className="text-center p-3 rounded-xl bg-accent-fg/10 backdrop-blur" style={{ animation: `signupUp 0.5s cubic-bezier(0.22,1,0.36,1) ${0.3 + i * 0.1}s both` }}>
                <p className="text-xl font-bold text-accent-fg">{s.stat}</p>
                <p className="text-xs text-accent-fg/60">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {[
              { icon: Zap, text: 'AI does billing, reports & follow-ups' },
              { icon: TrendingUp, text: 'Daily WhatsApp sales reports' },
              { icon: Shield, text: '14-day free trial, no card needed' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-accent-fg/90" style={{ animation: `signupUp 0.5s cubic-bezier(0.22,1,0.36,1) ${0.6 + i * 0.1}s both` }}>
                <div className="w-8 h-8 rounded-lg bg-accent-fg/10 flex items-center justify-center flex-shrink-0"><item.icon className="w-4 h-4" /></div>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
        <style>{`@keyframes signupUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      </div>

      {/* ═══ RIGHT: Signup Form ═══ */}
      <div className="flex-1 flex items-start justify-center p-4 sm:p-6 py-10 overflow-y-auto cashiea-form-scroll">
        <div className="w-full max-w-[460px] py-8" style={{ animation: 'formIn 0.6s cubic-bezier(0.22,1,0.36,1) both' }}>
          <style>{`@keyframes formIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <Logo size={40} />
            <span className="font-bold text-xl text-fg">Cashiea</span>
          </div>

          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 text-fg-subtle hover:text-accent transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          <h2 className="font-bold mb-1 text-fg text-[28px] tracking-tight">Create your account</h2>
          <p className="mb-6 text-base text-fg-muted">Start your 14-day free trial. No credit card required.</p>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl text-sm animate-fade-in bg-negative/10 border border-negative/25 text-negative">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name + Shop name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-fg">Your Name *</label>
                <Input icon={User} focusProps={focusProps} type="text" required value={fullName} onChange={(e: any) => setFullName(e.target.value)} placeholder="Ramesh Kumar" autoComplete="name" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-fg">Shop Name *</label>
                <Input icon={Store} focusProps={focusProps} type="text" required value={shopName} onChange={(e: any) => setShopName(e.target.value)} placeholder="Sharma Store" autoComplete="organization" />
              </div>
            </div>

            {/* Phone + City */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-fg">Phone *</label>
                <Input icon={Phone} focusProps={focusProps} type="tel" required value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" inputMode="tel" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-fg">City</label>
                <Input icon={MapPin} focusProps={focusProps} type="text" value={city} onChange={(e: any) => setCity(e.target.value)} placeholder="Gaya" autoComplete="address-level2" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-fg">Email *</label>
              <Input icon={Mail} focusProps={focusProps} type="email" required value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="you@shop.com" autoComplete="email" inputMode="email" />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-fg">Password *</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 text-fg-subtle pointer-events-none transition-colors group-focus-within:text-accent" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  {...focusProps}
                  className={`${FOCUS_SCROLL_CLASS} w-full pl-12 pr-12 py-3.5 rounded-xl text-base bg-surface border border-line text-fg
                              placeholder:text-fg-subtle outline-none transition-all duration-200 ease-butter
                              focus:border-accent focus:ring-4 focus:ring-accent/15`}
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-accent transition-colors">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {/* Strength bar */}
              {password && (
                <div className="mt-2 flex items-center gap-2 animate-fade-in">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-3">
                    <div className={`h-full rounded-full transition-all duration-300 ${strength.tone.split(' ')[0]}`} style={{ width: `${strength.pct}%` }} />
                  </div>
                  <span className={`text-xs font-medium ${strength.tone.split(' ')[1]}`}>{strength.label}</span>
                </div>
              )}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <div className="relative mt-0.5">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="sr-only peer" />
                <div className="w-5 h-5 rounded-md border-2 border-line transition-all peer-checked:bg-accent peer-checked:border-accent flex items-center justify-center">
                  {agree && <Check className="w-3.5 h-3.5 text-accent-fg" />}
                </div>
              </div>
              <span className="text-sm leading-relaxed text-fg-muted">
                I agree to Cashiea's{' '}
                <Link to="/terms" className="font-medium text-accent hover:text-accent-strong transition-colors">Terms</Link> and{' '}
                <Link to="/privacy" className="font-medium text-accent hover:text-accent-strong transition-colors">Privacy Policy</Link>
              </span>
            </label>

            {/* Submit */}
            <button type="submit" disabled={loading} className="btn-primary w-full h-[52px] text-base hover:shadow-glow-accent disabled:hover:shadow-soft">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Creating account...</> : <>Create Free Account <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-5">
            <div className="hairline flex-1" />
            <span className="text-sm text-fg-subtle">or</span>
            <div className="hairline flex-1" />
          </div>

          <p className="text-center text-sm text-fg-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-accent hover:text-accent-strong transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
