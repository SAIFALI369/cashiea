import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { ApiKey } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Key, Plus, Loader2, Copy, Trash2, Terminal, Check } from 'lucide-react'
import toast from 'react-hot-toast'

// SHA-256 in the browser (matches the edge function hashing)
async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomKey(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return 'biz_live_' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function ApiKeys() {
  const { profile } = useAuth()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadKeys()
  }, [])

  const loadKeys = async () => {
    setLoading(true)
    const { data } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false })
    setKeys((data as ApiKey[]) || [])
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return toast.error('Give your key a name')
    const fullKey = randomKey()
    const keyHash = await sha256(fullKey)
    const keyPrefix = fullKey.slice(0, 16)

    const { error } = await supabase.from('api_keys').insert({
      user_id: profile!.id,
      name: newName,
      key_prefix: keyPrefix,
      key_hash: keyHash,
    })

    if (error) {
      toast.error(error.message)
      return
    }

    setCreatedKey(fullKey)
    setNewName('')
    setShowCreate(false)
    setCopied(false)
    await loadKeys()
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('api_keys').delete().eq('id', id)
    if (!error) {
      setKeys(keys.filter((k) => k.id !== id))
      toast.success('API key revoked')
    }
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const apiUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://YOUR-PROJECT.supabase.co') + '/functions/v1'

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="API Keys"
        subtitle="Integrate BizAutomate AI into your apps & workflows"
        icon={<Key className="w-5 h-5" />}
        action={
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> New Key
          </button>
        }
      />

      {/* Created key reveal */}
      {createdKey && (
        <div className="card p-6 mb-6 border-green-600/40 bg-green-600/5 animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-white">API Key Created — copy it now!</h3>
          </div>
          <p className="text-sm text-slate-400 mb-3">For security, the full key is shown only once. Store it safely.</p>
          <div className="flex items-center gap-2 bg-slate-900 rounded-xl p-3 border border-slate-700">
            <code className="text-sm text-green-300 flex-1 break-all font-mono">{createdKey}</code>
            <button onClick={() => copyKey(createdKey)} className="btn-secondary text-xs whitespace-nowrap">
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button onClick={() => setCreatedKey(null)} className="btn-ghost text-xs mt-3">Dismiss</button>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
      ) : keys.length === 0 && !createdKey ? (
        <EmptyState icon={Key} title="No API keys yet" description="Create a key to call BizAutomate AI from your own apps, scripts, or no-code tools like Zapier." />
      ) : (
        <div className="space-y-3 mb-8">
          {keys.map((k) => (
            <div key={k.id} className="card p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white">{k.name}</p>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400">Active</span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-1">{k.key_prefix}…</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                </p>
              </div>
              <button onClick={() => handleDelete(k.id)} className="btn-ghost text-xs text-red-400 hover:text-red-300">
                <Trash2 className="w-3.5 h-3.5" /> Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="card p-6 mb-6 animate-slide-up">
          <label className="label">Key Name</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className="input-field" placeholder="e.g. Production, Zapier, Internal CRM" />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleCreate} className="btn-primary text-sm">Create Key</button>
          </div>
        </div>
      )}

      {/* API Docs */}
      <div className="card p-6">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-brand-400" /> Quick Start
        </h3>
        <p className="text-sm text-slate-400 mb-4">All requests use your API key in the <code className="text-brand-300">x-api-key</code> header.</p>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-white mb-2">Generate Invoice</p>
            <pre className="bg-slate-900 rounded-xl p-4 text-xs text-slate-300 overflow-x-auto border border-slate-800"><code>{`curl -X POST ${apiUrl}/api-generate-invoice \\
  -H "x-api-key: biz_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"Invoice for 10 hrs at $80/hr, tax 8%, for Acme"}'`}</code></pre>
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-2">Draft Email</p>
            <pre className="bg-slate-900 rounded-xl p-4 text-xs text-slate-300 overflow-x-auto border border-slate-800"><code>{`curl -X POST ${apiUrl}/api-draft-email \\
  -H "x-api-key: biz_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"type":"follow_up","tone":"friendly","points":"Re-engage about trial"}'`}</code></pre>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Works with Zapier, Make, n8n, Python, Node.js — anything that can call a REST API.
        </p>
      </div>
    </div>
  )
}
