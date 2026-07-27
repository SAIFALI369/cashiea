import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { motion, AnimatePresence } from 'framer-motion'
import { askAssistant } from '../lib/ai'
import { MerajCharacter, type MerajCharState } from '../components/MerajCharacter'
import { History, Camera, Mic, Square, Send, Loader2, Image as ImageIcon, X, Sparkles, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

interface Msg { role: 'user' | 'meraj'; text: string }
interface Convo { id: string; title: string; msgs: Msg[]; ts: number; scope?: string }

const STORE = 'cashiea_meraj_convos'
const SCOPE_LABELS: Record<string, string> = {
  receipts: 'Receipts', reports: 'Reports', emails: 'Emails', whatsapp: 'WhatsApp',
  expenses: 'Expenses', profits: 'Profits', stocks: 'Stocks', tasks: 'Tasks',
}

function render(md: string) {
  return DOMPurify.sanitize(marked.parse(md, { async: false }) as string, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'br', 'code', 'a'],
    ALLOWED_ATTR: ['href'],
  })
}

function useTypewriter(full: string, typing: boolean) {
  const [n, setN] = useState(typing ? 0 : full.length)
  useEffect(() => {
    if (!typing) { setN(full.length); return }
    setN(0)
    const step = Math.max(2, Math.ceil(full.length / 60))
    const id = setInterval(() => setN((p) => { const nx = p + step; if (nx >= full.length) { clearInterval(id); return full.length } return nx }), 16)
    return () => clearInterval(id)
  }, [full, typing])
  return full.slice(0, n)
}

