import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { ActivityLog } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { exportToCSV, exportToJSON } from '../lib/export'
import { History, Loader2, Download, FileText, BarChart3, Database, ScrollText, Mail, Megaphone, Clock, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'

const actionIcons: Record<string, typeof FileText> = {
  invoice: FileText, report: BarChart3, extract: Database,
  summary: ScrollText, email: Mail, campaign: Megaphone, sentiment: History,
}

export default function ActivityLogs() {
  const { profile } = useAuth()
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs((data as ActivityLog[]) || [])
    setLoading(false)
  }

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.action_type === filter)
  const totalMinutes = logs.reduce((s, l) => s + l.time_saved_minutes, 0)
  const totalMoney = logs.reduce((s, l) => s + Number(l.money_saved), 0)

  const handleExport = (fmt: 'csv' | 'json') => {
    if (logs.length === 0) return toast.error('Nothing to export')
    const rows = logs.map((l) => ({
      date: l.created_at, action: l.action_type, description: l.description,
      time_saved_min: l.time_saved_minutes, money_saved: l.money_saved, provider: l.provider,
    }))
    if (fmt === 'csv') exportToCSV('activity-log', rows)
    else exportToJSON('activity-log', rows)
    toast.success('Exported activity log')
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Activity Logs"
        subtitle="Every automation, with time & money saved"
        icon={<History className="w-5 h-5" />}
        action={
          <div className="flex gap-2">
            <button onClick={() => handleExport('csv')} className="btn-secondary text-xs"><Download className="w-3.5 h-3.5" /> CSV</button>
            <button onClick={() => handleExport('json')} className="btn-secondary text-xs"><Download className="w-3.5 h-3.5" /> JSON</button>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <Clock className="w-5 h-5 text-green-400 mb-1" />
          <p className="text-xl font-bold text-white">{(totalMinutes / 60).toFixed(1)}h</p>
          <p className="text-xs text-slate-400">Time saved</p>
        </div>
        <div className="card p-4">
          <DollarSign className="w-5 h-5 text-emerald-400 mb-1" />
          <p className="text-xl font-bold text-white">${totalMoney.toFixed(0)}</p>
          <p className="text-xs text-slate-400">Money saved</p>
        </div>
        <div className="card p-4">
          <History className="w-5 h-5 text-brand-400 mb-1" />
          <p className="text-xl font-bold text-white">{logs.length}</p>
          <p className="text-xs text-slate-400">Total actions</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'invoice', 'report', 'extract', 'summary', 'email', 'campaign'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all border ${
              filter === f ? 'border-brand-600 bg-brand-600/20 text-brand-300' : 'border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" description="Your automation history will appear here, including time and money saved per action." />
      ) : (
        <div className="card divide-y divide-slate-800">
          {filtered.map((log) => {
            const Icon = actionIcons[log.action_type] || History
            return (
              <div key={log.id} className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{log.description || log.action_type}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(log.created_at).toLocaleString()} · {log.action_type}
                    {log.provider && ` · ${log.provider}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-green-400">+{log.time_saved_minutes}m</p>
                  <p className="text-xs text-emerald-400">${Number(log.money_saved).toFixed(0)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
