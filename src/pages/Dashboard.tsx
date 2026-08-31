import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  DollarSign, ShoppingCart, Users, Package, TrendingUp, ArrowRight,
  Sparkles, Clock, AlertTriangle, Receipt, Gift, Megaphone, Zap, Send, Loader2,
} from 'lucide-react'
import { PLANS } from '../lib/types'
import type { ActivityLog, Transaction, Product, Customer } from '../lib/types'
import { askAssistant } from '../lib/ai'
import MerajDevice from '../components/MerajDevice'
import {
  computeBusinessMood, isLowStock, averageDailyRevenue, type BusinessMood,
} from '../lib/businessMood'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ todayRevenue: 0, todayOrders: 0, monthRevenue: 0, customers: 0, products: 0 })
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([])
  const [recentSales, setRecentSales] = useState<Transaction[]>([])
  const [lowStock, setLowStock] = useState<Product[]>([])
  const [dormantCount, setDormantCount] = useState(0)
  const [savings, setSavings] = useState({ timeMinutes: 0, money: 0, actions: 0 })
  const [recent, setRecent] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  // Meraj (AI assistant) on the dashboard
  const [merajLoading, setMerajLoading] = useState(false)
  const [merajReply, setMerajReply] = useState('')
  const [merajInput, setMerajInput] = useState('')
  const [businessMood, setBusinessMood] = useState<BusinessMood | null>(null)

  const renderSafeMarkdown = (md: string) =>
    DOMPurify.sanitize(marked.parse(md, { async: false }) as string, {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'p', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'br', 'hr', 'code', 'blockquote', 'a'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    })

  const askMeraj = async (text: string, briefing = false) => {
    const q = text.trim()
    if (merajLoading || (!q && !briefing)) return
    setMerajLoading(true)
    setMerajInput('')
    try {
      const reply = await askAssistant(briefing ? '' : q, briefing)
      setMerajReply(reply)
    } catch (e) {
      setMerajReply('⚠️ ' + (e instanceof Error ? e.message : 'Something went wrong.'))
    } finally {
      setMerajLoading(false)
    }
  }

  useEffect(() => {
    if (!profile) return
    loadOverview()
  }, [profile])

  const loadOverview = async () => {
    setLoading(true)
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startRecent = new Date(now.getTime() - 14 * 86400000).toISOString()

    const [todayTx, monthTx, recentTx, cust, prod, logs, overdueInv] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', profile!.id).eq('status', 'completed').gte('created_at', startToday),
      supabase.from('transactions').select('*').eq('user_id', profile!.id).eq('status', 'completed').gte('created_at', startMonth),
      supabase.from('transactions').select('created_at, total').eq('user_id', profile!.id).eq('status', 'completed').gte('created_at', startRecent).lt('created_at', startToday),
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', profile!.id),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('user_id', profile!.id),
      supabase.from('activity_logs').select('*').eq('user_id', profile!.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('invoices').select('id').eq('user_id', profile!.id).eq('status', 'overdue'),
    ])

    const todayData = (todayTx.data as Transaction[]) || []
    const monthData = (monthTx.data as Transaction[]) || []
    const todayRevenue = todayData.reduce((s, t) => s + Number(t.total), 0)
    const monthRevenue = monthData.reduce((s, t) => s + Number(t.total), 0)

    setStats({
      todayRevenue, todayOrders: todayData.length, monthRevenue,
      customers: cust.count || 0, products: prod.count || 0,
    })

    // Top products from this month's transactions
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {}
    monthData.forEach((t) => {
      (t.items || []).forEach((item) => {
        const key = item.product_id || item.name
        if (!productMap[key]) productMap[key] = { name: item.name, qty: 0, revenue: 0 }
        productMap[key].qty += item.quantity
        productMap[key].revenue += item.quantity * item.unit_price
      })
    })
    setTopProducts(Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5))
    setRecentSales(todayData.slice(0, 6))

    // Low stock — the SAME detection predicate the businessMood uses
    // (lib/businessMood.ts), so the alert card and Meraj's expression
    // can never disagree.
    const { data: allProducts } = await supabase.from('products').select('*').eq('user_id', profile!.id)
    const productsList = (allProducts as Product[]) || []
    const lowStockAll = productsList.filter(isLowStock)
    setLowStock(lowStockAll.slice(0, 5))

    // Meraj's resting mood — one shared calculation, no hardcoding.
    setBusinessMood(computeBusinessMood({
      todayRevenue,
      recentAvgDailyRevenue: averageDailyRevenue(recentTx.data as Transaction[] || []),
      overdueInvoiceCount: (overdueInv.data ?? []).length,
      lowStockCount: lowStockAll.length,
    }))

    // Dormant customers (60+ days)
    const { data: custList } = await supabase.from('customers').select('last_purchase_at, total_orders').eq('user_id', profile!.id)
    const dormant = ((custList as Pick<Customer, 'last_purchase_at' | 'total_orders'>[]) || []).filter((c) => {
      if (c.total_orders === 0) return false
      if (!c.last_purchase_at) return false
      return (Date.now() - new Date(c.last_purchase_at).getTime()) / 86400000 > 60
    })
    setDormantCount(dormant.length)

    if (logs.data) {
      const full = logs.data as ActivityLog[]
      setSavings({
        timeMinutes: full.reduce((s, l) => s + (l.time_saved_minutes || 0), 0),
        money: full.reduce((s, l) => s + Number(l.money_saved || 0), 0),
        actions: full.length,
      })
      setRecent(full.slice(0, 5))
    }
    setLoading(false)
  }

  const usagePercent = profile ? Math.min(100, (profile.api_usage_count / profile.api_usage_limit) * 100) : 0
  const trialActive = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date()
  const trialDaysLeft = trialActive ? Math.max(0, Math.ceil((new Date(profile!.trial_ends_at!).getTime() - Date.now()) / 86400000)) : 0

  if (loading) {
    return <div className="flex justify-center py-20"><Clock className="w-8 h-8 animate-spin text-brand-500" /></div>
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Welcome back, {profile?.full_name?.split(' ')[0] || 'there'} 👋</h1>
        <p className="text-slate-400 mt-1">Here's your business at a glance.</p>
      </div>

      {trialActive && (
        <div className="card p-4 mb-6 bg-gradient-to-r from-brand-600/20 to-purple-600/10 border-brand-600/40 flex items-center gap-3">
          <Gift className="w-5 h-5 text-brand-400 flex-shrink-0" />
          <p className="text-sm text-slate-200"><span className="font-bold text-white">Free Pro Trial</span> — {trialDaysLeft} days left.</p>
          <Link to="/app/subscription" className="ml-auto btn-secondary text-xs whitespace-nowrap">Manage</Link>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-5 bg-gradient-to-br from-green-500/10 to-transparent">
          <div className="flex items-center gap-2 mb-2"><DollarSign className="w-5 h-5 text-green-400" /><span className="text-xs text-slate-400">Today's Revenue</span></div>
          <p className="text-3xl font-extrabold text-white">${stats.todayRevenue.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.todayOrders} sales today</p>
        </div>
        <div className="card p-5 bg-gradient-to-br from-brand-500/10 to-transparent">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-5 h-5 text-brand-400" /><span className="text-xs text-slate-400">This Month</span></div>
          <p className="text-3xl font-extrabold text-white">${stats.monthRevenue.toFixed(0)}</p>
          <p className="text-xs text-slate-500 mt-1">total revenue</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2"><Users className="w-5 h-5 text-purple-400" /><span className="text-xs text-slate-400">Customers</span></div>
          <p className="text-3xl font-extrabold text-white">{stats.customers}</p>
          <Link to="/app/customers" className="text-xs text-brand-400 hover:text-brand-300 mt-1 inline-block">View →</Link>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2"><Package className="w-5 h-5 text-amber-400" /><span className="text-xs text-slate-400">Products</span></div>
          <p className="text-3xl font-extrabold text-white">{stats.products}</p>
          <Link to="/app/products" className="text-xs text-brand-400 hover:text-brand-300 mt-1 inline-block">View →</Link>
        </div>
      </div>

      {/* Meraj — AI assistant on the dashboard. The device-character's
          resting face shows the real businessMood at a glance; while a
          briefing/question is in flight it switches to 'thinking'. */}
      <div className="card p-6 mb-6 bg-gradient-to-br from-brand-600/10 to-transparent border-brand-600/30">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <MerajDevice
            size="md"
            context="card"
            interactionState={merajLoading ? 'thinking' : 'idle'}
            businessMood={businessMood ?? 'neutral'}
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white flex items-center gap-2">Meraj <span className="text-xs font-normal text-slate-400">— your Cashiea AI assistant</span></h3>
            <p className="text-xs text-slate-400">
              {businessMood === 'happy'
                ? 'Meraj noticed business is going well today.'
                : businessMood === 'sad'
                  ? 'Meraj noticed something needs your attention today.'
                  : "Ask about today's sales, stock, or customers — or get a quick briefing."}
            </p>
          </div>
          <button onClick={() => askMeraj('', true)} disabled={merajLoading} className="btn-primary text-xs flex items-center gap-1.5 whitespace-nowrap"><Sparkles className="w-3.5 h-3.5" /> Briefing</button>
        </div>

        {merajReply && (
          <div className="bg-slate-900/40 rounded-xl p-4 mb-3 border border-slate-700/50">
            <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(merajReply) }} />
          </div>
        )}
        {merajLoading && !merajReply && (
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-3"><Loader2 className="w-4 h-4 animate-spin text-brand-400" /> Meraj is analyzing your business…</div>
        )}

        <div className="flex gap-2">
          <input
            value={merajInput}
            onChange={(e) => setMerajInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askMeraj(merajInput)}
            placeholder="Ask Meraj anything about your business…"
            className="input-field flex-1"
            disabled={merajLoading}
          />
          <button onClick={() => askMeraj(merajInput)} disabled={merajLoading || !merajInput.trim()} className="btn-primary px-4 flex items-center justify-center" aria-label="Ask Meraj">
            {merajLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <Link to="/app/assistant" className="text-xs text-brand-400 hover:text-brand-300 mt-3 inline-block">Open full chat with Meraj →</Link>
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Link to="/app/pos" className="card p-5 bg-gradient-to-br from-brand-500/15 to-transparent hover:border-brand-600 transition-all group flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-900/50 flex items-center justify-center"><ShoppingCart className="w-5.5 h-5.5 text-brand-400" /></div>
            <div><h3 className="font-semibold text-white">New Sale</h3><p className="text-sm text-slate-400">Ring up at the counter</p></div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </Link>
        <Link to="/app/customers" className="card p-5 bg-gradient-to-br from-purple-500/15 to-transparent hover:border-brand-600 transition-all group flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-900/50 flex items-center justify-center"><Users className="w-5.5 h-5.5 text-purple-400" /></div>
            <div><h3 className="font-semibold text-white">Add Customer</h3><p className="text-sm text-slate-400">Capture client details</p></div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </Link>
        <Link to="/app/campaigns" className="card p-5 bg-gradient-to-br from-pink-500/15 to-transparent hover:border-brand-600 transition-all group flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-900/50 flex items-center justify-center"><Megaphone className="w-5.5 h-5.5 text-pink-400" /></div>
            <div><h3 className="font-semibold text-white">Retarget</h3><p className="text-sm text-slate-400">Win back customers</p></div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Today's sales */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2"><Receipt className="w-5 h-5 text-brand-400" /> Today's Sales</h3>
            <Link to="/app/pos" className="text-xs text-brand-400 hover:text-brand-300">New sale →</Link>
          </div>
          {recentSales.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No sales yet today. <Link to="/app/pos" className="text-brand-400">Start one →</Link></p>
          ) : (
            <div className="space-y-2">
              {recentSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <div><p className="text-slate-200 font-mono text-xs">{s.receipt_number}</p><p className="text-xs text-slate-500">{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {s.items?.length || 0} items · {s.payment_method}</p></div>
                  <span className="font-semibold text-green-400">${Number(s.total).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top products this month */}
        <div className="card p-6">
          <h3 className="font-semibold text-white flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-brand-400" /> Top Products (month)</h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No sales data yet this month.</p>
          ) : (
            <div className="space-y-2.5">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{p.name}</p><p className="text-xs text-slate-500">{p.qty} sold</p></div>
                  <span className="text-sm font-semibold text-brand-400">${p.revenue.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock alerts */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" /> Low Stock</h3>
            <Link to="/app/products" className="text-xs text-brand-400 hover:text-brand-300">Manage →</Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">All stocked up ✅</p>
          ) : (
            <div className="space-y-2">
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-200 truncate">{p.name}</span>
                  <span className="text-amber-400 font-semibold text-xs flex-shrink-0 ml-2">{p.stock_quantity} left</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Retargeting opportunity */}
        <div className="card p-6 bg-gradient-to-br from-pink-500/10 to-transparent">
          <h3 className="font-semibold text-white flex items-center gap-2 mb-2"><Megaphone className="w-5 h-5 text-pink-400" /> Retargeting Opportunity</h3>
          <p className="text-3xl font-extrabold text-white mt-2">{dormantCount}</p>
          <p className="text-sm text-slate-400 mb-4">customers haven't purchased in 60+ days — prime for a win-back campaign.</p>
          {dormantCount > 0 ? (
            <Link to="/app/customers?segment=dormant" className="btn-primary text-sm w-full">Target dormant customers →</Link>
          ) : (
            <p className="text-xs text-slate-500">No dormant customers right now. 🎉</p>
          )}
        </div>
      </div>
    </div>
  )
}
