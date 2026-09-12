import { Suspense, useState } from 'react'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import DesktopHeader from './DesktopHeader'
import { CommandPalette } from './CommandPalette'
import { OfflineBanner } from './OfflineBanner'
import { useDailyIntelligence } from '../lib/useDailyIntelligence'
import { SyncManager } from './SyncManager'
import { QueueBadge } from './QueueBadge'
import AutomationCards from './AutomationCards'
import PageStack from './PageStack'
import Skeleton from './ui/Skeleton'
import { Avatar } from './Avatar'
import { useAuth } from '../context/AuthContext'
import { getPageContext } from '../lib/pageContext'
import { useKeyboardShortcuts } from '../lib/useKeyboardShortcuts'
import { useEdgeDrawer } from '../lib/useSwipeNavigation'
import { canSwipeBack } from '../lib/butterNav'
import { Menu, ChevronLeft, Bell } from 'lucide-react'
import { useIsDesktop } from '../lib/useIsDesktop'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, ownerId } = useAuth()
  const isDesktop = useIsDesktop()
  useDailyIntelligence(ownerId, profile?.role === 'owner' && !profile.business_owner_id)
  useKeyboardShortcuts()
  // Lateral swipe between primary tabs and edge swipe-back live in
  // PageStack (interactive, following the finger 1:1). The drawer only
  // owns the left edge where there is nothing to go back to.
  useEdgeDrawer({
    isOpen: sidebarOpen,
    onOpen: () => setSidebarOpen(true),
    onClose: () => setSidebarOpen(false),
    enabled: !canSwipeBack(location.pathname),
  })

  // The Meraj assistant page is full-bleed and scrolls internally; other pages
  // keep the padded, max-width shell + native body scroll. On desktop this
  // becomes a true "screen" between the desktop header and the desktop
  // bottom nav — Meraj fills that space completely, designed for desktop.
  const isAssistant = location.pathname.startsWith('/app/assistant')
  // Primary all-day pages get a full-bleed desktop workspace (sidebar
  // hidden, header shows a menu button instead). Everything else keeps
  // the sidebar for its section navigation.
  const PRIMARY_FULLBLEED = ['/app', '/app/pos', '/app/products', '/app/customers']
  // On desktop, the assistant remains framed by the desktop header + bottom nav.
  // On mobile it stays full-bleed, matching the existing chat-first experience.
  const showDesktopShell = !isAssistant || isDesktop
  // Persistent AI access on every non-assistant screen (desktop FAB / mobile bottom-nav center).

  // ── Page name for the header (replaces 'Cashiea' on non-dashboard pages) ──
  const pageHeaderName = (() => {
    const path = location.pathname
    if (path === '/app' || path === '/app/assistant' || path === '/app/onboarding') return 'Cashiea'
    const ctx = getPageContext(path)
    return ctx?.name || 'Cashiea'
  })()

  const isSubPage = pageHeaderName !== 'Cashiea'
  // Bottom nav lives ONLY on the Dashboard and the Meraj AI page — every
  // other page gets full-screen focus (the header back-arrow is the way out).
  const showMobileNav = location.pathname === '/app' || location.pathname === '/app/assistant'
  const goBack = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1)
    else navigate('/app')
  }

  return (
    // Assistant: definite viewport height so its message list scrolls on mobile AND desktop.
    <div className={isAssistant ? 'h-dvh flex flex-col overflow-hidden bg-paper' : 'min-h-screen flex flex-col bg-paper'}>
      {/* Sidebar: hidden on the Meraj assistant page (full-screen chat) AND
          on desktop primary pages (Dashboard/POS/Stocks/Customers) where
          the dock + header already navigate — a menu button in the header
          opens the drawer when needed. Secondary pages (Settings, Reports,
          etc.) keep the sidebar visible for its section navigation. */}
      {!isAssistant && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <OfflineBanner />
        <AutomationCards />

        {/* ── Desktop header (≥lg) — menu button on primary pages where
            the sidebar is default-hidden ── */}
        {showDesktopShell && (
          <DesktopHeader
            onMenu={() => setSidebarOpen(true)}
            showMenuButton={PRIMARY_FULLBLEED.includes(location.pathname)}
          />
        )}

        {/* ── Mobile header (<lg) ──
            Dashboard  : hamburger · Cashiea · bell · avatar
            Every other: back button · large bold page title · page action
            The lightbulb and the profile picture are gone from sub-pages —
            one title, one way back, one action. Nothing else. */}
        {!isAssistant && (
        <header className="lg:hidden sticky top-0 z-30 bg-paper/85 backdrop-blur-xl px-4 pt-2 pb-3 flex items-center gap-2 safe-area-pt">
          {isSubPage ? (
            <button
              onClick={goBack}
              aria-label="Go back"
              className="-ml-2 w-11 h-11 flex items-center justify-center text-fg rounded-full active:scale-95 transition-transform"
            >
              <ChevronLeft className="w-6 h-6" strokeWidth={2.25} />
            </button>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="-ml-2 w-11 h-11 flex items-center justify-center text-fg rounded-full active:scale-95 transition-transform"
            >
              <Menu className="w-6 h-6" strokeWidth={2} />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <span className="block text-[22px] leading-tight font-bold tracking-tight text-fg truncate">
              {pageHeaderName}
            </span>
          </div>

          {/* Pages inject their primary action here (see ui/HeaderAction). */}
          <div id="app-header-action" className="flex items-center gap-1 shrink-0" />

          {!isSubPage && (
            <>
              <QueueBadge />
              <Link
                to="/app/notifications"
                aria-label="Notifications"
                className="w-11 h-11 flex items-center justify-center rounded-full text-fg-muted active:scale-95 transition-transform"
              >
                <Bell className="w-[22px] h-[22px]" strokeWidth={2} />
              </Link>
              <Link to="/app/account" aria-label="Open account & settings" className="w-11 h-11 flex items-center justify-center rounded-full">
                <Avatar url={profile?.avatar_url} name={profile?.full_name} size={32} />
              </Link>
            </>
          )}
        </header>
        )}

        {/* Content:
            • Assistant page: fills remaining space (between desktop header
              and desktop bottom bar on desktop; between mobile top header
              and mobile bottom nav on mobile).
            • Other pages: padded, max-width shell. On desktop we leave
              room at the bottom for the 72px desktop nav + safe area. */}
        <main className={
          isAssistant
            ? `flex-1 min-w-0 flex flex-col min-h-0 ${showMobileNav ? 'lg:pb-[calc(env(safe-area-inset-bottom)+72px)]' : 'lg:pb-6'}`
            : `flex-1 px-4 pt-4 ${showMobileNav ? 'pb-[calc(env(safe-area-inset-bottom)+72px)]' : 'pb-6'} sm:px-6 sm:pt-6 lg:px-10 lg:pt-8 ${showMobileNav ? 'lg:pb-[calc(env(safe-area-inset-bottom)+96px)]' : 'lg:pb-10'} max-w-[1600px] mx-auto w-full`
        }>
          <PageStack pathname={location.pathname} fullBleed={isAssistant}>
            <Suspense fallback={
              <div className="space-y-5">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="card p-5"><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-8 w-20" /></div>
                  ))}
                </div>
              </div>
            }>
              <Outlet />
            </Suspense>
          </PageStack>
        </main>
      </div>

      {/* Bottom nav — shapes itself for mobile vs desktop internally. */}
      {(showDesktopShell || showMobileNav) && <BottomNav showMobile={showMobileNav} />}

      <CommandPalette />
      <SyncManager />
    </div>
  )
}
