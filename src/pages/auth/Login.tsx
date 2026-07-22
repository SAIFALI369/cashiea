import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Sparkles, Mail, Lock, Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="loginLogo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0071e3" />
          <stop offset="100%" stopColor="#3a8eff" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#loginLogo)" />
      <path d="M62 28 A26 26 0 1 0 62 72" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" />
      <circle cx="55" cy="50" r="5" fill="white" />
      <path d="M55 30 L55 42 M55 58 L55 70 M35 50 L47 50 M63 50 L75 50" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const [resetting, setResetting] = useState(false)

  const handleForgotPassword = async () => {
    if (!email) { toast.error('Enter your email first'); return }
    setResetting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      toast.success('Password reset link sent! Check your email.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn(email, password)
      toast.success('Welcome back!')
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden" style={{ background: '#fbfbfd' }}>
      {/* Apple-style soft glow background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,113,227,0.10) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(58,142,255,0.06) 0%, transparent 70%)' }} />

      <div className="relative w-full max-w-[420px]">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-normal text-ink-600 hover:text-ink-800 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="card p-9 sm:p-10 shadow-apple">
          <div className="flex items-center gap-2.5 mb-8 justify-center">
            <Logo size={32} />
            <span className="font-semibold text-ink-800 text-[20px] tracking-tight">Cashiea</span>
          </div>

          <h1 className="text-[32px] font-semibold tracking-tight text-ink-800 mb-1 text-center">Sign in.</h1>
          <p className="text-[15px] text-ink-500 text-center mb-7">Welcome back. Let's get you to your store.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-11"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-11"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-[15px]">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <div className="text-center mt-5">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetting}
              className="text-[13px] text-ink-500 hover:text-apple-500 transition-colors"
            >
              {resetting ? 'Sending...' : 'Forgot password?'}
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-ink-200" />
            <span className="text-[11px] uppercase tracking-wide text-ink-400">or</span>
            <div className="flex-1 h-px bg-ink-200" />
          </div>

          <p className="text-[15px] text-ink-600 text-center">
            Don't have an account?{' '}
            <Link to="/signup" className="text-apple-500 hover:underline font-medium">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
