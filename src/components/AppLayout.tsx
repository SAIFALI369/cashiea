import { Suspense, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import FloatingMeraj from './FloatingMeraj'
import ThemeToggle from './ThemeToggle'
import TouchRipple from './TouchRipple'
import { motion } from './motion'
import Skeleton from './ui/Skeleton'
import { Menu } from 'lucide-react'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  // The Meraj assistant page is full-bleed (100% width/height); other pages keep the padded, max-width shell.
  const isAssistant = location.pathname.startsWith('/app/assistant')

  return (
    <div className="min-h-screen flex bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-fg-muted hover:text-fg">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-white">Cashiea</span>
          <div className="ml-auto"><ThemeToggle /></div>
        </header>

        <main className={isAssistant ? 'flex-1 min-w-0 flex flex-col' : 'flex-1 p-4 sm:p-5 lg:p-8 max-w-7xl mx-auto w-full'}>
          {/* Route transition — gentle fade/slide on every navigation */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
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

      {/* Global tap ripple + floating Meraj launcher */}
      <TouchRipple />
      <FloatingMeraj />
    </div>
  )
}
