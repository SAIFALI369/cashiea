import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/ui/PageHeader'
import { StatusPill } from '../components/ui/StatusPill'
import {
  BUILTIN_TEXTS, EVENT_LABELS, addCustom, customQuota, generateGreeting, loadState, playStoredKind, saveState,
  type CustomGreeting, type GreetEvent, type VoiceGreetingState,
} from '../lib/voiceGreetings'
import { AudioLines, Loader2, Mic, Pause, Play, Plus, RefreshCw, Trash2, Volume2 } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Audio — Meraj's living voice settings.
 * One-time-generated greetings (cached in YOUR browser, per account),
 * event triggers, and owner-custom lines (max 3, 1 new per week).
 */

export default function AudioGreetings() {
  const { ownerId, profile } = useAuth()
  const [state, setState] = useState<VoiceGreetingState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [bind, setBind] = useState<GreetEvent | ''>('')

  useEffect(() => {
    if (ownerId) setState(loadState(ownerId))
  }, [ownerId])

  if (!ownerId || !state) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  const name = (profile?.full_name || 'boss').split(' ')[0]
  const quota = customQuota(state)

  const toggle = () => {
    const next = { ...state, enabled: !state.enabled }
    setState(next); saveState(ownerId, next)
    toast.success(next.enabled ? 'Meraj will greet you out loud' : 'Voice greetings off')
  }

  const playFromStorage = async (g: { audio: string; format: string }, key: string) => {
    setPlaying(key)
    await playStoredKind(g)
    setPlaying(null)
  }

  const regen = async (event: GreetEvent) => {
    setBusy(event)
    try {
      const g = await generateGreeting(BUILTIN_TEXTS[event](name))
      const next = { ...state, greetings: { ...state.greetings, [event]: g } }
      setState(next); saveState(ownerId, next)
      toast.success('Voice regenerated')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Generation failed') }
    finally { setBusy(null) }
  }

  const add = async () => {
    if (!text.trim()) return
    setBusy('custom')
    const r = await addCustom(ownerId, text.trim(), (bind || null) as GreetEvent | null)
    setBusy(null)
    if (r.ok) { setState(r.state); setText(''); setBind(''); toast.success('Custom greeting saved — it lives in this browser forever') }
    else toast.error(r.error || 'Could not add')
  }

  const del = (id: string) => {
    const next = { ...state, customs: state.customs.filter((c) => c.id !== id) }
    setState(next); saveState(ownerId, next)
  }

  return (
    <div className="animate-fade-in max-w-2xl xl:max-w-3xl">
      <PageHeader title="Audio" subtitle="Meraj greets you out loud — generated once, saved in this browser, plays forever." icon={<AudioLines className="w-5 h-5" />} />

      {/* Master toggle */}
      <div className="card p-5 mb-5 flex items-center gap-4">
        <span className="w-11 h-11 rounded-control bg-accent-soft text-accent flex items-center justify-center flex-shrink-0"><Volume2 className="w-5 h-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-fg">Meraj's voice greetings</p>
          <p className="text-xs text-fg-muted mt-0.5">App open, first sale, expenses, new customers — in Meraj's own voice.</p>
        </div>
        <button
          role="switch" aria-checked={state.enabled} onClick={toggle} aria-label="Toggle voice greetings"
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${state.enabled ? 'bg-positive' : 'bg-fg-subtle/40'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${state.enabled ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Built-in greetings */}
      <div className="card p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Mic className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-fg">Meraj's lines</h3>
          <span className="ml-auto text-[10px] text-fg-subtle">generated once · saved on this device · never repeated AI cost</span>
        </div>
        <div className="space-y-2">
          {(Object.keys(BUILTIN_TEXTS) as GreetEvent[]).map((ev) => {
            const g = state.greetings[ev]
            return (
              <div key={ev} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-fg">{EVENT_LABELS[ev]}</p>
                  <p className="text-[13px] text-fg-muted mt-0.5 truncate">“{BUILTIN_TEXTS[ev](name)}”</p>
                </div>
                <StatusPill tone={g ? 'success' : 'offline'}>{g ? 'saved' : 'not yet'}</StatusPill>
                {g && (
                  <button onClick={() => void playFromStorage(g, ev)} aria-label="Play" className="text-fg-muted hover:text-accent transition-colors">
                    {playing === ev ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                )}
                <button onClick={() => void regen(ev)} disabled={busy === ev} aria-label="Regenerate" className="text-fg-subtle hover:text-accent transition-colors">
                  {busy === ev ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Custom greetings */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Plus className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-fg">Your own lines</h3>
          <span className="ml-auto text-[10px] font-semibold text-fg-subtle">{state.customs.length}/3 saved · {quota.canGenerate ? '1 generation left this week' : '0 left this week'}</span>
        </div>
        <p className="text-xs text-fg-subtle mb-4">Max 3 customs, one new voice per week — the quota resets every week and never accumulates.</p>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='e.g. "Boss, naya maal aa gaya — jaldi check karo!"'
            className="input-field text-sm flex-1"
            aria-label="Custom greeting text"
            maxLength={200}
          />
          <select value={bind} onChange={(e) => setBind(e.target.value as GreetEvent | '')} className="input-field text-sm sm:max-w-[210px]" aria-label="Play when">
            <option value="">Play on demand only</option>
            {(Object.keys(EVENT_LABELS) as GreetEvent[]).map((ev) => <option key={ev} value={ev}>When: {EVENT_LABELS[ev]}</option>)}
          </select>
          <button onClick={() => void add()} disabled={busy === 'custom' || !text.trim() || !quota.canGenerate || state.customs.length >= 3} className="btn-primary text-sm whitespace-nowrap">
            {busy === 'custom' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />} Generate
          </button>
        </div>

        {state.customs.length === 0 ? (
          <p className="text-sm text-fg-subtle">No custom lines yet — write one above and Meraj will say it in his own voice.</p>
        ) : (
          <div className="space-y-2">
            {state.customs.map((c: CustomGreeting) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-fg truncate">“{c.text}”</p>
                  {c.bind && <p className="text-[10px] font-semibold text-accent mt-0.5">plays when: {EVENT_LABELS[c.bind]}</p>}
                </div>
                <button onClick={() => void playFromStorage(c, c.id)} aria-label="Play" className="text-fg-muted hover:text-accent transition-colors">
                  {playing === c.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => del(c.id)} aria-label="Delete" className="text-fg-subtle hover:text-negative transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
