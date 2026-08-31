import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import FloatingMeraj from './FloatingMeraj'
import BottomNav from './BottomNav'
import TouchRipple from './TouchRipple'
import { LiveClock } from './LiveClock'
import { OfflineBanner } from './OfflineBanner'
import { useDailyIntelligence } from '../lib/useDailyIntelligence'
import { SyncManager } from './SyncManager'
import { QueueBadge } from './QueueBadge'
import { motion, AnimatePresence } from './motion'
import Skeleton from './ui/Skeleton'
import { Avatar } from './Avatar'
import { useAuth } from '../context/AuthContext'
import { getPageContext } from '../lib/pageContext'
import { useKeyboardShortcuts } from '../lib/useKeyboardShortcuts'
import { useSwipeNavigation, useEdgeDrawer, SWIPE_PAGES } from '../lib/useSwipeNavigation'
import { Menu, Settings, ChevronLeft } from 'lucide-react'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, ownerId } = useAuth()
  useDailyIntelligence(ownerId)
  // Swipe left/right between Today → New Sale → Customers → Scan (mobile).
  useSwipeNavigation()
  // Swipe in from the left edge → sidebar drawer slides in; swipe left → away.
  useEdgeDrawer({ isOpen: sidebarOpen, onOpen: () => setSidebarOpen(true), onClose: () => setSidebarOpen(false) })

  // ── Directional page slides ──
  // Forward navigation slides the next page in from the right, back
  // navigation slides it in from the left — the app moves the way you
  // swiped. Unknown jumps (sidebar links) get the soft fade+lift.
  const prevPathRef = useRef(location.pathname)
  const [slideDir, setSlideDir] = useState(0)
  useLayoutEffect(() => {
    const from = SWIPE_PAGES.indexOf(prevPathRef.current)
    const to = SWIPE_PAGES.indexOf(location.pathname)
    prevPathRef.current = location.pathname
    setSlideDir(from !== -1 && to !== -1 ? (to > from ? 1 : to < from ? -1 : 0) : 0)
  }, [location.pathname])
  // The Meraj assistant page is full-bleed and scrolls internally; other pages
  // keep the padded, max-width shell + native body scroll.
  const isAssistant = location.pathname.startsWith('/app/assistant')
  // Persistent AI access on every non-assistant screen (desktop FAB / mobile bottom-nav center).
  const showFloatingMeraj = !isAssistant

  // ── Page name for the header (replaces 'Cashiea' on non-dashboard pages) ──
  const pageHeaderName = (() => {
    const path = location.pathname
    if (path === '/app' || path === '/app/assistant' || path === '/app/onboarding') return 'Cashiea'
    const ctx = getPageContext(path)
    return ctx?.name || 'Cashiea'
  })()

  // Sub-pages get a back affordance — one tap returns the way you came
  // (browser history when there is one, the dashboard otherwise).
  const isSubPage = pageHeaderName !== 'Cashiea'
  const goBack = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1)
    else navigate('/app')
  }

  return (
    // Assistant: definite viewport height so its message list scrolls on mobile.
    <div className={isAssistant ? 'h-dvh flex overflow-hidden bg-paper' : 'min-h-screen flex bg-paper'}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <OfflineBanner />
        {/* Mobile header — menu · brand (fades) · sync state · account */}
        {!isAssistant && (
        <header className="lg:hidden sticky top-0 z-30 bg-surface/80 backdrop-blur border-b border-line px-4 py-2 flex items-center gap-3 safe-area-pt">
          <button onClick={() => setSidebarOpen(true)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-muted hover:text-fg">
            <Menu className="w-6 h-6" />
          </button>
          {/* Back affordance on sub-pages — the page keeps its name
              (no fading) and one tap walks back the trail. */}
          {isSubPage && (
            <button onClick={goBack} aria-label="Go back" className="min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-muted hover:text-fg rounded-xl">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <span className="font-bold text-fg">{pageHeaderName}</span>
          </div>
          <QueueBadge />
          <LiveClock />
          <Link to="/app/account" aria-label="Open account & settings" className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full">
            <Avatar url={profile?.avatar_url} name={profile?.full_name} size={34} />
            {/* Subtle gear badge — signals the avatar opens Settings/Account */}
            <span className="absolute bottom-[3px] right-[3px] w-[16px] h-[16px] rounded-full bg-surface border border-line flex items-center justify-center shadow-soft">
              <Settings className="w-2.5 h-2.5 text-fg-muted" />
            </span>
          </Link>
        </header>
        )}

        {/* Content — extra bottom padding on mobile so the bottom nav never covers it */}
        <main className={isAssistant
          ? 'flex-1 min-w-0 flex flex-col min-h-0'
          : 'flex-1 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+72px)] sm:px-6 sm:pt-6 lg:px-10 lg:py-10 lg:pb-10 max-w-[1600px] mx-auto w-full'}>
          <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: slideDir !== 0 ? 36 * slideDir : 0, y: slideDir === 0 ? 6 : 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: slideDir !== 0 ? -22 * slideDir : 0, y: slideDir === 0 ? 4 : 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
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
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom nav (persistent; "More" opens the grouped drawer) */}
      {!isAssistant && <BottomNav onMore={() => setSidebarOpen(true)} />}

      {/* Desktop persistent voice Meraj (FAB) */}
      {showFloatingMeraj && <FloatingMeraj pathname={location.pathname} />}
      <SyncManager />
    </div>
  )
}

