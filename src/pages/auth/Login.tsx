import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft, ArrowRight, Check, Shield, Zap, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { friendlyAuthError } from '../../lib/auth-errors'
import { useInputFocus, FOCUS_SCROLL_CLASS } from '../../lib/useInputFocus'

// ═══ Logo (same as landing) ═══
function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="rgb(var(--accent))" /><stop offset="100%" stopColor="rgb(var(--gold))" /></linearGradient></defs>
      <rect width="100" height="100" rx="24" fill="url(#lg)" />
      <path d="M62 28 A26 26 0 1 0 62 72" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" />
      <circle cx="55" cy="50" r="5" fill="white" />
      <path d="M55 30 L55 42 M55 58 L55 70 M35 50 L47 50 M63 50 L75 50" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}

// ── Defined at MODULE scope on purpose ─────────────────────────────
// Keeps the <input>'s identity stable across keystrokes so focus (and
// the mobile keyboard) survives every re-render.
function Field({ icon: Icon, focusProps, ...props }: any) {
  return (
    <div className="relative group">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle pointer-events-none transition-colors group-focus-within:text-accent" />
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

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')

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
    setLoading(true)
    try {
      await signIn(email, password)
      toast.success('Welcome back!')
      navigate(from, { replace: true })
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) { setError('Enter your email above first, then tap forgot password.'); return }
    setResetting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      toast.success('Password reset link sent! Check your email.')
    } catch (err) {
      toast.error(friendlyAuthError(err, 'Could not send reset email'))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex min-h-dvh bg-paper">
      {/* ═══ LEFT: Brand Panel (desktop) ═══ */}
      <div className="hidden lg:flex flex-col justify-center w-[45%] p-16 relative overflow-hidden bg-gradient-to-br from-accent-strong via-accent-strong to-accent min-h-dvh">
        {/* Glow orbs */}
        <div className="absolute top-10 right-10 w-80 h-80 rounded-full bg-gold/25 blur-3xl animate-drift" aria-hidden="true" />
        <div className="absolute bottom-10 left-10 w-64 h-64 rounded-full bg-accent-fg/10 blur-3xl animate-drift" style={{ animationDelay: '-6s' }} aria-hidden="true" />

        <div className="relative max-w-md">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-2xl bg-accent-fg/15 backdrop-blur flex items-center justify-center p-1.5"><Logo size={36} /></div>
            <span className="font-bold text-xl text-accent-fg">Cashiea</span>
          </div>

          <h1 className="text-accent-fg font-bold mb-6 text-4xl leading-[1.2] tracking-tight">
            Welcome back to your<br />smart shop assistant.
          </h1>
          <p className="text-accent-fg/75 text-lg leading-relaxed mb-10">
            Sign in to manage sales, customers, stock, and AI tasks — all from one dashboard.
          </p>

          <div className="space-y-4">
            {[
              { icon: Zap, text: 'AI handles billing, reports, and follow-ups' },
              { icon: TrendingUp, text: 'Daily WhatsApp reports with sales insights' },
              { icon: Shield, text: 'Your data is encrypted and private' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-accent-fg/90" style={{ animation: `loginUp 0.5s cubic-bezier(0.22,1,0.36,1) ${i * 0.1 + 0.15}s both` }}>
                <div className="w-9 h-9 rounded-xl bg-accent-fg/10 flex items-center justify-center flex-shrink-0"><item.icon className="w-4.5 h-4.5" /></div>
                <span className="text-base">{item.text}</span>
              </div>
            ))}
          </div>

          <style>{`@keyframes loginUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      </div>

      {/* ═══ RIGHT: Form ═══ */}
      <div className="flex-1 flex items-start justify-center p-4 sm:p-12 py-12 cashiea-form-scroll">
        <div className="w-full max-w-[420px]" style={{ animation: 'formIn 0.6s cubic-bezier(0.22,1,0.36,1) both' }}>
          <style>{`@keyframes formIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <Logo size={40} />
            <span className="font-bold text-xl text-fg">Cashiea</span>
          </div>

          {/* Back link */}
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium mb-8 text-fg-subtle hover:text-accent transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          <h2 className="font-bold text-fg text-[28px] tracking-tight mb-1">Sign in to Cashiea</h2>
          <p className="mb-8 text-base text-fg-muted">Enter your details to access your dashboard</p>

          {/* Error message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl text-sm animate-fade-in bg-negative/10 border border-negative/25 text-negative">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-fg">Email Address</label>
              <Field icon={Mail} focusProps={focusProps} type="email" required value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="your@shop.com" autoComplete="email" inputMode="email" />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-fg">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle pointer-events-none transition-colors group-focus-within:text-accent" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  {...focusProps}
                  className={`${FOCUS_SCROLL_CLASS} w-full pl-12 pr-12 py-3.5 rounded-xl text-base bg-surface border border-line text-fg
                              placeholder:text-fg-subtle outline-none transition-all duration-200 ease-butter
                              focus:border-accent focus:ring-4 focus:ring-accent/15`}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-accent transition-colors">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="sr-only peer" />
                  <div className="w-5 h-5 rounded-md border-2 border-line transition-all peer-checked:bg-accent peer-checked:border-accent" />
                  {remember && <Check className="absolute top-0.5 left-0.5 w-4 h-4 text-accent-fg pointer-events-none" />}
                </div>
                <span className="text-sm text-fg-muted">Remember me</span>
              </label>
              <button type="button" onClick={handleForgotPassword} disabled={resetting} className="text-sm font-medium text-accent hover:text-accent-strong transition-colors disabled:opacity-50">
                {resetting ? 'Sending...' : 'Forgot password?'}
              </button>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} className="btn-primary w-full h-[52px] text-base hover:shadow-glow-accent disabled:hover:shadow-soft">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing in...</> : <>Sign In <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="hairline flex-1" />
            <span className="text-sm text-fg-subtle">or</span>
            <div className="hairline flex-1" />
          </div>

          {/* Sign up link */}
          <p className="text-center text-sm text-fg-muted">
            Don't have an account?{' '}
            <Link to="/signup" className="font-bold text-accent hover:text-accent-strong transition-colors">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
