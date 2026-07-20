import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Sparkles, Mail, Lock, Store, Phone, Loader2, ArrowLeft, Check } from 'lucide-react'
import toast from 'react-hot-toast'

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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[100px]" />
        <div className="relative w-full max-w-md">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-600/15 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-brand-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
            <p className="text-slate-400 text-sm mb-6">
              We sent a confirmation link to <span className="text-white font-medium">{email}</span>.
              Click it to activate your account, then sign in.
            </p>
            <div className="bg-amber-500/10 border border-amber-600/30 rounded-xl p-3 mb-4 text-left">
              <p className="text-xs text-amber-200">
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[100px]" />

      <div className="relative w-full max-w-md">
        <Link to="/" className="btn-ghost mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="card p-8">
          <div className="flex items-center gap-2.5 mb-6 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white text-xl">BizAutomate</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1 text-center">Start your free trial</h1>
          <p className="text-slate-400 text-sm text-center mb-6">
            14 days free, full access. No credit card required.
          </p>

          <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
            {['POS', 'Invoices', 'Inventory', 'UPI', 'AI Assistant'].map((feat) => (
              <span key={feat} className="flex items-center gap-1 text-xs text-slate-400">
                <Check className="w-3 h-3 text-brand-400" /> {feat}
              </span>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Your Name *</label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field pl-11"
                  placeholder="Ramesh Kumar"
                />
              </div>
            </div>

            <div>
              <label className="label">Shop / Business Name *</label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="input-field pl-11"
                  placeholder="Sharma General Store"
                />
              </div>
            </div>

            <div>
              <label className="label">Phone Number *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
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
              <label className="label">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
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
              <label className="label">Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
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

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account \u2192 Start Setup'}
            </button>
          </form>

          <p className="text-sm text-slate-400 text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
