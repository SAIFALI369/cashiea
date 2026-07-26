import { useState, useRef, useEffect } from 'react'
import { askAssistant } from '../lib/ai'
import { MerajMark } from '../components/MerajMark'
import PageHeader from '../components/ui/PageHeader'
import { Sparkles, Send, Loader2, User } from 'lucide-react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import toast from 'react-hot-toast'

interface Msg { role: 'user' | 'ai'; text: string }

const CHAT_KEY = 'cashiea_meraj_chat'
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

function MerajAvatar({ size = 36 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-accent-soft text-accent ring-1 ring-accent/25 flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <MerajMark size={Math.round(size * 0.62)} />
    </span>
  )
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

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

  const send = async (text: string, isBriefing = false) => {
    const q = text.trim()
    if (!q || loading) return
    setInput('')
    const next: Msg[] = [...messages, { role: 'user', text: q }]
    setMessages(next)
    setLoading(true)
    try {
      const reply = await askAssistant(q, isBriefing)
      setMessages([...next, { role: 'ai', text: reply }])
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
    setMessages((m) => [...m, { role: 'user', text: 'Give me my morning briefing' }])
    try {
      const reply = await askAssistant('', true)
      setMessages((m) => [...m, { role: 'ai', text: reply }])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Meraj"
        subtitle="Your Cashiea AI assistant — sales, stock, customers, follow-ups"
        icon={<MerajAvatar size={28} />}
        action={
          <button onClick={briefing} disabled={loading} className="btn-primary text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Morning Briefing
          </button>
        }
      />

      <div className="card flex flex-col" style={{ minHeight: '62vh' }}>
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <div className="flex justify-center"><MerajAvatar size={64} /></div>
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
                <MerajAvatar size={36} />
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
              <MerajAvatar size={36} />
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
