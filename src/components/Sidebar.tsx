import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import clsx from 'clsx'
import ThemeToggle from './ThemeToggle'
import {
  UserCircle, Lightbulb, Bell, ShieldCheck, AlertOctagon, UsersRound, Truck,
  Plug, Settings as SettingsIcon, ChevronDown, LogOut, Sparkles, X,
  ShoppingCart, FileSignature, ScrollText, Database, History, Key, Shield,
  CreditCard, Brain, Mail, LayoutDashboard, LifeBuoy,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: boolean }

// Quick Access — the 9 items from the spec.
const QUICK_ACCESS: NavItem[] = [
  { to: '/app', label: 'Today', icon: LayoutDashboard, end: true },
  { to: '/app/about', label: 'About Me', icon: UserCircle },
  { to: '/app/suggestions', label: 'Suggestions', icon: Lightbulb },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/permissions', label: 'Permissions', icon: ShieldCheck },
  { to: '/app/failed-jobs', label: 'Pending', icon: AlertOctagon, badge: true },
  { to: '/app/team', label: 'Staff', icon: UsersRound },
  { to: '/app/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/app/connect-apps', label: 'Connections', icon: Plug },
  { to: '/app/settings', label: 'Settings', icon: SettingsIcon },
]

// Remaining existing pages, kept reachable so nothing is hidden.
const MORE: NavItem[] = [
  { to: '/app/pos', label: 'New Sale (POS)', icon: ShoppingCart },
  { to: '/app/assistant', label: 'Ask AI (Meraj)', icon: Brain },
  { to: '/app/email-assistant', label: 'Email Assistant', icon: Mail },
  { to: '/app/quotations', label: 'Quotations', icon: FileSignature },
  { to: '/app/summaries', label: 'Summaries', icon: ScrollText },
  { to: '/app/data-entry', label: 'Data Entry', icon: Database },
  { to: '/app/activity', label: 'Activity Logs', icon: History },
  { to: '/app/api-keys', label: 'API Keys', icon: Key },
  { to: '/app/compliance', label: 'Compliance', icon: Shield },
  { to: '/app/subscription', label: 'Subscription', icon: CreditCard },
  { to: '/app/integrations', label: 'Integrations', icon: Plug },
  { to: '/app/support', label: 'Support', icon: LifeBuoy },
]

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [failedCount, setFailedCount] = useState(0)
  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    if (!profile) return
    const fetchCount = async () => {
      const { count } = await supabase.from('failed_jobs').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).eq('status', 'pending')
      setFailedCount(count || 0)
    }
    fetchCount()
    const i = setInterval(fetchCount, 60000)
    return () => clearInterval(i)
  }, [profile])

  const handleSignOut = async () => { await signOut(); navigate('/') }

  const renderItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={onClose}
      className={({ isActive }) => clsx(
        'flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all',
        isActive ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:text-fg hover:bg-surface-2'
      )}
    >
      <item.icon className={clsx('w-[18px] h-[18px]', item.badge && failedCount > 0 && 'text-negative')} strokeWidth={1.75} />
      <span className="flex-1">{item.label}</span>
      {item.badge && failedCount > 0 && (
        <span className="bg-negative text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{failedCount > 9 ? '9+' : failedCount}</span>
      )}
    </NavLink>
  )

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside className={clsx(
        'fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-paper border-r border-line flex flex-col transition-transform duration-300',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent-strong text-accent-fg flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-fg text-lg leading-none">Cashiea</h1>
              <p className="text-xs text-fg-subtle mt-0.5">{profile?.company_name || 'AI Platform'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button onClick={onClose} className="lg:hidden text-fg-muted hover:text-fg"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Quick Access */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="px-3.5 mb-1 text-[11px] font-semibold tracking-[0.14em] uppercase text-fg-subtle">Quick Access</p>
          {QUICK_ACCESS.map(renderItem)}

          <button onClick={() => setShowMore(!showMore)} className="flex items-center gap-1.5 px-3.5 mt-4 mb-1 text-[11px] font-semibold tracking-[0.14em] uppercase text-fg-subtle hover:text-fg-muted w-full">
            More
            <ChevronDown className={clsx('w-3.5 h-3.5 ml-auto transition-transform', showMore && 'rotate-180')} />
          </button>
          {showMore && <div className="space-y-1 animate-fade-in">{MORE.map(renderItem)}</div>}
        </nav>

        {/* Profile + sign out */}
        <div className="p-3 border-t border-line">
          <NavLink to="/app/account" onClick={onClose} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-2 transition-colors">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent-strong text-accent-fg flex items-center justify-center text-sm font-bold flex-shrink-0">
              {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg truncate">{profile?.full_name || 'User'}</p>
              <p className="text-[11px] text-fg-subtle truncate">Owner · Edit account</p>
            </div>
          </NavLink>
          <button onClick={handleSignOut} className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-fg-muted hover:text-negative hover:bg-surface-2 transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
