import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { callBrain, googleAuthorizeUrl, syncGoogleSource } from '../lib/ai'
import type { Integration, IntegrationProvider } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Plug, Loader2, CheckCircle2, XCircle, RefreshCw, Sparkles, Mail, Sheet, ShoppingCart, MessageCircle, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

const PROVIDERS: { id: IntegrationProvider; name: string; icon: typeof Mail; desc: string; color: string }[] = [
  { id: 'gmail', name: 'Gmail', icon: Mail, desc: 'Read customer emails, orders, inquiries', color: 'text-red-400' },
  { id: 'google_sheets', name: 'Google Sheets', icon: Sheet, desc: 'Import products, sales, customer lists', color: 'text-green-400' },
  { id: 'excel', name: 'Excel / CSV', icon: Sheet, desc: 'Upload inventory or sales data', color: 'text-emerald-400' },
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, desc: 'Customer messages & order chats', color: 'text-green-500' },
  { id: 'shopify', name: 'Shopify', icon: ShoppingCart, desc: 'Sync products, orders & customers', color: 'text-green-600' },
  { id: 'tally', name: 'Tally', icon: FileText, desc: 'Import accounting & GST data', color: 'text-blue-400' },
]

export default function Integrations() {
  const { profile, ownerId } = useAuth()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<IntegrationProvider | null>(null)
  const [showPaste, setShowPaste] = useState<IntegrationProvider | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [learning, setLearning] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase.from('integrations').select('*').eq('user_id', ownerId)
    setIntegrations((data as Integration[]) || [])
    setLoading(false)
  }

  const getStatus = (p: IntegrationProvider) => integrations.find((i) => i.provider === p)?.status || 'disconnected'
  const getInt = (p: IntegrationProvider) => integrations.find((i) => i.provider === p)

  // Connect — Gmail/Sheets use real Google OAuth; others mark connected
  const connect = async (p: IntegrationProvider) => {
    // Real OAuth flow for Google sources (opens Google consent screen)
    if (p === 'gmail' || p === 'google_sheets') {
      const url = googleAuthorizeUrl(ownerId!, p)
      // If OAuth isn't configured, the function returns a 503; we open it
      // in a new tab and the callback will redirect back here.
      window.open(url, '_blank')
      toast(`Opening Google to connect ${PROVIDERS.find((x) => x.id === p)?.name}…`)
      return
    }

    // Non-Google sources: mark connected (paste-data feeds them)
    setConnecting(p)
    try {
      const { data, error } = await supabase.from('integrations').upsert({
        user_id: ownerId,
        provider: p,
        status: 'connected',
        label: PROVIDERS.find((x) => x.id === p)?.name,
        metadata: { connected_at: new Date().toISOString() },
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' }).select().single()

      if (error) throw error
      setIntegrations((prev) => {
        const others = prev.filter((i) => i.provider !== p)
        return [...others, data as Integration]
      })
      toast.success(`${PROVIDERS.find((x) => x.id === p)?.name} connected`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnecting(null)
    }
  }

  // Live-sync a connected Google source (real Gmail/Sheets fetch)
  const [syncing, setSyncing] = useState<IntegrationProvider | null>(null)
  const liveSync = async (p: IntegrationProvider) => {
    if (p !== 'gmail' && p !== 'google_sheets') return
    setSyncing(p)
    try {
      const result = await syncGoogleSource(p)
      toast.success(`Synced ${result.records_fetched} records from ${PROVIDERS.find((x) => x.id === p)?.name}${result.learned ? ' — AI learned from it' : ''}`)
      await loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  const disconnect = async (p: IntegrationProvider) => {
    const { error } = await supabase.from('integrations').update({ status: 'disconnected', metadata: {} }).eq('user_id', ownerId).eq('provider', p)
    if (!error) {
      setIntegrations(integrations.map((i) => i.provider === p ? { ...i, status: 'disconnected' } : i))
      toast.success('Disconnected')
    }
  }

  // Feed pasted data to the brain so it learns immediately
  const feedData = async () => {
    if (!pasteText.trim()) return toast.error('Paste some data first')
    setLearning(true)
    try {
      const result = await callBrain('learn', { manual_notes: `Data from ${showPaste} source:\n${pasteText}` })
      toast.success('AI learned from this data and updated your business summary')
      setShowPaste(null); setPasteText('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Learning failed')
    } finally {
      setLearning(false)
    }
  }

  const connectedCount = integrations.filter((i) => i.status === 'connected').length

  return (
    <div className="animate-fade-in">
      <PageHeader title="Integrations" subtitle="Connect your apps so the AI can learn your business" icon={<Plug className="w-5 h-5" />} />

      {/* Info banner */}
      <div className="card p-5 mb-6 bg-gradient-to-r from-brand-600/10 to-transparent border-brand-700/30">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-300">
            <p className="font-semibold text-white mb-1">How it works</p>
            <p className="text-slate-400">Connect the apps you already use. The AI fetches your business details (products, customers, sales patterns) and builds a living summary on the <strong className="text-white">AI Brain</strong> page. As it works with you, it learns your preferences and predicts tasks — always asking before acting.</p>
          </div>
        </div>
      </div>

      {/* Paste-data quick feed */}
      {showPaste && (
        <div className="card p-4 mb-6 animate-slide-up border-brand-700/40">
          <h3 className="font-semibold text-white mb-1">Paste data from {PROVIDERS.find((x) => x.id === showPaste)?.name}</h3>
          <p className="text-sm text-slate-400 mb-3">Export from the app and paste here. The AI will learn your business from it right now.</p>
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6} className="input-field resize-none font-mono text-sm" placeholder="Paste products, customer list, sales data, or any business info..." />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => { setShowPaste(null); setPasteText('') }} className="btn-secondary text-sm">Cancel</button>
            <button onClick={feedData} disabled={learning} className="btn-primary text-sm">{learning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {learning ? 'Learning...' : 'Teach AI from this data'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
      ) : PROVIDERS.length === 0 ? (
        <EmptyState icon={Plug} title="No integrations available" description="Integrations will appear here." />
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">{connectedCount} of {PROVIDERS.length} connected</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROVIDERS.map((p) => {
              const status = getStatus(p.id)
              const intObj = getInt(p.id)
              return (
                <div key={p.id} className={`card p-5 ${status === 'connected' ? 'border-green-700/40' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
                        <p.icon className={`w-5.5 h-5.5 ${p.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{p.name}</h3>
                        {status === 'connected' && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-400 mt-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Connected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">{p.desc}</p>
                  {status === 'connected' && intObj?.last_synced_at && (
                    <p className="text-xs text-slate-600 mb-3">Last synced: {new Date(intObj.last_synced_at).toLocaleDateString()}</p>
                  )}

                  {status === 'disconnected' ? (
                    <div className="flex gap-2">
                      <button onClick={() => connect(p.id)} disabled={connecting === p.id} className="btn-primary text-xs flex-1">
                        {connecting === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />} Connect
                      </button>
                      <button onClick={() => setShowPaste(p.id)} className="btn-secondary text-xs" title="Paste data to teach the AI">Paste data</button>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {(p.id === 'gmail' || p.id === 'google_sheets') && (
                        <button onClick={() => liveSync(p.id)} disabled={syncing === p.id} className="btn-primary text-xs flex-1">
                          {syncing === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Live sync
                        </button>
                      )}
                      {!(p.id === 'gmail' || p.id === 'google_sheets') && (
                        <button onClick={() => setShowPaste(p.id)} className="btn-secondary text-xs flex-1"><RefreshCw className="w-3.5 h-3.5" /> Sync data</button>
                      )}
                      <button onClick={() => setShowPaste(p.id)} className="btn-secondary text-xs" title="Paste data to teach the AI">Paste</button>
                      <button onClick={() => disconnect(p.id)} className="btn-ghost text-xs text-red-400"><XCircle className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="card p-4 mt-6 border-amber-600/30 bg-amber-600/5">
            <p className="text-xs text-amber-200/80 leading-relaxed">
              <strong>Live OAuth setup (optional):</strong> To pull data automatically from Gmail or Google Sheets, create a Google Cloud OAuth client and set <code className="text-amber-300">GOOGLE_CLIENT_ID</code> + <code className="text-amber-300">GOOGLE_CLIENT_SECRET</code> secrets. Until then, use <strong>"Paste data"</strong> on any integration to feed info to the AI immediately — it learns from whatever you give it.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
