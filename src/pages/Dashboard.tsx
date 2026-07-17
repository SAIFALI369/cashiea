import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  FileText,
  BarChart3,
  Database,
  ScrollText,
  Mail,
  Megaphone,
  Zap,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Clock,
  DollarSign,
  Gift,
} from 'lucide-react'
import { PLANS } from '../lib/types'
import type { ActivityLog } from '../lib/types'

const tools = [
  { to: '/app/invoices', icon: FileText, title: 'Generate Invoice', desc: 'Create invoices from text', color: 'from-blue-500/20 to-blue-600/5', iconColor: 'text-blue-400' },
  { to: '/app/reports', icon: BarChart3, title: 'Create Report', desc: 'AI business reports', color: 'from-green-500/20 to-green-600/5', iconColor: 'text-green-400' },
  { to: '/app/data-entry', icon: Database, title: 'Extract Data', desc: 'Parse text into data', color: 'from-amber-500/20 to-amber-600/5', iconColor: 'text-amber-400' },
  { to: '/app/summaries', icon: ScrollText, title: 'Summarize', desc: 'Summarize any text', color: 'from-purple-500/20 to-purple-600/5', iconColor: 'text-purple-400' },
  { to: '/app/email-assistant', icon: Mail, title: 'Write Emails', desc: 'AI email drafts', color: 'from-cyan-500/20 to-cyan-600/5', iconColor: 'text-cyan-400' },
  { to: '/app/campaigns', icon: Megaphone, title: 'Email Campaigns', desc: 'Bulk personalized outreach', color: 'from-pink-500/20 to-pink-600/5', iconColor: 'text-pink-400' },
]

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ invoices: 0, reports: 0, entries: 0, summaries: 0, emails: 0, campaigns: 0 })
  const [savings, setSavings] = useState({ timeMinutes: 0, money: 0, actions: 0 })
  const [recent, setRecent] = useState<ActivityLog[]>([])

  useEffect(() => {
    if (!profile) return
    const loadStats = async () => {
      const [inv, rep, ent, sum, eml, camp] = await Promise.all([
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('data_entries').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('summaries').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('emails').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('email_campaigns').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
      ])
      setStats({
        invoices: inv.count || 0,
        reports: rep.count || 0,
        entries: ent.count || 0,
        summaries: sum.count || 0,
        emails: eml.count || 0,
        campaigns: camp.count || 0,
      })

      // Load savings from activity logs
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('time_saved_minutes, money_saved, action_type, description, created_at, id, user_id, provider, metadata')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (logs) {
        const full = logs as ActivityLog[]
        const timeMinutes = full.reduce((s, l) => s + (l.time_saved_minutes || 0), 0)
        const money = full.reduce((s, l) => s + Number(l.money_saved || 0), 0)
        setSavings({ timeMinutes, money, actions: full.length })
        setRecent(full.slice(0, 5))
      }
    }
    loadStats()
  }, [profile])

  const usagePercent = profile
    ? Math.min(100, (profile.api_usage_count / profile.api_usage_limit) * 100)
    : 0

  const hoursSaved = (savings.timeMinutes / 60).toFixed(1)
  const moneySaved = savings.money.toFixed(0)

  // Trial info
  const trialActive = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date()
  const trialDaysLeft = trialActive
    ? Math.max(0, Math.ceil((new Date(profile!.trial_ends_at!).getTime() - Date.now()) / 86400000))
    : 0

  return (
    <div className="animate-fade-in">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-slate-400 mt-1">What would you like to automate today?</p>
      </div>

      {/* Trial banner */}
      {trialActive && (
        <div className="card p-4 mb-6 bg-gradient-to-r from-brand-600/20 to-purple-600/10 border-brand-600/40 flex items-center gap-3">
          <Gift className="w-5 h-5 text-brand-400 flex-shrink-0" />
          <p className="text-sm text-slate-200">
            <span className="font-bold text-white">Free Pro Trial active</span> — {trialDaysLeft} days left.
            Enjoy boosted AI limits & all providers.
          </p>
          <Link to="/app/subscription" className="ml-auto btn-secondary text-xs whitespace-nowrap">Manage</Link>
        </div>
      )}

      {/* Usage Tracker — saved hours & money */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 bg-gradient-to-br from-green-500/10 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-green-400" />
            <span className="text-xs font-medium text-slate-400">Hours Saved</span>
          </div>
          <p className="text-3xl font-extrabold text-white">{hoursSaved}<span className="text-base text-slate-500 font-normal"> hrs</span></p>
          <p className="text-xs text-slate-500 mt-1">across {savings.actions} automations</p>
        </div>
        <div className="card p-5 bg-gradient-to-br from-emerald-500/10 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-medium text-slate-400">Money Saved</span>
          </div>
          <p className="text-3xl font-extrabold text-white">${moneySaved}</p>
          <p className="text-xs text-slate-500 mt-1">estimated labor cost saved</p>
        </div>
        <div className="card p-5 bg-gradient-to-br from-brand-500/10 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-medium text-slate-400">Tasks Automated</span>
          </div>
          <p className="text-3xl font-extrabold text-white">{stats.invoices + stats.reports + stats.entries + stats.summaries + stats.emails + stats.campaigns}</p>
          <p className="text-xs text-slate-500 mt-1">documents created</p>
        </div>
      </div>

      {/* Quick tools */}
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-brand-400" /> AI Tools
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {tools.map((tool) => (
          <Link
            key={tool.to}
            to={tool.to}
            className={`card p-5 bg-gradient-to-br ${tool.color} hover:border-brand-700/50 transition-all hover:-translate-y-0.5 group`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-900/50 flex items-center justify-center">
                  <tool.icon className={`w-5.5 h-5.5 ${tool.iconColor}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{tool.title}</h3>
                  <p className="text-sm text-slate-400">{tool.desc}</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Usage + plan */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-white">AI Usage This Month</h3>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold text-white">{profile?.api_usage_count || 0}</span>
            <span className="text-slate-400">/ {profile?.api_usage_limit || 50} actions</span>
          </div>
          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-brand-500'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {(profile?.api_usage_limit || 50) - (profile?.api_usage_count || 0)} actions remaining
          </p>
        </div>

        {/* Recent activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-400" />
              <h3 className="font-semibold text-white">Recent Activity</h3>
            </div>
            <Link to="/app/activity" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No activity yet. Run your first AI tool!</p>
          ) : (
            <div className="space-y-2.5">
              {recent.map((log) => (
                <div key={log.id} className="flex items-center gap-3 text-sm">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 truncate capitalize">{log.description || log.action_type}</p>
                    <p className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                  <span className="text-xs text-green-400 whitespace-nowrap">+{log.time_saved_minutes}m</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
