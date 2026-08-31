import { useState, useRef, useEffect } from 'react'
import { askAssistant } from '../lib/ai'
import MerajDevice from '../components/MerajDevice'
import PageHeader from '../components/ui/PageHeader'
import { useBusinessMood } from '../lib/businessMood'
import { Sparkles, Send, Loader2, User, Volume2, VolumeX } from 'lucide-react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Msg { role: 'user' | 'ai'; text: string }

const CHAT_KEY = 'cashiea_meraj_chat'
const SPEAK_KEY = 'cashiea_meraj_speak'
const MAX_STORED = 50

const suggestions = [
  'How was business today?',
  'Who bought cement last month?',
  'Which customers should I follow up?',
  'What should I reorder?',
  'Why did sales drop?',
]

// Render assistant Markdown safely (marked + DOMPurify).
function renderSafeMarkdown(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'p', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'br', 'hr', 'code', 'blockquote', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}

/** Markdown → plain text, for read-aloud. */
function markdownToPlainText(md: string): string {
  const el = document.createElement('div')
  el.innerHTML = renderSafeMarkdown(md)
  return (el.textContent || '').trim()
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [speakReplies, setSpeakReplies] = useState(() => {
    try { return localStorage.getItem(SPEAK_KEY) === '1' } catch { return false }
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  // Meraj's resting mood (real signals — see lib/businessMood.ts).
  const businessMood = useBusinessMood()

  // Restore the last conversation so the chat survives refresh / reopens.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_KEY)
      if (raw) setMessages(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  // Persist the transcript (capped) as it changes.
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-MAX_STORED)))
    } catch { /* ignore */ }
  }, [messages])

  // Auto-scroll to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  // Stop any read-aloud when leaving the page.
  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) speechSynthesis.cancel()
  }, [])

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) speechSynthesis.cancel()
    setSpeaking(false)
  }

  /** Speak Meraj's reply aloud — this is what drives the 'speaking' state. */
  const speakReply = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(markdownToPlainText(text))
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    speechSynthesis.speak(utterance)
  }

  const toggleSpeakReplies = () => {
    setSpeakReplies((prev) => {
      const next = !prev
      try { localStorage.setItem(SPEAK_KEY, next ? '1' : '0') } catch { /* ignore */ }
      if (!next) stopSpeaking()
      return next
    })
  }

  const send = async (text: string, isBriefing = false) => {
    const q = text.trim()
    if (!q || loading) return
    setInput('')
    stopSpeaking()
    const next: Msg[] = [...messages, { role: 'user', text: q }]
    setMessages(next)
    setLoading(true)
    try {
      const reply = await askAssistant(q, isBriefing)
      setMessages([...next, { role: 'ai', text: reply }])
      if (speakReplies) speakReply(reply)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      toast.error(msg)
      setMessages([...next, { role: 'ai', text: '⚠️ ' + msg }])
    } finally {
      setLoading(false)
    }
  }

  const briefing = async () => {
    setLoading(true)
    stopSpeaking()
    setMessages((m) => [...m, { role: 'user', text: 'Give me my morning briefing' }])
    try {
      const reply = await askAssistant('', true)
      setMessages((m) => [...m, { role: 'ai', text: reply }])
      if (speakReplies) speakReply(reply)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  // Real app state for the device: speaking (response playing) and
  // thinking (request in flight) always take priority over the idle
  // resting mood. 'listening' activates when a mic feature lands.
  const interactionState = speaking ? ('speaking' as const) : loading ? ('thinking' as const) : ('idle' as const)

  const statusLine = speaking
    ? 'Speaking — full answer below…'
    : loading
      ? 'Thinking…'
      : businessMood === 'happy'
        ? 'Business is going well today.'
        : businessMood === 'sad'
          ? 'Meraj noticed something needs your attention.'
          : 'Ask about sales, stock, customers or follow-ups.'

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Meraj"
        subtitle="Your Cashiea AI assistant — sales, stock, customers, follow-ups"
        icon={<MerajDevice size="sm" context="panel" interactionState={interactionState} businessMood={businessMood ?? 'neutral'} className="scale-90" />}
        action={
          <button onClick={briefing} disabled={loading} className="btn-primary text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Morning Briefing
          </button>
        }
      />

      <div className="card flex flex-col" style={{ minHeight: '62vh' }}>
        {/* Device panel header — the character shows WHAT is happening
            (idle mood / listening / thinking / speaking); the FULL
            readable answer always renders in the chat area below. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 border-b border-slate-800">
          <MerajDevice
            size="lg"
            context="panel"
            interactionState={interactionState}
            businessMood={businessMood ?? 'neutral'}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white">Meraj</h2>
            <p className="text-sm text-slate-400 mt-0.5">Your Cashiea AI assistant — plan, track and grow together.</p>
            <p className={clsx('text-xs mt-1.5', speaking ? 'text-brand-300' : loading ? 'text-brand-400 animate-pulse' : 'text-slate-500')}>
              {statusLine}
            </p>
          </div>
          <button
            onClick={toggleSpeakReplies}
            className={clsx(
              'btn-secondary text-xs whitespace-nowrap',
              speakReplies && 'bg-accent-soft border-accent/40',
            )}
            title={speakReplies ? "Read Meraj's replies aloud (on)" : "Read Meraj's replies aloud (off)"}
            aria-pressed={speakReplies}
          >
            {speakReplies ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {speakReplies ? 'Speak on' : 'Speak off'}
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <div className="flex justify-center">
                <MerajDevice size="md" context="panel" interactionState="idle" businessMood={businessMood ?? 'neutral'} />
              </div>
              <h3 className="font-semibold text-white mt-4 mb-1">Hi, I'm Meraj 👋</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
                I'm your Cashiea shop assistant. Ask me about sales, stock, customers, or follow-ups — and tell me anything you'd like me to remember.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="px-3 py-1.5 rounded-full text-xs bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'user' ? (
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-600">
                  <User className="w-4 h-4 text-white" />
                </div>
              ) : (
                <MerajDevice
                  size="sm"
                  context="panel"
                  interactionState="idle"
                  businessMood={businessMood ?? 'neutral'}
                  className="mt-0.5"
                />
              )}
              <div
                className={`rounded-2xl px-4 py-3 max-w-[82%] ${
                  m.role === 'user'
                    ? 'bg-brand-600 text-white rounded-tr-sm'
                    : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-tl-sm'
                }`}
              >
                {m.role === 'ai' ? (
                  <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(m.text) }} />
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <MerajDevice
                size="sm"
                context="panel"
                interactionState="thinking"
                businessMood={businessMood ?? 'neutral'}
                className="mt-0.5"
              />
              <div className="bg-slate-800/80 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 border border-slate-700/60">
                <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                <span className="text-sm text-slate-400">Meraj is analyzing your business…</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-800 p-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(input)}
            placeholder="Ask Meraj about sales, customers, stock…"
            className="input-field flex-1"
            disabled={loading}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="btn-primary px-4 flex items-center justify-center"
            aria-label="Send message"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
