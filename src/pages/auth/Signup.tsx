import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Mail, Lock, Store, Phone, Loader2, ArrowLeft, Check } from 'lucide-react'
import toast from 'react-hot-toast'

function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="signupLogo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0071e3" />
          <stop offset="100%" stopColor="#3a8eff" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#signupLogo)" />
      <path d="M62 28 A26 26 0 1 0 62 72" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" />
      <circle cx="55" cy="50" r="5" fill="white" />
      <path d="M55 30 L55 42 M55 58 L55 70 M35 50 L47 50 M63 50 L75 50" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [shopName, setShopName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !shopName.trim() || !phone.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      await signUp(email, password, fullName, shopName, phone)
      toast.success('Account created!')
      navigate('/app/onboarding', { replace: true })
    } catch (err) {
      if (err instanceof Error && err.message === 'EMAIL_CONFIRMATION_REQUIRED') {
        setNeedsConfirmation(true)
        setLoading(false)
        return
      }
      toast.error(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  if (needsConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden" style={{ background: '#fbfbfd' }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,113,227,0.10) 0%, transparent 70%)' }} />
        <div className="relative w-full max-w-[420px]">
          <div className="card p-9 sm:p-10 text-center shadow-apple">
            <div className="w-16 h-16 rounded-full bg-apple-50 flex items-center justify-center mx-auto mb-5">
              <Mail className="w-8 h-8 text-apple-500" strokeWidth={1.75} />
            </div>
            <h2 className="text-[28px] font-semibold tracking-tight text-ink-800 mb-2">Check your email.</h2>
            <p className="text-[15px] text-ink-600 mb-6">
              We sent a confirmation link to <span className="text-ink-800 font-medium">{email}</span>.
              Click it to activate your account, then sign in.
            </p>
            <div className="bg-[#fff4e5] border border-[#ffd9a3] rounded-xl p-3.5 mb-5 text-left">
              <p className="text-[13px] text-[#8a5500]">
                <strong>Tip:</strong> To skip this for testing, go to your Supabase Dashboard,
                Authentication, Providers, Email, and turn off "Confirm email".
              </p>
            </div>
            <Link to="/login" className="btn-primary w-full">Go to Sign In</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden" style={{ background: '#fbfbfd' }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,113,227,0.10) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(58,142,255,0.06) 0%, transparent 70%)' }} />

      <div className="relative w-full max-w-[460px]">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-normal text-ink-600 hover:text-ink-800 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="card p-9 sm:p-10 shadow-apple">
          <div className="flex items-center gap-2.5 mb-6 justify-center">
            <Logo size={32} />
            <span className="font-semibold text-ink-800 text-[20px] tracking-tight">Cashiea</span>
          </div>

          <h1 className="text-[32px] font-semibold tracking-tight text-ink-800 mb-1 text-center">Start free.</h1>
          <p className="text-[15px] text-ink-500 text-center mb-6">
            14 days, full access. No credit card required.
          </p>

          <div className="flex items-center justify-center gap-2.5 mb-7 flex-wrap">
            {['POS', 'Invoices', 'Inventory', 'UPI', 'AI Assistant'].map((feat) => (
              <span key={feat} className="flex items-center gap-1 text-[12px] text-ink-600">
                <Check className="w-3.5 h-3.5 text-[#00863a]" strokeWidth={2.5} /> {feat}
              </span>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label">Your Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field"
                  placeholder="Ramesh Kumar"
                />
              </div>
              <div>
                <label className="label">Shop Name</label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="input-field"
                  placeholder="Sharma Store"
                />
              </div>
            </div>

            <div>
              <label className="label">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field pl-11"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

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
                  placeholder="you@shop.com"
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
                  placeholder="Min 6 characters"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-[15px] mt-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account → Start Setup'}
            </button>
          </form>

          <p className="text-[15px] text-ink-600 text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-apple-500 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
