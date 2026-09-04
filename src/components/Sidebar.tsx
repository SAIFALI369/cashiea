import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import clsx from 'clsx'
import ThemeToggle from './ThemeToggle'
import { can } from '../lib/permissions'
import { requiredCapability } from '../lib/routeCapabilities'
import { Avatar } from './Avatar'
import {
  CashieaLogo } from './CashieaLogo'
import {
  usePendingApprovals } from '../lib/approvals'
import {
  LayoutDashboard, BookOpen, ShoppingCart, Receipt, FileSignature, Users, Truck,
  Sparkles, ListChecks, FileBarChart, MessageCircle, Mail, ScrollText, Database,
  Package, Wallet, History, AlertOctagon, UsersRound,
  Settings as SettingsIcon, Plug, Key, CreditCard, Network, Shield, LifeBuoy,
  UserCircle, Bell, ShieldCheck, Lightbulb, X, LogOut, ChevronDown, ChevronRight,
  TrendingUp, Landmark } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Item { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: boolean; ai?: boolean }
interface Section { label: string; items: Item[] }

// ── CORE NAVIGATION (always visible — the 80% the shop owner uses daily) ──
const CORE: Section[] = [
  { label: 'Today', items: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  { label: 'Sell', items: [
    { to: '/app/pos', label: 'New Sale', icon: ShoppingCart },
    { to: '/app/invoices', label: 'Bills', icon: Receipt },
    { to: '/app/khata', label: 'Khata', icon: BookOpen },
    { to: '/app/quotations', label: 'Quotations', icon: FileSignature },
  ]},
  { label: 'Shop', items: [
    { to: '/app/products', label: 'Stock', icon: Package },
    { to: '/app/customers', label: 'Customers', icon: Users },
    { to: '/app/assistant', label: 'Meraj', icon: Sparkles, ai: true },
  ]},
  { label: 'Money', items: [
    { to: '/app/accounts', label: 'Accounts', icon: Wallet },
    { to: '/app/profit-dashboard', label: 'Profit', icon: TrendingUp },
    { to: '/app/reports', label: 'Reports', icon: FileBarChart },
    { to: '/app/gst-export', label: 'GST Export', icon: FileSignature },
    { to: '/app/bank-import', label: 'Bank Import', icon: Landmark },
  ]},
  { label: 'Settings', items: [
    { to: '/app/settings', label: 'Settings', icon: SettingsIcon },
  ]},
]

// ── MORE TOOLS (expanded by default — Suppliers, Staff, AI Tools, Campaigns) ──
const MORE: Section[] = [
  { label: 'Suppliers & Team', items: [
    { to: '/app/suppliers', label: 'Suppliers', icon: Truck },
    { to: '/app/team', label: 'Staff', icon: UsersRound },
  ]},
  { label: 'AI Tools', items: [
    { to: '/app/brain', label: 'Tasks', icon: ListChecks },
    { to: '/app/campaigns', label: 'Campaigns', icon: MessageCircle },
    { to: '/app/email-assistant', label: 'Email', icon: Mail },
    { to: '/app/summaries', label: 'Summaries', icon: ScrollText },
    { to: '/app/data-entry', label: 'Data Entry', icon: Database },
  ]},
  { label: 'Advanced', items: [
    { to: '/app/activity', label: 'Activity', icon: History },
    { to: '/app/failed-jobs', label: 'Pending', icon: AlertOctagon, badge: true },
    { to: '/app/notifications', label: 'Notifications', icon: Bell },
    { to: '/app/suggestions', label: 'Suggestions', icon: Lightbulb },
    { to: '/app/permissions', label: 'Permissions', icon: ShieldCheck },
  ]},
  { label: 'Connections', items: [
    { to: '/app/connect-apps', label: 'Connect Apps', icon: Plug },
    { to: '/app/integrations', label: 'Integrations', icon: Network },
    { to: '/app/api-keys', label: 'API Keys', icon: Key },
    { to: '/app/subscription', label: 'Subscription', icon: CreditCard },
    { to: '/app/compliance', label: 'Compliance', icon: Shield },
    { to: '/app/support', label: 'Support', icon: LifeBuoy },
    { to: '/app/about', label: 'About', icon: UserCircle },
  ]},
]

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { profile, ownerId, signOut } = useAuth()
  const navigate = useNavigate()
  const [failedCount, setFailedCount] = useState(0)
  // More Tools is EXPANDED by default — Suppliers, Staff, AI Tools and
  // Campaigns are discoverable from the first visit. The choice sticks.
  const [showMore, setShowMore] = useState(() => {
    try { return localStorage.getItem('cashiea_sidebar_more') !== '0' } catch { return true }
  })
  const [collapsed, setCollapsed] = useState(false)
  const { count: pendingApprovals } = usePendingApprovals()

  const toggleMore = () => setShowMore((v) => {
    try { localStorage.setItem('cashiea_sidebar_more', v ? '0' : '1') } catch { /* ignore */ }
    return !v
  })

  useEffect(() => {
    if (!profile) return
    const fetchCount = async () => {
      const { count } = await supabase.from('failed_jobs').select('*', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'pending')
      setFailedCount(count || 0)
    }
    fetchCount()
    const i = setInterval(fetchCount, 60000)
    return () => clearInterval(i)
  }, [profile])

  const handleSignOut = async () => { await signOut(); navigate('/') }

  const renderItem = (item: Item) => {
    const capability = requiredCapability(item.to)
    if (profile && capability && !can(profile.role, capability)) return null
    return (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={onClose}
      className={({ isActive }) => clsx(
        'group relative flex items-center gap-3 rounded-control font-medium text-sm transition-colors min-h-[40px] px-3 py-2',
        collapsed && 'lg:justify-center lg:px-2',
        isActive
          ? 'bg-accent-soft text-accent-strong font-semibold'
          : item.ai
            ? 'text-accent hover:bg-surface-2'
            : 'text-fg-muted hover:text-fg hover:bg-surface-2'
      )}
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-accent" aria-hidden="true" />}
          <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.75} />
          <span className={clsx("flex-1 truncate", collapsed && "lg:hidden")}>{item.label}</span>
          {item.ai && <span className="text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-full bg-accent text-accent-fg">AI</span>}
          {item.badge && failedCount > 0 && (
            <span className="bg-negative text-accent-fg text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{failedCount > 9 ? '9+' : failedCount}</span>
          )}
          {item.to === '/app/notifications' && pendingApprovals > 0 && (
            <span className="bg-accent text-accent-fg text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{pendingApprovals > 9 ? '9+' : pendingApprovals}</span>
          )}
        </>
      )}
    </NavLink>
    )
  }

  return (
    <>
      {/* Backdrop fades in/out; the drawer itself slides (translate-x). */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      <aside className={clsx(
        'fixed lg:sticky top-0 left-0 z-50 h-screen bg-paper border-r border-line flex flex-col transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-72',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex items-center justify-between p-5 border-b border-line">
          <div className="flex items-center gap-2.5">
            <CashieaLogo size={36} />
            <div className="min-w-0">
              <h1 className={clsx("font-bold text-fg text-lg leading-none", collapsed && "lg:hidden")}>Cashiea</h1>
              <p className={clsx("text-xs text-fg-subtle mt-0.5 truncate max-w-[140px]", collapsed && "lg:hidden")}>{profile?.company_name || 'AI Platform'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button onClick={() => setCollapsed((v) => !v)} className="hidden lg:flex icon-btn" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <ChevronRight className={clsx('w-4 h-4 transition-transform duration-300', collapsed ? '' : 'rotate-180')} />
            </button>
            <button onClick={onClose} className="lg:hidden icon-btn" aria-label="Close menu" title="Close menu"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scroll-area px-3 py-4 space-y-5">
          {/* Core — always visible */}
          {CORE.map((section) => (
            <div key={section.label}>
              <p className={clsx("px-3 mb-1.5 text-[10px] font-bold tracking-[0.12em] uppercase text-fg-subtle", collapsed && "lg:hidden")}>{section.label}</p>
              <div className="space-y-0.5">{section.items.map(renderItem)}</div>
            </div>
          ))}

          {/* More Tools — expanded by default, collapsible (choice persists) */}
          <div>
            <button
              onClick={toggleMore}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-control text-sm font-semibold text-fg-subtle hover:text-fg hover:bg-surface-2 transition-colors"
              aria-expanded={showMore}
            >
              {showMore ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span>More Tools</span>
              {failedCount > 0 && (
                <span className="ml-auto bg-negative text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{failedCount > 9 ? '9+' : failedCount}</span>
              )}
            </button>
            {showMore && (
              <div className="space-y-4 mt-2 pl-2 border-l border-line/50">
                {MORE.map((section) => (
                  <div key={section.label}>
                    <p className={clsx("px-3 mb-1.5 text-[10px] font-bold tracking-[0.12em] uppercase text-fg-subtle", collapsed && "lg:hidden")}>{section.label}</p>
                    <div className="space-y-0.5">{section.items.map(renderItem)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="p-3 border-t border-line">
          <NavLink to="/app/account" onClick={onClose} className="flex items-center gap-2.5 p-2 rounded-control hover:bg-surface-2 transition-colors">
            <Avatar url={profile?.avatar_url} name={profile?.full_name} size={36} />
            <div className="min-w-0 flex-1">
              <p className={clsx("text-sm font-medium text-fg truncate", collapsed && "lg:hidden")}>{profile?.full_name || 'User'}</p>
              <p className="text-[11px] text-fg-subtle truncate">{profile?.role ? `${profile.role[0].toUpperCase()}${profile.role.slice(1)}` : 'Account'} · Edit account</p>
            </div>
          </NavLink>
          <button onClick={handleSignOut} className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-control text-sm text-fg-muted hover:text-negative hover:bg-surface-2 transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
