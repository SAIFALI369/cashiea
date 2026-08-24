import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { ApiKey } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Key, Plus, Loader2, Copy, Trash2, Terminal, Check, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

// SHA-256 in the browser (matches the edge function hashing).
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

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-fg">{label}</p>
        <button onClick={copy} className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-muted hover:text-accent transition-colors">
          {copied ? <Check className="w-3 h-3 text-positive" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-paper rounded-control p-3.5 text-[11px] leading-relaxed text-fg-muted overflow-x-auto border border-line"><code>{code}</code></pre>
    </div>
  )
}

export default function ApiKeys() {
  const { ownerId } = useAuth()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadKeys() }, [])

  const loadKeys = async () => {
    setLoading(true)
    const { data } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false })
    setKeys((data as ApiKey[]) || [])
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return toast.error('Give your key a name')
    setCreating(true)
    try {
      const fullKey = randomKey()
      const keyHash = await sha256(fullKey)
      const { error } = await supabase.from('api_keys').insert({
        user_id: ownerId, name: newName, key_prefix: fullKey.slice(0, 16), key_hash: keyHash,
      })
      if (error) { toast.error(error.message); return }
      setCreatedKey(fullKey); setNewName(''); setShowCreate(false); setCopied(false)
      await loadKeys()
    } finally { setCreating(false) }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('api_keys').delete().eq('id', id)
    if (!error) { setKeys(keys.filter((k) => k.id !== id)); toast.success('Key revoked') }
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key); setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const apiUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://YOUR-PROJECT.supabase.co') + '/functions/v1'
  const invoiceCurl = `curl -X POST ${apiUrl}/api-generate-invoice \\\n  -H "x-api-key: biz_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"prompt":"Invoice for 10 hrs at ₹80/hr, tax 8%, for Acme"}'`
  const emailCurl = `curl -X POST ${apiUrl}/api-draft-email \\\n  -H "x-api-key: biz_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"type":"follow_up","tone":"friendly","points":"Re-engage about trial"}'`

  return (
    <div className="animate-fade-in">
      <PageHeader title="API Keys" subtitle="Connect Cashiea to your apps, scripts, and automation tools" icon={<Key className="w-5 h-5" />} />

      <div className="flex justify-end mb-4">
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> New key
        </button>
      </div>

      {/* Created key reveal */}
      {createdKey && (
        <div className="card p-4 mb-6 border-positive/40">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-5 h-5 text-positive" />
            <h3 className="font-semibold text-fg">Key created</h3>
          </div>
          <p className="text-xs text-fg-muted mb-3">Copy it now — for security, the full key is shown only once.</p>
          <div className="flex items-center gap-2 bg-paper rounded-control p-3 border border-line">
            <code className="text-sm text-accent flex-1 break-all font-mono">{createdKey}</code>
            <button onClick={() => copyKey(createdKey)} className="btn-secondary text-xs whitespace-nowrap">
              {copied ? <Check className="w-3.5 h-3.5 text-positive" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button onClick={() => setCreatedKey(null)} className="btn-ghost text-xs mt-3">Got it</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="card p-4 mb-6">
          <label className="label">Key name</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className="input-field" placeholder="e.g. Production, Zapier, CRM" />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleCreate} disabled={creating} className="btn-primary text-sm">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create key
            </button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-fg-subtle" /></div>
      ) : keys.length === 0 && !createdKey ? (
        <EmptyState icon={Key} title="No API keys yet" description="Create a key to call Cashiea from your own apps, scripts, or no-code tools like Zapier, Make, or n8n." />
      ) : (
        <div className="space-y-3 mb-8">
          {keys.map((k) => (
            <div key={k.id} className="card p-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-fg truncate">{k.name}</p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-positive/10 text-positive">Active</span>
                </div>
                <p className="text-xs text-fg-subtle font-mono mt-1">{k.key_prefix}…</p>
                <p className="text-[11px] text-fg-subtle mt-0.5">
                  Created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                </p>
              </div>
              <button onClick={() => handleDelete(k.id)} className="btn-ghost text-xs text-fg-muted hover:text-negative">
                <Trash2 className="w-3.5 h-3.5" /> Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick start */}
      <div className="card p-4">
        <h3 className="font-semibold text-fg mb-1 flex items-center gap-2"><Terminal className="w-4 h-4 text-accent" /> Quick start</h3>
        <p className="text-xs text-fg-muted mb-4">Send your API key in the <code className="text-accent font-mono">x-api-key</code> header.</p>
        <div className="space-y-4">
          <CodeBlock label="Generate invoice" code={invoiceCurl} />
          <CodeBlock label="Draft email" code={emailCurl} />
        </div>
        <p className="text-[11px] text-fg-subtle mt-4">Works with Zapier, Make, n8n, Python, Node.js — anything that speaks REST.</p>
      </div>
    </div>
  )
}
