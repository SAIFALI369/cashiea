import { Navigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Loader2, ShieldAlert } from 'lucide-react'
import { can } from '../lib/permissions'
import { requiredCapability } from '../lib/routeCapabilities'

function AccessDenied({ capability }: { capability: string }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-7 text-center">
        <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-warning" />
        <h1 className="text-lg font-bold text-fg">Access restricted</h1>
        <p className="text-sm text-fg-muted mt-2 leading-relaxed">
          Your role does not have the <span className="font-semibold text-fg">{capability}</span> permission. Ask the business owner if you need access.
        </p>
      </div>
    </div>
  )
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, refreshProfile, signOut } = useAuth()
  const [retrying, setRetrying] = useState(false)
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // A session without a verified profile must fail closed. Rendering the app
  // with a null tenant would make every page look empty and could let a future
  // write accidentally fall back to the actor id. Give transient trigger/RLS
  // failures a bounded, explicit recovery path instead.
  if (!profile) {
    const retry = async () => {
      setRetrying(true)
      try { await refreshProfile() } finally { setRetrying(false) }
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper p-6">
        <div className="card max-w-md w-full p-7 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-warning" />
          <h1 className="text-lg font-bold text-fg">We could not load your business</h1>
          <p className="text-sm text-fg-muted mt-2 leading-relaxed">Your sign-in is valid, but Cashiea could not verify the account profile. Retry once, or sign out and sign in again.</p>
          <div className="flex gap-2 justify-center mt-5">
            <button onClick={retry} disabled={retrying} className="btn-primary text-sm">{retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Retry'}</button>
            <button onClick={() => void signOut()} className="btn-secondary text-sm">Sign out</button>
          </div>
        </div>
      </div>
    )
  }

  // A profile row without a valid owner identity or active business mapping is
  // not a usable tenant. In particular, team-link revocation clears
  // business_owner_id; do not let that orphaned login fall back to its own
  // profile id and render an apparently empty business.
  const validTenantIdentity = profile.role === 'owner'
    ? !profile.business_owner_id
    : Boolean(profile.business_owner_id)
  if (!validTenantIdentity) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper p-6">
        <div className="card max-w-md w-full p-7 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-warning" />
          <h1 className="text-lg font-bold text-fg">Business access is not active</h1>
          <p className="text-sm text-fg-muted mt-2 leading-relaxed">This account is not currently linked to an active Cashiea business. Ask the business owner to link your account again, or sign out.</p>
          <button onClick={() => void signOut()} className="btn-secondary text-sm mt-5">Sign out</button>
        </div>
      </div>
    )
  }

  // Logged in but onboarding not finished → send to wizard (it resumes at
  // the exact step they left off). Skip this if they're already going there.
  if (profile && profile.onboarding_step < 4 && location.pathname !== '/app/onboarding') {
    return <Navigate to="/app/onboarding" replace />
  }

  const capability = requiredCapability(location.pathname)
  if (profile && capability && !can(profile.role, capability)) {
    return <AccessDenied capability={capability} />
  }

  return <>{children}</>
}
