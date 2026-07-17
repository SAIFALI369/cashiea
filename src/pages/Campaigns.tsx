import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { EmailCampaign } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { exportToCSV, exportToJSON } from '../lib/export'
import { Megaphone, Plus, Loader2, BarChart3, Mail, MousePointerClick, Reply, Download, Trash2, FlaskConical } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Campaigns() {
  const { profile } = useAuth()
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCampaigns()
  }, [])

  const loadCampaigns = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
    setCampaigns((data as EmailCampaign[]) || [])
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('email_campaigns').delete().eq('id', id)
    if (!error) {
      setCampaigns(campaigns.filter((c) => c.id !== id))
      toast.success('Campaign deleted')
    }
  }

  const handleExport = async (c: EmailCampaign, fmt: 'csv' | 'json') => {
    const { data } = await supabase
      .from('campaign_recipients')
      .select('email, name, variant, status, sentiment, sentiment_score, sent_at, opened_at, clicked_at, replied_at')
      .eq('campaign_id', c.id)
    if (!data || data.length === 0) {
      toast.error('No recipient data to export')
      return
    }
    if (fmt === 'csv') exportToCSV(`campaign-${c.name}`, data)
    else exportToJSON(`campaign-${c.name}`, data)
    toast.success(`Exported ${data.length} recipients`)
  }

  const openRate = (c: EmailCampaign) => (c.sent_count ? Math.round((c.opened_count / c.sent_count) * 100) : 0)
  const replyRate = (c: EmailCampaign) => (c.sent_count ? Math.round((c.replied_count / c.sent_count) * 100) : 0)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Email Campaigns"
        subtitle="Bulk personalized outreach, A/B testing & response tracking"
        icon={<Megaphone className="w-5 h-5" />}
        action={
          <Link to="/app/campaigns/new" className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> New Campaign
          </Link>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create a campaign to send 50+ personalized emails in minutes — with A/B testing, follow-ups & sentiment-tracked replies."
        />
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-white text-lg">{c.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.status === 'sent' ? 'bg-green-500/15 text-green-400' :
                      c.status === 'sending' ? 'bg-blue-500/15 text-blue-400' :
                      c.status === 'scheduled' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>{c.status}</span>
                    {c.ab_enabled && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-500/15 text-purple-300">
                        <FlaskConical className="w-3 h-3" /> A/B Test
                      </span>
                    )}
                    {c.followup_enabled && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/15 text-cyan-300">Follow-ups</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(c.created_at).toLocaleDateString()} · {c.tone} tone
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleExport(c, 'csv')} className="btn-ghost text-xs" title="Export CSV">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="btn-ghost text-xs text-red-400 hover:text-red-300">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Analytics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/60 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="text-xs">Sent</span>
                  </div>
                  <p className="text-xl font-bold text-white">{c.sent_count}</p>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span className="text-xs">Open Rate</span>
                  </div>
                  <p className="text-xl font-bold text-green-400">{openRate(c)}%</p>
                  <p className="text-xs text-slate-500">{c.opened_count} opens</p>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <MousePointerClick className="w-3.5 h-3.5" />
                    <span className="text-xs">Clicks</span>
                  </div>
                  <p className="text-xl font-bold text-blue-400">{c.clicked_count}</p>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Reply className="w-3.5 h-3.5" />
                    <span className="text-xs">Reply Rate</span>
                  </div>
                  <p className="text-xl font-bold text-purple-400">{replyRate(c)}%</p>
                  <p className="text-xs text-slate-500">{c.replied_count} replies</p>
                </div>
              </div>

              {c.status === 'draft' && (
                <div className="mt-4 flex justify-end">
                  <Link to={`/app/campaigns/${c.id}`} className="btn-primary text-xs">
                    Continue Setup →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
