import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { Store, MapPin, Tag, Sparkles, Phone, User, Loader2, Pencil, Trash2, Plus, Check, X, Brain } from 'lucide-react'
import toast from 'react-hot-toast'

interface Memory {
  summary: string | null
  business_type: string | null
  key_facts: any[]
  preferences?: { remember?: string[]; [k: string]: any } | null
}

/** Facts the owner told Meraj to remember, or that Meraj learned —
 *  fully under the owner's control here: view, edit, delete, add. */
export default function About() {
  const { profile, ownerId } = useAuth()
  const [mem, setMem] = useState<Memory | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<number | null>(null)
  const [editVal, setEditVal] = useState('')
  const [adding, setAdding] = useState(false)
  const [addVal, setAddVal] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!ownerId) { setMem(null); setLoading(false); return }
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('business_memory')
        .select('summary, business_type, key_facts, preferences')
        .eq('user_id', ownerId)
        .maybeSingle()
      if (active) { setMem((data as Memory | null) || null); setLoading(false) }
    })()
    return () => { active = false }
  }, [ownerId])

  const facts: any[] = Array.isArray(mem?.key_facts) ? mem!.key_facts : []
  const remembers: string[] = Array.isArray(mem?.preferences?.remember) ? mem!.preferences!.remember! : []

  const persist = async (nextFacts: any[], nextRemember: string[]) => {
    if (!ownerId) return
    setSaving(true)
    const prefs = { ...(mem?.preferences || {}), remember: nextRemember }
    const { error } = await supabase
      .from('business_memory')
      .update({ key_facts: nextFacts, preferences: prefs })
      .eq('user_id', ownerId)
    setSaving(false)
    if (error) toast.error(error.message)
    else setMem((m) => (m ? { ...m, key_facts: nextFacts, preferences: prefs } : m))
  }

  const factText = (f: any) => (typeof f === 'string' ? f : f?.fact || JSON.stringify(f))

  const saveEdit = (i: number) => {
    if (!editVal.trim()) { setEditing(null); return }
    const next = facts.map((f, idx) => (idx === i ? editVal.trim() : f))
    void persist(next, remembers)
    setEditing(null)
  }

  const delFact = (i: number) => {
    const next = facts.filter((_, idx) => idx !== i)
    void persist(next, remembers)
  }

  const addFact = () => {
    if (!addVal.trim()) { setAdding(false); return }
    void persist([...facts, addVal.trim()], remembers)
    setAddVal(''); setAdding(false)
  }

  return (
    <div className="animate-fade-in max-w-2xl xl:max-w-3xl">
      <PageHeader title="About" subtitle="Your business at a glance — and exactly what Meraj knows about it." icon={<Store className="w-5 h-5" />} />

      {/* Business identity */}
      <div className="card p-5 sm:p-6 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-11 h-11 rounded-control bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
            <Store className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-fg truncate">{profile?.company_name || 'Your business'}</h2>
            <p className="text-sm text-fg-muted">{mem?.business_type || profile?.shop_category || 'Business type not set yet'}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <InfoRow icon={<User className="w-4 h-4" />} label="Owner" value={profile?.full_name || '—'} />
          <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={profile?.phone || '—'} />
          <InfoRow icon={<MapPin className="w-4 h-4" />} label="Location" value={profile?.business_address || '—'} />
          <InfoRow icon={<Tag className="w-4 h-4" />} label="Category" value={profile?.shop_category || '—'} />
        </div>
      </div>

      {/* What Meraj remembers — owner-controlled */}
      <div className="card p-5 sm:p-6 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-fg">What Meraj remembers (you told me to)</h3>
        </div>
        <p className="text-xs text-fg-subtle mb-3">Meraj saves a memory only when you explicitly say "remember this". Everything here is yours to edit or delete.</p>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-fg-subtle" /></div>
        ) : remembers.length === 0 ? (
          <p className="text-sm text-fg-subtle">Nothing yet — tell Meraj "remember that…" in chat and it will appear here.</p>
        ) : (
          <ul className="space-y-1.5">
            {remembers.map((r, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-surface-2/60 border border-line px-3 py-2">
                <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span className="text-sm text-fg flex-1 min-w-0">{r}</span>
                <button
                  onClick={() => void persist(facts, remembers.filter((_, idx) => idx !== i))}
                  disabled={saving}
                  aria-label="Delete memory"
                  className="text-fg-subtle hover:text-negative transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Learned business facts — editable */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-fg">What Meraj has learned about your business</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-fg-subtle" /></div>
        ) : mem?.summary ? (
          <p className="text-sm text-fg-muted leading-relaxed whitespace-pre-wrap mb-4">{mem.summary}</p>
        ) : (
          <p className="text-sm text-fg-subtle mb-4">Chat with Meraj about your shop and key details will start appearing here.</p>
        )}

        {facts.length === 0 && !adding ? (
          <p className="text-sm text-fg-subtle">No learned facts yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {facts.map((f, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                {editing === i ? (
                  <>
                    <input
                      autoFocus
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(i); if (e.key === 'Escape') setEditing(null) }}
                      className="flex-1 min-w-0 bg-transparent text-sm text-fg outline-none border-b border-accent/50"
                      aria-label="Edit fact"
                    />
                    <button onClick={() => saveEdit(i)} aria-label="Save" className="text-positive hover:opacity-70"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditing(null)} aria-label="Cancel" className="text-fg-subtle hover:text-fg"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-fg flex-1 min-w-0">{factText(f)}</span>
                    <button onClick={() => { setEditing(i); setEditVal(factText(f)) }} aria-label="Edit" className="text-fg-subtle hover:text-accent transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => delFact(i)} disabled={saving} aria-label="Delete" className="text-fg-subtle hover:text-negative transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              autoFocus
              value={addVal}
              onChange={(e) => setAddVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addFact(); if (e.key === 'Escape') { setAdding(false); setAddVal('') } }}
              placeholder="e.g. Shop closes at 9pm on Sundays"
              className="flex-1 input-field text-sm"
              aria-label="New fact"
            />
            <button onClick={addFact} className="btn-primary !py-1.5 text-xs"><Check className="w-3.5 h-3.5" /> Save</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="btn-secondary !py-1.5 text-xs mt-3">
            <Plus className="w-3.5 h-3.5" /> Add a fact
          </button>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-8 h-8 rounded-lg bg-surface-2 text-fg-muted flex items-center justify-center flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{label}</p>
        <p className="text-sm text-fg truncate">{value}</p>
      </div>
    </div>
  )
}
