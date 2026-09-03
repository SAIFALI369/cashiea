import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, fullName: string, companyName?: string, phone?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  ownerId: string | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Auth is deliberately hydrated in one place. Pages can mount before the
 * session/profile request completes, so this provider must never publish a
 * profile from an older user after a fast sign-out/sign-in switch.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const profileRequest = useRef(0)
  const mounted = useRef(true)

  const fetchProfile = async (userId: string, requestId = ++profileRequest.current): Promise<Profile | null> => {
    // The signup trigger and the auth session become visible in very close
    // succession on Supabase. A short bounded retry avoids a blank app without
    // leaving an unbounded request running.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!mounted.current || requestId !== profileRequest.current) return null
      if (!error && data) {
        const nextProfile = data as Profile
        setProfile(nextProfile)
        // Offline mutations need a previously verified tenant mapping for
        // linked staff. Keying by actor prevents an account switch in the same
        // browser from reusing another user's business id.
        try {
          const verifiedOwnerId = nextProfile.role === 'owner' && !nextProfile.business_owner_id
            ? nextProfile.id
            : nextProfile.business_owner_id
          if (verifiedOwnerId) localStorage.setItem(`cashiea_owner_id:${userId}`, verifiedOwnerId)
          else localStorage.removeItem(`cashiea_owner_id:${userId}`)
        } catch { /* storage may be unavailable; offline writes will fail closed */ }
        return nextProfile
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250))
    }

    // Never retain a previous user's profile when the new account has no row.
    if (mounted.current && requestId === profileRequest.current) setProfile(null)
    return null
  }

  const hydrate = async (nextSession: Session | null) => {
    if (!mounted.current) return
    const requestId = ++profileRequest.current

    setSession(nextSession)
    setUser(nextSession?.user ?? null)
    setProfile(null)
    if (!nextSession?.user) {
      if (mounted.current && requestId === profileRequest.current) setLoading(false)
      return
    }

    setLoading(true)
    // Pass the hydration token through so an older auth event can never
    // publish loading=false after a newer sign-in/sign-out has started.
    await fetchProfile(nextSession.user.id, requestId)
    if (mounted.current && requestId === profileRequest.current) setLoading(false)
  }

  useEffect(() => {
    mounted.current = true
    if (!supabaseConfigured) {
      setLoading(false)
      return () => { mounted.current = false }
    }

    let active = true
    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      if (active) void hydrate(nextSession)
    }).catch(() => {
      if (active) {
        setSession(null)
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      // Supabase advises deferring follow-up database work from inside the auth
      // callback. It also lets a newer auth event win over an older fetch.
      setTimeout(() => { if (active) void hydrate(nextSession) }, 0)
    })

    return () => {
      active = false
      mounted.current = false
      profileRequest.current += 1
      authListener.subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = async () => {
    if (user && supabaseConfigured) {
      await fetchProfile(user.id)
    }
  }

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    companyName?: string,
    phone?: string,
  ) => {
    if (!supabaseConfigured) throw new Error('Cashiea is not configured. Add the Supabase environment variables.')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName || '',
          phone: phone || '',
        },
      },
    })

    if (error) {
      console.error('[cashiea:auth] signUp error →', error)
      throw error
    }
    if (data.user) {
      if (!data.session) throw new Error('EMAIL_CONFIRMATION_REQUIRED')
      await fetchProfile(data.user.id)
    }
  }

  const signIn = async (email: string, password: string) => {
    if (!supabaseConfigured) throw new Error('Cashiea is not configured. Add the Supabase environment variables.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('[cashiea:auth] signIn error →', error)
      throw error
    }
  }

  const signOut = async () => {
    profileRequest.current += 1
    try { Object.keys(localStorage).filter((k) => k.startsWith('cashiea_meraj_')).forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }
    if (supabaseConfigured) await supabase.auth.signOut()
    setProfile(null)
    setUser(null)
    setSession(null)
    setLoading(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        ownerId: profile
          ? (profile.role === 'owner' && !profile.business_owner_id ? profile.id : profile.business_owner_id)
          : null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
