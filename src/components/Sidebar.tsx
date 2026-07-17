import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PLANS } from '../lib/types'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  FileSignature,
  Wallet,
  Bot,
  FileText,
  BarChart3,
  Database,
  ScrollText,
  Mail,
  Megaphone,
  CreditCard,
  Settings,
  Key,
  History,
  Shield,
  LogOut,
  Sparkles,
  Zap,
  X,
} from 'lucide-react'
import clsx from 'clsx'

const navSections = [
  {
    label: 'Tools',
    items: [
      { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/app/assistant', label: 'AI Assistant', icon: Bot },
      { to: '/app/pos', label: 'Cashier / POS', icon: ShoppingCart },
      { to: '/app/products', label: 'Products', icon: Package },
      { to: '/app/customers', label: 'Customers', icon: Users },
      { to: '/app/quotations', label: 'Quotations', icon: FileSignature },
      { to: '/app/invoices', label: 'Invoices', icon: FileText },
      { to: '/app/accounts', label: 'Accounts', icon: Wallet },
      { to: '/app/suppliers', label: 'Suppliers', icon: Truck },
      { to: '/app/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'AI Tools',
    items: [
      { to: '/app/data-entry', label: 'Data Entry', icon: Database },
      { to: '/app/summaries', label: 'Summaries', icon: ScrollText },
      { to: '/app/email-assistant', label: 'Retargeting Emails', icon: Mail },
      { to: '/app/campaigns', label: 'Campaigns', icon: Megaphone },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/app/activity', label: 'Activity Logs', icon: History },
      { to: '/app/api-keys', label: 'API Keys', icon: Key },
      { to: '/app/compliance', label: 'Compliance', icon: Shield },
      { to: '/app/subscription', label: 'Subscription', icon: CreditCard },
      { to: '/app/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const usagePercent = profile
    ? Math.min(100, (profile.api_usage_count / profile.api_usage_limit) * 100)
    : 0

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          'fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-lg leading-none">BizAutomate</h1>
              <p className="text-xs text-brand-400">AI Platform</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3.5 mb-1 text-xs font-semibold text-slate-600 uppercase tracking-wider">{section.label}</p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all',
                        isActive
                          ? 'bg-brand-600/20 text-brand-300 border border-brand-700/50'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      )
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Usage meter */}
        <div className="p-4 border-t border-slate-800">
          <div className="card p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                AI Usage
              </span>
              <span className="text-xs text-slate-500">
                {profile?.api_usage_count || 0} / {profile?.api_usage_limit || 50}
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  usagePercent > 80
                    ? 'bg-red-500'
                    : usagePercent > 50
                    ? 'bg-amber-500'
                    : 'bg-brand-500'
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 capitalize">
                {PLANS[profile?.plan || 'free'].name} Plan
              </span>
              {profile?.plan === 'free' && (
                <NavLink
                  to="/app/subscription"
                  onClick={onClose}
                  className="text-xs font-bold text-brand-400 hover:text-brand-300"
                >
                  Upgrade →
                </NavLink>
              )}
            </div>
          </div>

          {/* User + sign out */}
          <div className="mt-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {profile?.company_name || 'No company'}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="text-slate-400 hover:text-red-400 transition-colors p-1.5"
              title="Sign out"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
