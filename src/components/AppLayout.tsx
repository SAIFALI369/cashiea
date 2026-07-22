import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import QuickActionBar from './QuickActionBar'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-light-scope min-h-screen bg-ink-50 text-ink-800">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-12">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 py-10 lg:py-14">
          <Outlet />
        </div>
      </main>

      {/* Floating Quick-Action Bar — available on every page */}
      <QuickActionBar />
    </div>
  )
}
