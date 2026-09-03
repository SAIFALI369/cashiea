import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { APP_CATALOG, oauthProviderForSlug, type AppCatalogEntry, type PermissionMode } from '../lib/app-catalog'
import { googleAuthorizeUrl } from '../lib/ai'
import PageHeader from '../components/ui/PageHeader'
import ConnectAppModal from '../components/ConnectAppModal'
import DrivePicker from '../components/DrivePicker'
import { Plus, Loader2, Trash2, RefreshCw, Zap, FolderOpen, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

interface SelectedFile { id: string; name: string; mimeType: string }
interface SelectedSpreadsheet { id: string; name: string }
interface ConnectedApp {
  id: string
  app_slug: string
  app_name: string
  provider_email: string | null
  permission_mode: PermissionMode
  status: string
  last_synced_at: string | null
  created_at: string
  metadata?: { selectedFiles?: SelectedFile[]; spreadsheet_id?: string; spreadsheet_name?: string; spreadsheet_url?: string } | null
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

const SAFE_CONNECTION_FIELDS = 'id,user_id,app_slug,app_name,provider_email,permission_mode,status,last_synced_at,metadata,created_at,updated_at'

export default function ConnectApps() {
  const { ownerId } = useAuth()
  const [connections, setConnections] = useState<Record<string, ConnectedApp>>({})
  const [loading, setLoading] = useState(true)
  const [activeModal, setActiveModal] = useState<AppCatalogEntry | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [drivePickerOpen, setDrivePickerOpen] = useState(false)
  const [driveFiles, setDriveFiles] = useState<SelectedFile[]>([])
  const [selectedDriveFiles, setSelectedDriveFiles] = useState<SelectedFile[]>([])
  const [savingDriveSelection, setSavingDriveSelection] = useState(false)
  const [spreadsheetIdDraft, setSpreadsheetIdDraft] = useState('')
  const [savingSpreadsheet, setSavingSpreadsheet] = useState(false)

  const loadConnections = useCallback(async () => {
    if (!ownerId) {
      setConnections({})
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase.from('connected_apps').select(SAFE_CONNECTION_FIELDS).eq('user_id', ownerId)
    const map: Record<string, ConnectedApp> = {}
    ;(data || []).forEach((c: any) => { map[c.app_slug] = c })
    setConnections(map)
    setLoading(false)
  }, [ownerId])

  useEffect(() => { void loadConnections() }, [loadConnections])

  useEffect(() => {
    setSpreadsheetIdDraft(connections['google-sheets']?.metadata?.spreadsheet_id || '')
  }, [connections])

  useEffect(() => {
    if (!ownerId) return
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
  }, [loadConnections, ownerId])

  const startAuth = async (app: AppCatalogEntry, permission: PermissionMode) => {
    if (!ownerId) { toast.error('Your account is still loading — please try again'); return }
    setActiveModal(null)
    try {
      let url: string
      if (app.slug === 'canva') {
        const { data, error } = await supabase.functions.invoke('canva-oauth', { body: { action: 'authorize' } })
        if (error) throw error
        if (!data?.url) throw new Error(data?.error || 'Canva authorization failed')
        url = data.url
      } else {
        url = await googleAuthorizeUrl(oauthProviderForSlug(app.slug), permission)
      }
      window.location.assign(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start connection')
    }
  }

  const callApi = async (action: string, appSlug: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('integrations-api', {
      body: { action, app_slug: appSlug, ...extra },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
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

  // Google Drive: list and select files through the server. The OAuth token
  // remains inside integrations-api and is never mounted in the DOM.
  const openDrivePicker = async () => {
    setPicking(true)
    try {
      const result = await callApi('list_drive_files', 'google-drive')
      const files = Array.isArray(result?.files) ? result.files as SelectedFile[] : []
      const existing = connections['google-drive']?.metadata?.selectedFiles || []
      setDriveFiles(files)
      setSelectedDriveFiles(files.filter((file) => existing.some((saved) => saved.id === file.id)))
      setDrivePickerOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load Drive files')
    } finally { setPicking(false) }
  }
  const saveDriveSelection = async (files: SelectedFile[]) => {
    setSavingDriveSelection(true)
    try {
      await callApi('save_drive_files', 'google-drive', { files })
      setSelectedDriveFiles(files)
      setDrivePickerOpen(false)
      await loadConnections()
      toast.success(`${files.length} file${files.length > 1 ? 's' : ''} selected for Meraj`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save selection')
    } finally { setSavingDriveSelection(false) }
  }

  const extractSpreadsheetId = (value: string) => {
    const trimmed = value.trim()
    const fromUrl = trimmed.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/i)
    return (fromUrl?.[1] || trimmed).replace(/[?#].*$/, '')
  }

  const saveSpreadsheet = async () => {
    const spreadsheetId = extractSpreadsheetId(spreadsheetIdDraft)
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(spreadsheetId)) {
      toast.error('Paste a Google Sheets URL or spreadsheet ID')
      return
    }
    setSavingSpreadsheet(true)
    try {
      await callApi('save_spreadsheet', 'google-sheets', { spreadsheet_id: spreadsheetId })
      await loadConnections()
      toast.success('Google Sheet selected for Meraj')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not select spreadsheet')
    } finally { setSavingSpreadsheet(false) }
  }

  const clearSpreadsheet = async () => {
    setSavingSpreadsheet(true)
    try {
      await callApi('clear_spreadsheet', 'google-sheets')
      setSpreadsheetIdDraft('')
      await loadConnections()
      toast.success('Spreadsheet selection cleared')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not clear spreadsheet')
    } finally { setSavingSpreadsheet(false) }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Connect Apps" subtitle="Connect external apps to let Cashiea AI work with your data" icon={<Zap className="w-5 h-5" />} />

      {drivePickerOpen && (
        <DrivePicker
          files={driveFiles}
          selectedIds={selectedDriveFiles.map((file) => file.id)}
          loading={picking}
          saving={savingDriveSelection}
          onRefresh={openDrivePicker}
          onChange={setSelectedDriveFiles}
          onSave={saveDriveSelection}
          onClose={() => setDrivePickerOpen(false)}
        />
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {APP_CATALOG.filter(app => app.enabled).map((app) => {
          const conn = connections[app.slug]
          const status = conn?.status || 'not_connected'
          const info = statusInfo[status] || statusInfo.not_connected
          const isConnected = status === 'connected'
          const isDrive = app.slug === 'google-drive'
          const isSheets = app.slug === 'google-sheets'
          const selected = conn?.metadata?.selectedFiles || []
          const sheetId = typeof conn?.metadata?.spreadsheet_id === 'string' ? conn.metadata.spreadsheet_id : ''
          const selectedSpreadsheet: SelectedSpreadsheet | null = sheetId
            ? { id: sheetId, name: conn?.metadata?.spreadsheet_name || 'Selected spreadsheet' }
            : null

          return (
            <div key={app.slug} className="rounded-xl p-4 transition-all" style={{ background: 'rgb(var(--surface))', border: `1px solid ${C.border}` }}>
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

              {isConnected && conn && (
                <div className="mb-4 p-3 rounded-xl" style={{ background: C.bg }}>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: C.muted }}>Account: <span style={{ color: C.text }}>{conn.provider_email || 'Connected'}</span></span>
                    <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: C.blue + '15', color: C.blue }}>{conn.permission_mode.replace('_', ' ')}</span>
                  </div>
                  {conn.last_synced_at && <p className="text-xs mt-1" style={{ color: C.muted }}>Last synced: {new Date(conn.last_synced_at).toLocaleString()}</p>}
                </div>
              )}

              {/* Sheets: select one spreadsheet by URL or ID. The server
                  validates access with the connected OAuth token and stores only
                  its non-secret metadata. */}
              {isConnected && isSheets && (
                <div className="mb-4 p-3 rounded-xl" style={{ background: C.bg }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: C.text }}>Spreadsheet for Meraj</p>
                  {selectedSpreadsheet && (
                    <a href={`https://docs.google.com/spreadsheets/d/${selectedSpreadsheet.id}`} target="_blank" rel="noreferrer" className="block text-xs truncate mb-2" style={{ color: C.blue }}>
                      {selectedSpreadsheet.name}
                    </a>
                  )}
                  <input
                    value={spreadsheetIdDraft}
                    onChange={(event) => setSpreadsheetIdDraft(event.target.value)}
                    placeholder="Paste Google Sheets URL or ID"
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: 'rgb(var(--surface))', color: C.text, border: `1px solid ${C.border}` }}
                    aria-label="Google Sheets spreadsheet URL or ID"
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveSpreadsheet} disabled={savingSpreadsheet || !spreadsheetIdDraft.trim()} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={{ background: C.blue, color: '#fff' }}>
                      {savingSpreadsheet ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : selectedSpreadsheet ? 'Change sheet' : 'Use this sheet'}
                    </button>
                    {selectedSpreadsheet && <button onClick={clearSpreadsheet} disabled={savingSpreadsheet} className="px-3 py-2 rounded-lg text-xs" style={{ color: C.red, border: `1px solid ${C.border}` }}>Clear</button>}
                  </div>
                  <p className="text-[11px] mt-1.5" style={{ color: C.muted }}>Read-only connects can sync/import. Reconnect with Read &amp; Write before exporting from Cashiea.</p>
                </div>
              )}

              {/* Drive: selected files + picker */}
              {isConnected && isDrive && (
                <div className="mb-4">
                  {selected.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold" style={{ color: C.text }}>Files Meraj can read ({selected.length})</p>
                      {selected.slice(0, 4).map((f) => (
                        <div key={f.id} className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
                          <FileText className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate" style={{ color: C.text }}>{f.name}</span>
                        </div>
                      ))}
                      {selected.length > 4 && <p className="text-[11px]" style={{ color: C.muted }}>+{selected.length - 4} more</p>}
                    </div>
                  ) : (
                    <p className="text-xs mb-2" style={{ color: C.muted }}>No files picked yet — choose which files Meraj can read.</p>
                  )}
                  <button onClick={openDrivePicker} disabled={picking} className="w-full mt-2 py-2 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all" style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}` }}>
                    {picking ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />} {selected.length ? 'Change selection' : 'Pick files'}
                  </button>
                  <p className="text-[11px] mt-1.5" style={{ color: C.muted }}>Files are listed by Cashiea’s server connection; OAuth tokens never reach this browser.</p>
                </div>
              )}

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
                    <button onClick={() => handleDisconnect(app.slug)} disabled={disconnecting === app.slug} className="flex-1 py-2.5 rounded-xl font-medium text-sm transition-all" style={{ background: C.red + '10', color: C.red, border: '1px solid rgb(var(--negative) / 0.13)' }}>
                      {disconnecting === app.slug ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : <><Trash2 className="w-4 h-4 inline mr-1" /> Disconnect</>}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl p-5" style={{ background: 'rgb(var(--surface))', border: `1px dashed ${C.border}` }}>
        <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>More apps — honest status</p>
        <ul className="text-xs space-y-1.5" style={{ color: C.muted }}>
          <li>• <span style={{ color: C.text }}>Excel / OneDrive</span> — needs a separate Microsoft Azure app registration (different from Google).</li>
          <li>• <span style={{ color: C.text }}>WhatsApp, Tally, Paytm/BharatPe/PhonePe</span> — these platforms don't expose a simple "read your history" API. See the report for what's actually possible.</li>
        </ul>
      </div>

      {activeModal && (
        <ConnectAppModal
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