export default function AIAssistant() {
  const [params] = useSearchParams()
  const scope = params.get('scope') || undefined
  const scopeLabel = scope ? SCOPE_LABELS[scope] : undefined

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [convos, setConvos] = useState<Convo[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const [typing, setTyping] = useState(false)
  const lastIdx = messages.length - 1
  const lastIsMeraj = lastIdx >= 0 && messages[lastIdx].role === 'meraj'
  const partial = useTypewriter(lastIsMeraj ? messages[lastIdx].text : '', typing)
  useEffect(() => { if (typing && lastIsMeraj && partial.length >= messages[lastIdx].text.length) setTyping(false) }, [partial, typing, lastIsMeraj, messages])

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [showCam, setShowCam] = useState(false)
  const recRef = useRef<any>(null)
  const [listening, setListening] = useState(false)

  useEffect(() => { try { setConvos(JSON.parse(localStorage.getItem(STORE) || '[]')) } catch { /* ignore */ } }, [])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, loading, typing])

  const persist = (next: Convo[]) => { setConvos(next); try { localStorage.setItem(STORE, JSON.stringify(next.slice(0, 5))) } catch { /* ignore */ } }

  const replying = loading || typing
  const userTyping = !replying && (focused || input.trim().length > 0)
  const charState: MerajCharState = replying ? 'replying' : userTyping ? 'userTyping' : 'idle'

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    const next = [...messages, { role: 'user' as const, text: q }]
    setMessages(next)
    setLoading(true)
    try {
      const reply = await askAssistant(q, false, scope)
      const done = [...next, { role: 'meraj' as const, text: reply }]
      setMessages(done)
      setTyping(true)
      const convo: Convo = { id: crypto.randomUUID(), title: q.slice(0, 48), msgs: done, ts: Date.now(), scope }
      persist([convo, ...convos].slice(0, 5))
    } catch (e) {
      setMessages([...next, { role: 'meraj' as const, text: '⚠️ ' + (e instanceof Error ? e.message : 'Something went wrong.') }])
    } finally {
      setLoading(false)
    }
  }

  const openConvo = (c: Convo) => { setMessages(c.msgs); setShowHistory(false) }
  const newChat = () => { setMessages([]); setShowHistory(false); inputRef.current?.focus() }

  const startListen = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { toast.error('Voice input not supported on this browser.'); return }
    if (recRef.current) { try { recRef.current.stop() } catch { /* ignore */ } }
    const rec = new SR(); rec.lang = 'hi-IN'; rec.interimResults = false; rec.maxAlternatives = 1
    rec.onstart = () => setListening(true); rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript; setInput((p) => (p ? p + ' ' : '') + t) }
    recRef.current = rec; rec.start()
  }
  const stopListen = () => { recRef.current?.stop(); setListening(false) }
  useEffect(() => () => recRef.current?.stop(), [])

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) toast.success('Image attached — visual understanding is coming soon.')
    setShowCam(false); e.target.value = ''
  }

  return (
    <div className="animate-fade-in flex flex-col min-h-0 flex-1 bg-surface">
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

      {/* Top bar: history (left) · title · mark (right) */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
        <button onClick={() => setShowHistory(true)} className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors relative" aria-label="Conversation history">
          <History className="w-5 h-5" strokeWidth={1.75} />
          {convos.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent" />}
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <MerajCharacter state={charState} width={68} />
          <div className="text-left leading-tight">
            <p className="font-semibold text-fg text-sm">Meraj</p>
            {scopeLabel ? <p className="text-[10px] text-accent">Focused · {scopeLabel}</p> : <p className="text-[10px] text-fg-subtle">Your shop assistant</p>}
          </div>
        </div>
        <Link to="/app" className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2"><ArrowLeft className="w-5 h-5" strokeWidth={1.75} /></Link>
      </div>

      {/* Character + messages (full-height scroll) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-area">
        {/* Upper-middle: iPhone-style black bar + full-body robot under it */}
        {!messages.length && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center">
            <p className="text-sm text-fg-muted max-w-xs">{scopeLabel ? `Ask me about ${scopeLabel.toLowerCase()} — I'll keep us focused there.` : 'Ask about sales, stock, customers — anything about your business.'}</p>
          </div>
        )}

        <div className="px-4 pb-4 space-y-3 max-w-2xl mx-auto w-full">
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <span className="text-sm bg-accent-strong text-accent-fg rounded-xl rounded-br-sm px-3.5 py-2 max-w-[80%]">{m.text}</span>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div className="rounded-xl rounded-bl-sm bg-surface-2 border border-line border-l-2 border-l-accent px-4 py-3 max-w-[88%]">
                  <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: render(i === lastIdx && typing ? partial + '▌' : m.text) }} />
                </div>
              </div>
            )
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 bg-surface-2 border border-line rounded-xl rounded-bl-sm px-4 py-3">
                {[0, 1, 2].map((d) => (
                  <motion.span key={d} className="w-1.5 h-1.5 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input bar: camera (mobile) · mic · text · send */}
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2">
          <div className="relative lg:hidden">
            <button onClick={() => setShowCam((s) => !s)} className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors" aria-label="Camera"><Camera className="w-5 h-5" strokeWidth={1.75} /></button>
            <AnimatePresence>
              {showCam && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute bottom-12 left-0 card p-1.5 w-40 shadow-float z-10">
                  <button onClick={() => galleryRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-fg hover:bg-surface-2"><ImageIcon className="w-4 h-4" /> Gallery</button>
                  <button onClick={() => cameraRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-fg hover:bg-surface-2"><Camera className="w-4 h-4" /> Camera</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={listening ? stopListen : startListen} className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-colors ${listening ? 'text-negative bg-negative/10' : 'text-fg-muted hover:text-fg hover:bg-surface-2'}`} aria-label="Voice input">
            {listening ? <Square className="w-4 h-4" /> : <Mic className="w-5 h-5" strokeWidth={1.75} />}
          </button>

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={scopeLabel ? `Ask about ${scopeLabel.toLowerCase()}…` : 'Ask Meraj anything…'}
            className="input-field flex-1 text-sm"
            disabled={loading}
          />
          <button onClick={send} disabled={loading || !input.trim()} className="btn-primary px-3.5 h-11 flex items-center justify-center" aria-label="Send">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* History sheet — last 5 conversations */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 z-20" onClick={() => setShowHistory(false)} />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} className="absolute top-0 left-0 bottom-0 w-72 max-w-[80%] bg-paper border-r border-line z-30 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <p className="text-sm font-semibold text-fg">Recent chats</p>
                <button onClick={() => setShowHistory(false)} className="text-fg-muted hover:text-fg"><X className="w-5 h-5" /></button>
              </div>
              <button onClick={newChat} className="m-3 btn-secondary text-sm"><Sparkles className="w-4 h-4" /> New chat</button>
              <div className="flex-1 overflow-y-auto scroll-area px-3 space-y-1.5">
                {convos.length === 0 && <p className="text-xs text-fg-subtle text-center py-6">No conversations yet.</p>}
                {convos.map((c) => (
                  <button key={c.id} onClick={() => openConvo(c)} className="w-full text-left p-3 rounded-xl border border-line bg-surface hover:bg-surface-2 transition-colors">
                    <p className="text-sm font-medium text-fg truncate">{c.title}</p>
                    <p className="text-[11px] text-fg-subtle mt-0.5">{new Date(c.ts).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
