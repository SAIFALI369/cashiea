import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { APP_CATALOG, type AppCatalogEntry, type PermissionMode } from '../lib/app-catalog'
import PageHeader from '../components/ui/PageHeader'
import GoogleSheetsConnect from '../components/GoogleSheetsConnect'
import { Plus, Check, Loader2, Trash2, RefreshCw, Zap, X, AlertCircle, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

interface ConnectedApp {
  id: string
  app_slug: string
  app_name: string
  provider_email: string | null
  permission_mode: PermissionMode
  status: string
  last_synced_at: string | null
  created_at: string
}

const C = { bg: 'rgb(var(--paper))', border: 'rgb(var(--line))', blue: 'rgb(var(--accent))', green: 'rgb(var(--positive))', text: 'rgb(var(--fg))', muted: 'rgb(var(--fg-subtle))', amber: 'rgb(var(--warning))', red: 'rgb(var(--negative))' }

const statusInfo: Record<string, { label: string; color: string }> = {
  connected: { label: 'Connected', color: C.green },
  connecting: { label: 'Connecting...', color: C.blue },
  not_connected: { label: 'Not connected', color: C.muted },
  token_expired: { label: 'Token expired', color: C.amber },
  re_auth_required: { label: 'Re-authentication needed', color: C.amber },
  error: { label: 'Error', color: C.red },
  disconnected: { label: 'Disconnected', color: C.muted },
}

export default function ConnectApps() {
  const { profile } = useAuth()
  const [connections, setConnections] = useState<Record<string, ConnectedApp>>({})
  const [loading, setLoading] = useState(true)
  const [activeModal, setActiveModal] = useState<AppCatalogEntry | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const loadConnections = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data } = await supabase.from('connected_apps').select('*').eq('user_id', profile.id)
    const map: Record<string, ConnectedApp> = {}
    ;(data || []).forEach((c: any) => { map[c.app_slug] = c })
    setConnections(map)
    setLoading(false)
  }, [profile])

  useEffect(() => { loadConnections() }, [loadConnections])

  // Check for OAuth callback (?connected=google-sheets or ?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const error = params.get('error')
    if (connected) {
      toast.success(`${connected} connected successfully!`)
      loadConnections()
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (error) {
      toast.error(`Connection failed: ${error}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [loadConnections])

  const startAuth = (app: AppCatalogEntry, permission: PermissionMode) => {
    setActiveModal(null)
    // Build OAuth URL via the google-oauth edge function
    const fnUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co') + '/google-oauth'
    const url = `${fnUrl}?action=authorize&user=${profile!.id}&provider=google_sheets&permission=${permission}`
    window.location.href = url
  }

  const callApi = async (action: string, appSlug: string, extra: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    const base = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')
    const res = await fetch(`${base}/integrations-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action, app_slug: appSlug, ...extra }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`)
    return data
  }

  const handleTest = async (slug: string) => {
    setTesting(slug)
    try {
      const result = await callApi('test', slug)
      toast.success(result.message || 'Connection is healthy')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed')
    } finally { setTesting(null) }
  }

  const handleDisconnect = async (slug: string) => {
    setDisconnecting(slug)
    try {
      await callApi('disconnect', slug)
      await loadConnections()
      toast.success('Disconnected')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally { setDisconnecting(null) }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Connect Apps" subtitle="Connect external apps to let Cashiea AI work with your data" icon={<Zap className="w-5 h-5" />} />

      {/* App cards from catalog */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {APP_CATALOG.filter(app => app.enabled).map((app) => {
          const conn = connections[app.slug]
          const status = conn?.status || 'not_connected'
          const info = statusInfo[status] || statusInfo.not_connected
          const isConnected = status === 'connected'

          return (
            <div key={app.slug} className="rounded-xl p-4 transition-all" style={{ background: 'rgb(var(--surface))', border: `1px solid ${C.border}` }}>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0" style={{ background: app.iconBg, color: app.iconText }}>{app.iconLetter}</div>
                  <div>
                    <h3 className="font-bold" style={{ color: C.text }}>{app.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: info.color }} />
                      <span className="text-xs font-medium" style={{ color: info.color }}>{info.label}</span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-sm leading-relaxed mb-4" style={{ color: C.muted }}>{app.description}</p>

              {/* Connected info */}
              {isConnected && conn && (
                <div className="mb-4 p-3 rounded-xl" style={{ background: C.bg }}>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: C.muted }}>Account: <span style={{ color: C.text }}>{conn.provider_email || 'Connected'}</span></span>
                    <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: C.blue + '15', color: C.blue }}>{conn.permission_mode.replace('_', ' ')}</span>
                  </div>
                  {conn.last_synced_at && <p className="text-xs mt-1" style={{ color: C.muted }}>Last synced: {new Date(conn.last_synced_at).toLocaleString()}</p>}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {!isConnected ? (
                  <button onClick={() => setActiveModal(app)} className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2" style={{ background: `linear-gradient(135deg, ${C.blue}, rgb(var(--gold)))` }}>
                    <Plus className="w-4 h-4" /> Add {app.name}
                  </button>
                ) : (
                  <>
                    <button onClick={() => handleTest(app.slug)} disabled={testing === app.slug} className="px-4 py-2.5 rounded-xl font-medium text-sm transition-all" style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}` }}>
                      {testing === app.slug ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDisconnect(app.slug)} disabled={disconnecting === app.slug} className="flex-1 py-2.5 rounded-xl font-medium text-sm transition-all" style={{ background: C.red + '10', color: C.red, border: `1px solid rgb(var(--negative) / 0.13)` }}>
                      {disconnecting === app.slug ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : <><Trash2 className="w-4 h-4 inline mr-1" /> Disconnect</>}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Coming soon section */}
      <div className="rounded-xl p-4 text-center" style={{ background: 'rgb(var(--surface))', border: `1px dashed ${C.border}` }}>
        <p className="text-sm font-medium mb-1" style={{ color: C.muted }}>More apps coming soon</p>
        <p className="text-xs" style={{ color: C.muted }}>Gmail, Razorpay, Tally, Shopify, and more</p>
      </div>

      {/* Verification modal */}
      {activeModal && (
        <GoogleSheetsConnect
          app={activeModal}
          onClose={() => setActiveModal(null)}
          onStartAuth={(permission) => startAuth(activeModal, permission)}
        />
      )}

      {loading && (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" style={{ color: C.blue }} /></div>
      )}
    </div>
  )
}
