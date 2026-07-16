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
  Zap,
  TrendingUp,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { PLANS } from '../lib/types'
import type { Invoice, Report, DataEntry, Summary, Email } from '../lib/types'

const tools = [
  { to: '/app/invoices', icon: FileText, title: 'Generate Invoice', desc: 'Create invoices from text', color: 'from-blue-500/20 to-blue-600/5', iconColor: 'text-blue-400' },
  { to: '/app/reports', icon: BarChart3, title: 'Create Report', desc: 'AI business reports', color: 'from-green-500/20 to-green-600/5', iconColor: 'text-green-400' },
  { to: '/app/data-entry', icon: Database, title: 'Extract Data', desc: 'Parse text into data', color: 'from-amber-500/20 to-amber-600/5', iconColor: 'text-amber-400' },
  { to: '/app/summaries', icon: ScrollText, title: 'Summarize', desc: 'Summarize any text', color: 'from-purple-500/20 to-purple-600/5', iconColor: 'text-purple-400' },
  { to: '/app/email-assistant', icon: Mail, title: 'Write Emails', desc: 'AI email drafts', color: 'from-cyan-500/20 to-cyan-600/5', iconColor: 'text-cyan-400' },
]

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ invoices: 0, reports: 0, entries: 0, summaries: 0, emails: 0 })

  useEffect(() => {
    if (!profile) return
    const loadStats = async () => {
      const [inv, rep, ent, sum, eml] = await Promise.all([
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('data_entries').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('summaries').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('emails').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
      ])
      setStats({
        invoices: inv.count || 0,
        reports: rep.count || 0,
        entries: ent.count || 0,
        summaries: sum.count || 0,
        emails: eml.count || 0,
      })
    }
    loadStats()
  }, [profile])

  const usagePercent = profile
    ? Math.min(100, (profile.api_usage_count / profile.api_usage_limit) * 100)
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

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <Link to="/app/invoices" className="text-xs text-slate-500 hover:text-white">View →</Link>
          </div>
          <p className="text-2xl font-bold text-white">{stats.invoices}</p>
          <p className="text-xs text-slate-400">Invoices</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-5 h-5 text-green-400" />
            <Link to="/app/reports" className="text-xs text-slate-500 hover:text-white">View →</Link>
          </div>
          <p className="text-2xl font-bold text-white">{stats.reports}</p>
          <p className="text-xs text-slate-400">Reports</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <Database className="w-5 h-5 text-amber-400" />
            <Link to="/app/data-entry" className="text-xs text-slate-500 hover:text-white">View →</Link>
          </div>
          <p className="text-2xl font-bold text-white">{stats.entries}</p>
          <p className="text-xs text-slate-400">Data Entries</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <ScrollText className="w-5 h-5 text-purple-400" />
            <Link to="/app/summaries" className="text-xs text-slate-500 hover:text-white">View →</Link>
          </div>
          <p className="text-2xl font-bold text-white">{stats.summaries}</p>
          <p className="text-xs text-slate-400">Summaries</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <Mail className="w-5 h-5 text-cyan-400" />
            <Link to="/app/email-assistant" className="text-xs text-slate-500 hover:text-white">View →</Link>
          </div>
          <p className="text-2xl font-bold text-white">{stats.emails}</p>
          <p className="text-xs text-slate-400">Emails</p>
        </div>
      </div>

      {/* Quick tools */}
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-brand-400" /> AI Tools
      </h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {tools.map((tool) => (
          <Link
            key={tool.to}
            to={tool.to}
            className={`card p-6 bg-gradient-to-br ${tool.color} hover:border-brand-700/50 transition-all hover:-translate-y-0.5 group`}
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

      {/* Usage + plan */}
      <div className="grid lg:grid-cols-2 gap-4">
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

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-brand-400" />
            <h3 className="font-semibold text-white">Your Plan</h3>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold text-white capitalize">{PLANS[profile?.plan || 'free'].name}</span>
            <span className="text-slate-400">${PLANS[profile?.plan || 'free'].price}/mo</span>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            {profile?.plan === 'free'
              ? 'Upgrade to unlock more AI actions and features.'
              : 'Thanks for being a paid subscriber! 🎉'}
          </p>
          {profile?.plan === 'free' && (
            <Link to="/app/subscription" className="btn-primary text-sm w-full">
              Upgrade Plan <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
