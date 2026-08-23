import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { motion, AnimatePresence } from 'framer-motion'
import { askAssistant } from '../lib/ai'
import { getPageContext } from '../lib/pageContext'
import { MerajMark } from './MerajMark'
import { MerajAvatar, deriveAvatarState } from './MerajAvatar'
import { useSpeech } from '../lib/useSpeech'
import {
  X, Send, Loader2, Sparkles, ArrowUpRight, Plus, Zap, MessageCircle,
} from 'lucide-react'

// FloatingMeraj — a small, professional mini-assistant.
// Hidden on the Dashboard and the full AI page (they have their own Meraj
// entry points). On every other page it reads WHICH page the owner is on and
// passes that context to Meraj, so "this", "here", or "this page" questions
// are answered against the screen the owner is actually looking at.

interface Msg {
  role: 'user' | 'meraj'
  text: string
  pending?: { type: string; input: any; preview: any }
}

function render(md: string) {
  return DOMPurify.sanitize(marked.parse(md, { async: false }) as string, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'br', 'code', 'a'],
    ALLOWED_ATTR: ['href'],
  })
}

export default function FloatingMeraj({ pathname }: { pathname: string }) {
  const ctx = getPageContext(pathname)
  const pageContext = ctx ? { name: ctx.name, description: ctx.description } : undefined

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'ask' | 'task'>('ask')
  const [showMode, setShowMode] = useState(false)
  const { speak, stopSpeaking, speaking, startListening, stopListening, listening } = useSpeech()
  const [voiceMode, setVoiceMode] = useState(false)
  const [voiceReply, setVoiceReply] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120)
  }, [open])

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    const next = [...messages, { role: 'user' as const, text: q }]
    setMessages(next)
    setLoading(true)
    const history = messages.slice(-10).map((m) => ({ role: m.role, text: m.text }))
    try {
      const res = await askAssistant(q, false, undefined, mode, undefined, pageContext, history)
      setMessages([...next, { role: 'meraj' as const, text: res.reply, pending: res.pending }])
    } catch (e) {
      setMessages([...next, { role: 'meraj' as const, text: '⚠️ ' + (e instanceof Error ? e.message : 'Something went wrong.') }])
    } finally {
      setLoading(false)
    }
  }

  const confirmAction = async (pending: any) => {
    if (loading) return
    setLoading(true)
    setMessages((m) => [...m, { role: 'user' as const, text: '✓ ' + (pending?.type === 'create_invoice' ? 'Create it' : pending?.type === 'send_whatsapp' ? 'Send it' : 'Add it') }])
    try {
      const res = await askAssistant('', false, undefined, 'task', pending, pageContext)
      setMessages((m) => [...m, { role: 'meraj' as const, text: res.reply }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'meraj' as const, text: '⚠️ ' + (e instanceof Error ? e.message : 'Something went wrong.') }])
    } finally {
      setLoading(false)
    }
  }

  const cancelAction = (idx: number) => {
    setMessages((m) => m.map((msg, i) => (i === idx ? { ...msg, pending: undefined } : msg)))
    setMessages((m) => [...m, { role: 'meraj' as const, text: 'No problem — cancelled.' }])
  }

  const avatarState = deriveAvatarState({ listening, loading, speaking })
  const voiceStatus = listening ? 'Listening…' : loading ? 'Thinking…' : speaking ? 'Speaking…' : ''

  const startVoice = () => {
    if (!navigator.onLine) {
      const m = "Voice needs an internet connection. Please connect, or type your question."
      setVoiceMode(true); setVoiceReply(m); speak(m); setTimeout(() => setVoiceMode(false), 5500)
      return
    }
    setVoiceMode(true); setVoiceReply('')
    const ok = startListening(
      async (text) => {
        if (!navigator.onLine) {
          const m = "No internet connection right now. I'll answer as soon as you're back online."
          setVoiceReply(m); speak(m); return
        }
        setLoading(true)
        try {
          const res = await askAssistant(text, false, undefined, 'ask', undefined, pageContext)
          setVoiceReply(res.reply)
          if (res.reply) speak(res.reply, () => setTimeout(() => { setVoiceMode(false); setVoiceReply('') }, 2000))
          else setTimeout(() => setVoiceMode(false), 1500)
        } catch (e) {
          const m = e instanceof Error ? e.message : 'Something went wrong.'
          setVoiceReply('⚠️ ' + m); speak("Sorry, that didn't work. " + m)
          setTimeout(() => setVoiceMode(false), 3500)
        } finally { setLoading(false) }
      },
      (errMsg) => {
        if (errMsg) { setVoiceReply(errMsg); speak(errMsg) }
        setTimeout(() => setVoiceMode(false), 3500)
      }
    )
    if (!ok) { setVoiceMode(false); setOpen(true) }
  }
  const cancelVoice = () => { stopListening(); stopSpeaking(); setVoiceMode(false); setVoiceReply('') }

  return (
    <>
      {/* Voice-first launcher (desktop). Tap → listen → think → speak. */}
      {voiceMode ? (
        <div className="fixed z-40 bottom-6 right-6 hidden lg:flex flex-col items-center gap-2">
          <MerajAvatar state={avatarState} size="sm" context="panel" />
          {voiceStatus && <p className="text-[11px] font-medium text-fg-muted">{voiceStatus}</p>}
          {voiceReply && (
            <div className="card p-3 max-w-xs text-sm max-h-32 overflow-y-auto scroll-area prose-content" dangerouslySetInnerHTML={{ __html: render(voiceReply) }} />
          )}
          <button onClick={cancelVoice} className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2" aria-label="Cancel"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <button
          onClick={startVoice}
          aria-label="Tap to talk to Meraj"
          className="fixed z-40 bottom-6 right-6 hidden lg:block active:scale-95 transition-transform"
        >
          <span className="relative block">
            <MerajAvatar state={avatarState} size="md" context="floating" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-positive rounded-full border-2 border-paper animate-pulse" />
          </span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto sm:w-[392px] flex flex-col card rounded-2xl overflow-hidden shadow-float"
            style={{ height: '78vh', maxHeight: '78vh' }}
          >
            {/* Header — mark · title · page it's reading · expand · close */}
            <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-line bg-surface">
              <span className="w-8 h-8 rounded-xl bg-accent-soft text-accent ring-1 ring-accent/20 flex items-center justify-center flex-shrink-0">
                <MerajMark size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-fg text-sm leading-tight">Meraj</p>
                <p className="text-[11px] text-accent leading-tight truncate">
                  {ctx ? `Reading · ${ctx.name}` : 'Your shop assistant'}
                </p>
              </div>
              <Link
                to="/app/assistant"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2 flex-shrink-0"
                title="Open full view"
                aria-label="Open full view"
              >
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages (Claude-style, no suggestions) */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-area px-3.5 py-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <span className="w-11 h-11 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-3">
                    <MerajMark size={24} />
                  </span>
                  <p className="text-sm text-fg font-medium">{ctx ? `Ask about ${ctx.name}` : 'Ask me anything'}</p>
                  <p className="text-xs text-fg-subtle mt-1 leading-relaxed max-w-[260px]">
                    {ctx
                      ? `I can see you're on the ${ctx.name} page. Ask me anything about what's here or your business — I'll keep it relevant to this page.`
                      : 'Ask about sales, stock, customers — anything about your business.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((m, i) =>
                    m.role === 'user' ? (
                      <div key={i} className="flex justify-end">
                        <div className="bg-surface-2/70 rounded-2xl rounded-br-md px-3 py-2 max-w-[80%]">
                          <p className="text-sm text-fg whitespace-pre-wrap">{m.text}</p>
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="flex gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MerajMark size={15} />
                        </span>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: render(m.text) }} />
                          {m.pending && (
                            <div className="mt-2.5 flex gap-2">
                              <button onClick={() => confirmAction(m.pending)} disabled={loading} className="btn-primary text-xs flex-1 h-8 px-2">
                                <Sparkles className="w-3.5 h-3.5" /> {m.pending?.type === 'create_invoice' ? 'Create it' : m.pending?.type === 'send_whatsapp' ? 'Send it' : 'Add it'}
                              </button>
                              <button onClick={() => cancelAction(i)} className="btn-secondary text-xs h-8 px-2">Cancel</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                  {loading && (
                    <div className="flex gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MerajMark size={15} />
                      </span>
                      <div className="flex items-center gap-1 pt-2">
                        {[0, 1, 2].map((d) => (
                          <motion.span key={d} className="w-1.5 h-1.5 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Compact Task/Ask mode + input */}
            <div className="border-t border-line p-2.5 bg-surface">
              <div className="flex items-center gap-1.5 mb-2 px-0.5">
                <div className="relative">
                  <button
                    onClick={() => setShowMode((v) => !v)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
                    aria-label="Switch mode"
                  >
                    <Plus className={`w-4 h-4 transition-transform ${showMode ? 'rotate-45' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showMode && (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute bottom-9 left-0 card p-1 w-48 shadow-float z-10">
                        <button onClick={() => { setMode('ask'); setShowMode(false) }} className={`w-full flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-surface-2 ${mode === 'ask' ? 'bg-surface-2' : ''}`}>
                          <MessageCircle className="w-3.5 h-3.5 text-accent mt-0.5" />
                          <div><p className="text-xs font-medium text-fg">Ask</p><p className="text-[10px] text-fg-subtle leading-tight">Conversational</p></div>
                        </button>
                        <button onClick={() => { setMode('task'); setShowMode(false) }} className={`w-full flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-surface-2 ${mode === 'task' ? 'bg-surface-2' : ''}`}>
                          <Zap className="w-3.5 h-3.5 text-accent mt-0.5" />
                          <div><p className="text-xs font-medium text-fg">Task</p><p className="text-[10px] text-fg-subtle leading-tight">Takes actions</p></div>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${mode === 'task' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-fg-muted'}`}>
                  {mode === 'task' ? 'Task' : 'Ask'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder={mode === 'task' ? 'Do anything…' : 'Ask anything…'}
                  className="input-field flex-1 text-sm"
                  disabled={loading}
                />
                <button onClick={send} disabled={loading || !input.trim()} className="btn-primary px-3 h-[42px] flex items-center justify-center" aria-label="Send">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
