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

const C = { bg: 'rgb(var(--paper))', bgCard: 'rgb(var(--surface))', border: 'rgb(var(--line))', blue: 'rgb(var(--accent))', blueDark: 'rgb(var(--accent-strong))', blueLight: 'rgb(var(--gold))', green: 'rgb(var(--positive))', text: 'rgb(var(--fg))', textBody: 'rgb(var(--fg-muted))', muted: 'rgb(var(--fg-subtle))', red: 'rgb(var(--negative))' }

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
  const focusProps = useInputFocus({ focusBorderColor: C.blue, focusShadow: `0 0 0 3px ${C.blue}15`, blurBorderColor: C.border })

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

  // Input field component with focus glow + mobile keyboard fix
  const Field = ({ icon: Icon, ...props }: any) => (
    <div className="relative group">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors" style={{ color: C.muted }} />
      <input
        {...props}
        {...focusProps}
        className={`${FOCUS_SCROLL_CLASS} w-full pl-12 pr-4 py-3.5 rounded-xl text-base outline-none transition-all duration-200`}
        style={{ background: 'rgb(var(--surface))', border: `1px solid ${C.border}`, color: C.text }}
      />
    </div>
  )

  return (
    <div className="flex" style={{ background: C.bg, minHeight: '100dvh' }}>
      {/* ═══ LEFT: Brand Panel ═══ */}
      <div className="hidden lg:flex flex-col justify-center w-[45%] p-16 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueDark} 100%)`, minHeight: '100dvh' }}>
        {/* Glow orbs */}
        <div className="absolute top-10 right-10 w-80 h-80 rounded-full" style={{ background: `radial-gradient(circle, ${C.blueLight}20 0%, transparent 70%)` }} />
        <div className="absolute bottom-10 left-10 w-60 h-60 rounded-full" style={{ background: `radial-gradient(circle, white 08 0%, transparent 70%)` }} />

        <div className="relative max-w-md">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center p-1.5"><Logo size={36} /></div>
            <span className="text-white font-bold text-xl" style={{ fontFamily: '"Plus Jakarta Sans"' }}>Cashiea</span>
          </div>

          <h1 className="text-white font-bold mb-6" style={{ fontFamily: '"Plus Jakarta Sans"', fontSize: '36px', lineHeight: 1.25 }}>
            Welcome back to your<br />smart shop assistant.
          </h1>
          <p className="text-white/70 text-lg leading-relaxed mb-10">Sign in to manage sales, customers, stock, and AI tasks — all from one dashboard.</p>

          <div className="space-y-4">
            {[
              { icon: Zap, text: 'AI handles billing, reports, and follow-ups' },
              { icon: TrendingUp, text: 'Daily WhatsApp reports with sales insights' },
              { icon: Shield, text: 'Your data is encrypted and private' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-white/90" style={{ animation: `slideUp 0.5s ease-out ${i * 0.1}s both` }}>
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0"><item.icon className="w-4.5 h-4.5" /></div>
                <span className="text-base">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      </div>

      {/* ═══ RIGHT: Form ═══ */}
      <div className="flex-1 flex items-start justify-center p-4 sm:p-12 py-12 cashiea-form-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="w-full max-w-[420px]" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
          <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <Logo size={40} />
            <span className="font-bold text-xl" style={{ fontFamily: '"Plus Jakarta Sans"', color: C.text }}>Cashiea</span>
          </div>

          {/* Back link */}
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium mb-8 transition-colors" style={{ color: C.muted }} onMouseEnter={e => e.currentTarget.style.color = C.blue} onMouseLeave={e => e.currentTarget.style.color = C.muted}>
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          <h2 className="font-bold mb-1" style={{ fontFamily: '"Plus Jakarta Sans"', fontSize: '28px', color: C.text }}>Sign in to Cashiea</h2>
          <p className="mb-8" style={{ fontSize: '16px', color: C.muted }}>Enter your details to access your dashboard</p>

          {/* Error message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl text-sm animate-fade-in flex items-center gap-2" style={{ background: C.red + '10', border: `1px solid ${C.red}30`, color: C.red }}>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.text }}>Email Address</label>
              <Field icon={Mail} type="email" required value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="your@shop.com" autoComplete="email" inputMode="email" />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.text }}>Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors" style={{ color: C.muted }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  {...focusProps}
                  className={`${FOCUS_SCROLL_CLASS} w-full pl-12 pr-12 py-3.5 rounded-xl text-base outline-none transition-all duration-200`}
                  style={{ background: 'rgb(var(--surface))', border: `1px solid ${C.border}`, color: C.text }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: C.muted }} onMouseEnter={e => e.currentTarget.style.color = C.blue} onMouseLeave={e => e.currentTarget.style.color = C.muted}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="sr-only peer" />
                  <div className="w-5 h-5 rounded-md border-2 transition-all peer-checked:bg-blue-500 peer-checked:border-blue-500" style={{ borderColor: C.border }} />
                  {remember && <Check className="absolute top-0.5 left-0.5 w-4 h-4 text-white pointer-events-none" />}
                </div>
                <span className="text-sm" style={{ color: C.textBody }}>Remember me</span>
              </label>
              <button type="button" onClick={handleForgotPassword} disabled={resetting} className="text-sm font-medium transition-colors" style={{ color: C.blue }} onMouseEnter={e => e.currentTarget.style.color = C.blueDark} onMouseLeave={e => e.currentTarget.style.color = C.blue}>
                {resetting ? 'Sending...' : 'Forgot password?'}
              </button>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} className="w-full font-semibold text-white py-4 rounded-xl transition-all hover:scale-[1.02] hover:shadow-xl flex items-center justify-center gap-2" style={{ fontSize: '16px', background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`, boxShadow: `0 6px 20px ${C.blue}25` }}>
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing in...</> : <>Sign In <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px" style={{ background: C.border }} />
            <span className="text-sm" style={{ color: C.muted }}>or</span>
            <div className="flex-1 h-px" style={{ background: C.border }} />
          </div>

          {/* Sign up link */}
          <p className="text-center text-sm" style={{ color: C.textBody }}>
            Don't have an account?{' '}
            <Link to="/signup" className="font-bold transition-colors" style={{ color: C.blue }} onMouseEnter={e => e.currentTarget.style.color = C.blueDark} onMouseLeave={e => e.currentTarget.style.color = C.blue}>
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
