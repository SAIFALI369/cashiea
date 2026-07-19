import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Loader2 } from 'lucide-react'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Logged in but onboarding not finished → send to wizard (it resumes at
  // the exact step they left off). Skip this if they're already going there.
  if (profile && profile.onboarding_step < 4 && location.pathname !== '/app/onboarding') {
    return <Navigate to="/app/onboarding" replace />
  }

  return <>{children}</>
}
