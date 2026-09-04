import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, edgeFunctionUrl } from '../lib/supabase'
import type { ApiKey } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Key, Plus, Loader2, Copy, Trash2, Terminal, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react'
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

/** Masked key display — only the prefix is ever visible after creation. */
function MaskedKey({ prefix }: { prefix: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-fg-muted bg-surface-2 border border-line rounded-lg px-2.5 py-1.5">
      <Key className="w-3.5 h-3.5 text-fg-subtle" />
      <span className="text-fg">{prefix.slice(0, 12)}</span>
      <span className="tracking-widest">••••••••</span>
    </span>
  )
}

function CopyButton({ value, label = 'Copy', className = '' }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-control border border-line text-fg-muted hover:text-fg hover:border-accent/40 transition-colors px-2.5 h-7 ${className}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-positive" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

export default function ApiKeys() {
  const { ownerId } = useAuth()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [revealCreated, setRevealCreated] = useState(true)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const [docTab, setDocTab] = useState<'curl' | 'node' | 'python'>('curl')

  useEffect(() => {
    if (!ownerId) { setKeys([]); setLoading(false); return }
    let active = true
    setLoading(true)
    supabase.from('api_keys').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
      .then(({ data }) => { if (active) { setKeys((data as ApiKey[]) || []); setLoading(false) } })
    return () => { active = false }
  }, [ownerId])

  const loadKeys = async () => {
    if (!ownerId) return
    setLoading(true)
    const { data } = await supabase.from('api_keys').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
    setKeys((data as ApiKey[]) || [])
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!ownerId) { toast.error('Your account is still loading — please try again'); return }
    if (!newName.trim()) return toast.error('Give your key a name')
    const fullKey = randomKey()
    const keyHash = await sha256(fullKey)
    const keyPrefix = fullKey.slice(0, 16)

    const { error } = await supabase.from('api_keys').insert({
      user_id: ownerId,
      name: newName,
      key_prefix: keyPrefix,
      key_hash: keyHash,
    })
    if (error) { toast.error(error.message); return }

    setCreatedKey(fullKey)
    setRevealCreated(true)
    setNewName('')
    setShowCreate(false)
    await loadKeys()
  }

  const handleDelete = async (id: string) => {
    if (confirmRevoke !== id) { setConfirmRevoke(id); return } // two-tap confirm
    const { error } = await supabase.from('api_keys').delete().eq('id', id).eq('user_id', ownerId)
    if (!error) {
      setKeys(keys.filter((k) => k.id !== id))
      setConfirmRevoke(null)
      toast.success('API key revoked')
    }
  }

  const apiUrl = edgeFunctionUrl('')

  const examples: Record<'curl' | 'node' | 'python', { title: string; snippet: (k: string) => string }> = {
    curl: {
      title: 'cURL',
      snippet: (k) =>
        `curl -X POST ${apiUrl}/api-generate-invoice \\\n  -H "x-api-key: ${k}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"prompt":"Invoice for 10 hrs at ₹80/hr, tax 8%, for Acme"}'`,
    },
    node: {
      title: 'Node.js',
      snippet: (k) =>
        `const res = await fetch("${apiUrl}/api-draft-email", {\n  method: "POST",\n  headers: {\n    "x-api-key": "${k}",\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({\n    type: "follow_up",\n    tone: "friendly",\n    points: "Re-engage about trial",\n  }),\n});\nconst data = await res.json();`,
    },
    python: {
      title: 'Python',
      snippet: (k) =>
        `import requests\n\nres = requests.post(\n    "${apiUrl}/api-generate-invoice",\n    headers={"x-api-key": "${k}"},\n    json={"prompt": "Invoice for 10 hrs at ₹80/hr, tax 8%, for Acme"},\n)\nprint(res.json())`,
    },
  }

  return (
    <div className="animate-fade-in max-w-2xl xl:max-w-4xl">
      <PageHeader
        title="API Keys"
        subtitle="Connect Cashiea to your apps, scripts, and automations."
        icon={<Key className="w-5 h-5" />}
        action={
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> New key
          </button>
        }
      />

      {/* Created key — shown once */}
      {createdKey && (
        <div className="card p-5 mb-6 border-accent/40">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-control bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-fg">Key created — copy it now</h3>
              <p className="text-xs text-fg-subtle mt-0.5">
                For security, the full key is shown <strong className="text-fg-muted">only once</strong>. We store only a hash — it can't be recovered later.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <code className="flex-1 min-w-0 truncate font-mono text-xs bg-surface-2 border border-line rounded-control px-3 py-2.5 text-fg">
                  {revealCreated ? createdKey : 'biz_live_' + '•'.repeat(20)}
                </code>
                <button
                  onClick={() => setRevealCreated((v) => !v)}
                  className="w-9 h-9 rounded-control border border-line text-fg-muted hover:text-fg hover:border-accent/40 flex items-center justify-center flex-shrink-0 transition-colors"
                  aria-label={revealCreated ? 'Hide key' : 'Reveal key'}
                >
                  {revealCreated ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <CopyButton value={createdKey} />
              </div>
              <button onClick={() => setCreatedKey(null)} className="btn-ghost text-xs mt-3">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-fg-subtle" /></div>
      ) : keys.length === 0 && !createdKey ? (
        <EmptyState icon={Key} title="No API keys yet" description="Create a key to call Cashiea from your own apps, scripts, or no-code tools like Zapier." />
      ) : (
        <div className="space-y-3 mb-8">
          {keys.map((k) => (
            <div key={k.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-fg truncate">{k.name}</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-positive/10 text-positive">
                      <span className="w-1.5 h-1.5 rounded-full bg-positive" /> Active
                    </span>
                  </div>
                  <div className="mt-2"><MaskedKey prefix={k.key_prefix} /></div>
                  <p className="text-[11px] text-fg-subtle mt-2">
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(k.id)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-control px-2.5 h-7 border transition-colors flex-shrink-0 ${
                    confirmRevoke === k.id
                      ? 'bg-negative text-paper border-negative'
                      : 'border-line text-fg-muted hover:text-negative hover:border-negative/40'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {confirmRevoke === k.id ? 'Confirm revoke' : 'Revoke'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="card p-5 mb-6">
          <label className="label">Key name</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="input-field"
            placeholder="e.g. Production, Zapier, Internal CRM"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleCreate} className="btn-primary text-sm"><Key className="w-4 h-4" /> Create key</button>
          </div>
        </div>
      )}

      {/* API docs */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-fg">Quick start</h3>
        </div>

        <div className="flex items-center gap-2 mb-4 text-xs">
          <span className="text-fg-subtle font-medium">Send your key in the</span>
          <code className="font-mono text-accent bg-accent-soft rounded px-1.5 py-0.5">x-api-key</code>
          <span className="text-fg-subtle font-medium">header to:</span>
        </div>
        <div className="flex items-center gap-2 bg-surface-2 border border-line rounded-control px-3 py-2.5 mb-5">
          <code className="flex-1 min-w-0 truncate font-mono text-xs text-fg">{apiUrl}</code>
          <CopyButton value={apiUrl} label="Copy URL" />
        </div>

        {/* Language tabs */}
        <div className="flex gap-1.5 mb-3">
          {(Object.keys(examples) as ('curl' | 'node' | 'python')[]).map((t) => (
            <button
              key={t}
              onClick={() => setDocTab(t)}
              className={`text-xs font-semibold px-3 h-8 rounded-control border transition-colors ${
                docTab === t ? 'bg-fg text-paper border-fg' : 'bg-surface text-fg-muted border-line hover:text-fg'
              }`}
            >
              {examples[t].title}
            </button>
          ))}
        </div>
        <div className="relative">
          <pre className="bg-surface-2 border border-line rounded-control p-4 text-xs text-fg-muted overflow-x-auto leading-relaxed">
            <code className="font-mono">{examples[docTab].snippet('biz_live_YOUR_KEY')}</code>
          </pre>
          <div className="absolute top-2.5 right-2.5">
            <CopyButton value={examples[docTab].snippet('biz_live_YOUR_KEY')} />
          </div>
        </div>

        <p className="text-xs text-fg-subtle mt-4">
          Works with Zapier, Make, n8n, Python, Node.js — anything that can call a REST API.
        </p>
      </div>
    </div>
  )
}
