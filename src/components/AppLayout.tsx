import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import FloatingMeraj from './FloatingMeraj'
import BottomNav from './BottomNav'
import TouchRipple from './TouchRipple'
import { LiveClock } from './LiveClock'
import { OfflineBanner } from './OfflineBanner'
import { motion } from './motion'
import Skeleton from './ui/Skeleton'
import { Avatar } from './Avatar'
import { useAuth } from '../context/AuthContext'
import { Menu } from 'lucide-react'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { profile } = useAuth()
  // The Meraj assistant page is full-bleed and scrolls internally; other pages
  // keep the padded, max-width shell + native body scroll.
  const isAssistant = location.pathname.startsWith('/app/assistant')
  // Persistent AI access on every non-assistant screen (desktop FAB / mobile bottom-nav center).
  const showFloatingMeraj = !isAssistant

  const [hdrOpacity, setHdrOpacity] = useState(1)
  const fadeTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (isAssistant) return
    const reset = () => { setHdrOpacity(1); clearTimeout(fadeTimer.current); fadeTimer.current = window.setTimeout(() => setHdrOpacity(0.15), 2000) }
    window.addEventListener('scroll', reset, { passive: true })
    window.addEventListener('touchstart', reset, { passive: true })
    reset()
    return () => { window.removeEventListener('scroll', reset); window.removeEventListener('touchstart', reset); clearTimeout(fadeTimer.current) }
  }, [isAssistant])

  return (
    // Assistant: definite viewport height so its message list scrolls on mobile.
    <div className={isAssistant ? 'h-dvh flex overflow-hidden bg-slate-950' : 'min-h-screen flex bg-slate-950'}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <OfflineBanner />
        {/* Mobile header — menu · brand (fades) · sync state · account */}
        {!isAssistant && (
        <header className="lg:hidden sticky top-0 z-30 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-muted hover:text-fg">
            <Menu className="w-6 h-6" />
          </button>
          <div style={{ opacity: hdrOpacity, transition: 'opacity 0.4s ease' }} className="flex-1 min-w-0">
            <span className="font-bold text-white">Cashiea</span>
          </div>
          <LiveClock />
          <Link to="/app/account" aria-label="Open account" className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full">
            <Avatar url={profile?.avatar_url} name={profile?.full_name} size={34} />
          </Link>
        </header>
        )}

        {/* Content — extra bottom padding on mobile so the bottom nav never covers it */}
        <main className={isAssistant
          ? 'flex-1 min-w-0 flex flex-col min-h-0'
          : 'flex-1 px-4 pt-4 pb-28 sm:px-5 sm:pt-5 lg:p-8 lg:pb-8 max-w-7xl mx-auto w-full'}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={isAssistant ? 'flex-1 flex flex-col min-h-0' : ''}
          >
            <Suspense fallback={
              <div className="space-y-5">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="card p-5"><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-8 w-20" /></div>
                  ))}
                </div>
              </div>
            }>
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>

      {/* Mobile bottom nav (persistent; "More" opens the grouped drawer) */}
      {!isAssistant && <BottomNav onMore={() => setSidebarOpen(true)} />}

      {/* Desktop persistent voice Meraj (FAB) */}
      {showFloatingMeraj && <FloatingMeraj pathname={location.pathname} />}
    </div>
  )
}
