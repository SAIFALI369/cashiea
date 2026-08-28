import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { motion, AnimatePresence } from 'framer-motion'
import { askAssistant } from '../lib/ai'
import { MerajMark } from '../components/MerajMark'
import { useAuth } from '../context/AuthContext'
import { MerajAvatar, deriveAvatarState } from '../components/MerajAvatar'
import { History, Camera, Mic, Square, Send, Loader2, Image as ImageIcon, X, Sparkles, ArrowLeft, Plus, MessageCircle, Zap, Wallet, Package, TrendingUp, Receipt, FileText, MessageSquareText, BarChart3, Download, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import toast from 'react-hot-toast'

interface Msg { role: 'user' | 'meraj'; text: string; pending?: { type: string; input: any; preview: any }; media?: { type: string; thumb: string; url: string; alt: string; link?: string }[]; image?: string; images?: { url: string; prompt: string; width: number; height: number }[] }
interface Convo { id: string; title: string; msgs: Msg[]; ts: number; scope?: string }

const STORE_BASE = 'cashiea_meraj_convos'
const CURRENT_BASE = 'cashiea_meraj_current'
const ACTIVE_BASE = 'cashiea_meraj_active'
// ── Rotating micro-greetings (2-4 words, fresh each visit, no emoji) ──
const GREETINGS = [
  "Welcome back, boss",
  "Ready to grow?",
  "Let's win today",
  "Your shop, my watch",
  "Kya scene hai?",
  "Bazaar is waiting",
  "Time to hustle",
  "Growth mode: on",
  "What's the plan?",
  "Let's make it count",
]

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

function TypewriterMessage({ text, onDone }: { text: string; onDone: () => void }) {
  const [count, setCount] = useState(0)
  const cb = useRef(onDone); cb.current = onDone
  useEffect(() => {
    setCount(0)
    const step = Math.max(2, Math.ceil(text.length / 45))
    const id = setInterval(() => {
      setCount((c) => { const nc = c + step; if (nc >= text.length) { clearInterval(id); setTimeout(() => cb.current(), 0); return text.length } return nc })
    }, 30)
    return () => clearInterval(id)
  }, [text])
  return <span dangerouslySetInnerHTML={{ __html: render(text.slice(0, count)) + '\u258c' }} />
}

// ── GeneratedImage: renders an AI-generated image with proper loading state ──
// Shows "Generating your image..." (blinking) while the Pollination URL
// generates the image (5-15s), then displays it. Tap to open full screen
// with download / edit / regenerate controls.
function GeneratedImage({ img, onRegenerate }: { img: { url: string; prompt: string; width: number; height: number }; onRegenerate?: (newPrompt: string) => void }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')

  if (failed) {
    return (
      <div className="mt-3 rounded-card border border-negative/30 bg-negative/[0.04] p-6 text-center">
        <p className="text-sm text-negative font-semibold">Image failed to generate</p>
        <p className="text-xs text-fg-muted mt-1">The image service was busy. Try asking Meraj again.</p>
      </div>
    )
  }

  return (
    <>
      <div className="mt-3 rounded-card border border-line overflow-hidden shadow-soft">
        {!loaded ? (
          <div className="flex flex-col items-center justify-center py-16 bg-surface-2">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              className="flex flex-col items-center gap-3"
            >
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-sm font-semibold text-accent">Generating your image…</p>
              <p className="text-xs text-fg-subtle">{img.width}×{img.height} · AI is drawing</p>
            </motion.div>
          </div>
        ) : null}
        <button
          onClick={() => loaded && setFullscreen(true)}
          className={`block w-full ${!loaded ? 'hidden' : ''}`}
        >
          <img
            src={img.url}
            alt={img.prompt}
            className="w-full max-h-[400px] object-contain bg-surface-2"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </button>
        {loaded && (
          <div className="flex items-center justify-between px-3 py-2 bg-surface border-t border-line">
            <p className="text-xs text-fg-subtle truncate flex-1">{img.prompt.slice(0, 50)}</p>
            <span className="text-[10px] font-semibold text-accent">{img.width}×{img.height}</span>
          </div>
        )}
      </div>

      {/* Full-screen viewer with download / edit / regenerate */}
      {fullscreen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => { setFullscreen(false); setEditing(false) }}
        >
          {/* Top bar: close · download · edit */}
          <div className="flex items-center justify-between px-4 py-3 safe-area-pt" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setFullscreen(false); setEditing(false) }} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <a
                href={img.url}
                download
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                aria-label="Download image"
              >
                <Download className="w-5 h-5" />
              </a>
              <button
                onClick={() => { setEditing(!editing); setEditText(editText || img.prompt) }}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                aria-label="Edit image"
              >
                <Pencil className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center overflow-hidden px-4" onClick={() => setFullscreen(false)}>
            <img src={img.url} alt={img.prompt} className="max-w-full max-h-full object-contain rounded-lg" />
          </div>

          {/* Edit panel */}
          {editing && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              className="bg-surface border-t border-line p-4 safe-area-pb"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-semibold text-fg mb-2">Describe what to change:</p>
              <div className="flex items-center gap-2">
                <input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="e.g., make it brighter, add text '50% OFF'…"
                  className="flex-1 rounded-control border border-line bg-paper px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-accent/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editText.trim() && onRegenerate) {
                      onRegenerate(editText.trim())
                      setFullscreen(false)
                      setEditing(false)
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (editText.trim() && onRegenerate) {
                      onRegenerate(editText.trim())
                      setFullscreen(false)
                      setEditing(false)
                    }
                  }}
                  className="w-11 h-11 rounded-control bg-fg text-paper flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity"
                  aria-label="Regenerate with changes"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-fg-subtle mt-2">Tap send to regenerate with your changes combined with the original prompt.</p>
            </motion.div>
          )}
        </motion.div>
      )}
    </>
  )
}

/* ── SmartReply: renders Meraj's markdown as visual components ──────────────
   Detects patterns in the reply and upgrades them:
   • Blockquotes (>) → WhatsApp-style draft bubbles with Edit / Send buttons
   • Short "**Label:** ₹X" lines → KPI cards
   • List items with stock context → traffic-light rows (green/yellow/red)
   • Everything else → normal sanitized markdown                                  */
function SmartReply({ text, onEditDraft, onSendDraft }: { text: string; onEditDraft?: (t: string) => void; onSendDraft?: (t: string) => void }) {
  const blocks: string[] = text.split(/\n\n+/).filter((b) => b.trim())
  return (
    <>
      {blocks.map((block, i) => {
        const b = block.trim()
        // 1) Blockquote(s) → WhatsApp draft bubble
        if (b.startsWith('>')) {
          const draft = b.split('\n').map((l) => l.replace(/^>\s?/, '')).join('\n').trim()
          return (
            <div key={i} className="my-3 rounded-2xl border border-positive/25 bg-positive/[0.04] p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquareText className="w-4 h-4 text-positive" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-positive">Draft message — ready to send</span>
              </div>
              <div className="rounded-xl rounded-tl-sm bg-positive/[0.08] border border-positive/20 px-3.5 py-2.5">
                <p className="text-sm text-fg whitespace-pre-wrap leading-relaxed">{draft}</p>
              </div>
              {(onEditDraft || onSendDraft) && (
                <div className="flex gap-2 mt-2.5">
                  {onEditDraft && (
                    <button onClick={() => onEditDraft(draft)} className="flex-1 h-8 text-xs font-semibold rounded-control border border-line text-fg-muted hover:text-fg hover:border-accent/40 transition-colors">
                      Edit Message
                    </button>
                  )}
                  {onSendDraft && (
                    <button onClick={() => onSendDraft(draft)} className="flex-1 h-8 text-xs font-semibold rounded-control bg-fg text-paper hover:opacity-90 transition-opacity">
                      Send Now
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        }
        // 2) KPI row: 2-4 lines of "**Label:** ₹amount"
        const kpiLines = b.split('\n').map((l) => l.replace(/^[-*]\s+/, '').trim())
        const isKpi = kpiLines.length >= 2 && kpiLines.length <= 4 && kpiLines.every((l) => /^\*\*(.+?)\**\s*:?\s*₹?[\d,.]+/i.test(l))
        if (isKpi) {
          return (
            <div key={i} className="my-2 grid grid-cols-2 gap-2 max-w-md">
              {kpiLines.map((l, j) => {
                const m = l.match(/\*\*(.+?):?\**\s*:?\s*(₹?[\d,.]+)/i)
                if (!m) return null
                return (
                  <div key={j} className="rounded-control border border-line bg-surface px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle truncate">{m[1]}</p>
                    <p className="text-base font-bold text-fg tabular-nums leading-tight mt-0.5">{m[2]}</p>
                  </div>
                )
              })}
            </div>
          )
        }
        // 3) Traffic-light list: bullet items mentioning stock/qty context
        const listItems = b.split('\n').filter((l) => /^[-*]\s+/.test(l))
        const stocky = listItems.length >= 2 && listItems.some((l) => /stock|left|qty|quantity|units|pcs|reorder|inventory/i.test(l)) && !isKpi
        if (stocky) {
          return (
            <div key={i} className="my-2 space-y-1.5">
              {b.split('\n').map((l, j) => {
                if (!/^[-*]\s+/.test(l)) {
                  if (/^#{1,3}\s/.test(l)) return <p key={j} className="text-xs font-bold uppercase tracking-wide text-fg-subtle mt-2 mb-1" dangerouslySetInnerHTML={{ __html: render('**' + l.replace(/^#{1,3}\s+/, '') + '**') }} />
                  return null
                }
                const item = l.replace(/^[-*]\s+/, '')
                const low = /low|reorder|kam|running out/i.test(item)
                const out = /out of stock|critical|0 left|finished|khali/i.test(item)
                return (
                  <div key={j} className="flex items-center gap-2.5 rounded-control border border-line bg-surface px-3 py-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${out ? 'bg-negative' : low ? 'bg-warning' : 'bg-positive'}`} />
                    <span className="text-sm text-fg flex-1 min-w-0" dangerouslySetInnerHTML={{ __html: render(item) }} />
                  </div>
                )
              })}
            </div>
          )
        }
        // 4) Default: sanitized markdown
        return <div key={i} dangerouslySetInnerHTML={{ __html: render(b) }} />
      })}
    </>
  )
}

export default function AIAssistant() {
  const [params] = useSearchParams()
  const scope = params.get('scope') || undefined
  const qParam = params.get('q')
  const photoParam = params.get('photo')
  const scopeLabel = scope ? SCOPE_LABELS[scope] : undefined

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [convos, setConvos] = useState<Convo[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [mode, setMode] = useState<'ask' | 'task'>('ask')

  const [typing, setTyping] = useState(false)
  const lastIdx = messages.length - 1

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [showCam, setShowCam] = useState(false)
  const [pendingImage, setPendingImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null)
  const recRef = useRef<any>(null)
  const [listening, setListening] = useState(false)

  const { user, profile, ownerId } = useAuth()
  const STORE = STORE_BASE + (user?.id ? '_' + user.id : '')
  const CURRENT_KEY = CURRENT_BASE + (user?.id ? '_' + user.id : '')
  const ACTIVE_KEY = ACTIVE_BASE + (user?.id ? '_' + user.id : '')

  // ── Morning Briefing: live business snapshot for the empty state ──
  interface Briefing { salesToday: number; pendingCount: number; pendingSum: number; lowStock: number }
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  // Fresh greeting every page open (stable within the session)
  const [greeting] = useState(() => {
    try { return GREETINGS[Math.floor(Math.random() * GREETINGS.length)] }
    catch { return GREETINGS[0] }
  })
  useEffect(() => {
    if (!ownerId) return
    let active = true
    ;(async () => {
      try {
        const now = new Date()
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const [tx, inv, prod] = await Promise.all([
          supabase.from('transactions').select('total').eq('user_id', ownerId).eq('status', 'completed').gte('created_at', startToday),
          supabase.from('invoices').select('total,status').eq('user_id', ownerId).in('status', ['sent', 'viewed', 'partial', 'overdue']),
          supabase.from('products').select('stock_quantity,low_stock_threshold').eq('user_id', ownerId),
        ])
        if (!active) return
        setBriefing({
          salesToday: (tx.data || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0),
          pendingCount: (inv.data || []).length,
          pendingSum: (inv.data || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0),
          lowStock: (prod.data || []).filter((p: any) => Number(p.stock_quantity) <= Number(p.low_stock_threshold)).length,
        })
      } catch { /* briefing is decorative — never block chat */ }
    })()
    return () => { active = false }
  }, [ownerId])
  // Which conversation the current messages belong to (null = next send starts a new one).
  const activeIdRef = useRef<string | null>(null)

  useEffect(() => { try { setConvos(JSON.parse(localStorage.getItem(STORE) || '[]')) } catch { /* ignore */ } }, [STORE])
  // Restore the in-progress conversation on open — closing the page mid-task no longer loses it.
  useEffect(() => {
    try { const s = localStorage.getItem(CURRENT_KEY); if (s) setMessages(JSON.parse(s)) } catch { /* ignore */ }
    try { activeIdRef.current = localStorage.getItem(ACTIVE_KEY) } catch { /* ignore */ }
  }, [CURRENT_KEY, ACTIVE_KEY])
  // Persist the current conversation continuously.
  useEffect(() => { try { localStorage.setItem(CURRENT_KEY, JSON.stringify(messages)) } catch { /* ignore */ } }, [messages])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, loading, typing])

  const persist = (next: Convo[]) => { setConvos(next); try { localStorage.setItem(STORE, JSON.stringify(next.slice(0, 8))) } catch { /* ignore */ } }

  // ── Conversation grouping ──
  // Every turn APPENDS to the active conversation instead of spawning a new
  // history entry. A new entry is only created for a genuinely new chat
  // (the "New chat" button, or the first message with no active conversation).
  const upsertConvo = (allMsgs: Msg[], titleFallback: string) => {
    const id = activeIdRef.current
    const existing = id ? convos.find((c) => c.id === id) : undefined
    let next: Convo[]
    if (existing) {
      next = [{ ...existing, msgs: allMsgs, ts: Date.now() }, ...convos.filter((c) => c.id !== existing.id)]
    } else {
      next = [{ id: crypto.randomUUID(), title: titleFallback.slice(0, 48) || 'Conversation', msgs: allMsgs, ts: Date.now(), scope }, ...convos]
    }
    activeIdRef.current = next[0].id
    try { localStorage.setItem(ACTIVE_KEY, next[0].id) } catch { /* ignore */ }
    persist(next)
  }

  const replying = loading || typing
  const userTyping = !replying && (focused || input.trim().length > 0)
  const avatarState = deriveAvatarState({ listening, loading: replying || userTyping })

  const send = async (override?: string, overrideImage?: { data: string; mimeType: string; preview: string } | null) => {
    const img = overrideImage ?? pendingImage
    const q = (override ?? input).trim()
    if ((!q && !img) || loading) return
    if (!navigator.onLine) { toast.error('No internet connection right now.'); return }
    setInput('')
    // When an image is shared, use Task mode so Meraj analyses it + proposes a
    // real action (create bill / sale / quotation) instead of just describing it.
    const sendMode: 'ask' | 'task' = img ? 'task' : mode
    const next = [...messages, { role: 'user' as const, text: q, image: img ? img.preview : undefined }]
    setMessages(next)
    setLoading(true)
    const history = messages.slice(-10).map((m) => ({ role: m.role, text: m.text }))
    try {
      const res = await askAssistant(q || '(shared an image)', false, scope, sendMode, undefined, undefined, history, img || undefined)
      setPendingImage(null)
        const done = [...next, { role: 'meraj' as const, text: res.reply, pending: res.pending, media: res.media, images: res.images }]
      setMessages(done)
      if (res.reply) setTyping(true)
      upsertConvo(done, q || 'Shared photo')
    } catch (e) {
      setMessages([...next, { role: 'meraj' as const, text: '⚠️ ' + (e instanceof Error ? e.message : 'Something went wrong.') }])
    } finally {
      setLoading(false)
    }
  }

  // Auto-send a question handed over from the Dashboard command bar (?q=).
  const sentFromQ = useRef(false)
  useEffect(() => {
    if (qParam && !sentFromQ.current) {
      sentFromQ.current = true
      send(qParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam])

  // Auto-send a photo handed over from the bottom-bar Camera (?photo=true).
  // BottomNav captures the photo → stores it in sessionStorage → navigates here.
  // We read it, attach it, and auto-send in Task mode so Meraj analyses it and
  // proposes an action (bill / sale / quotation).
  const sentFromPhoto = useRef(false)
  useEffect(() => {
    if (photoParam === 'true' && !sentFromPhoto.current) {
      sentFromPhoto.current = true
      try {
        const dataUrl = sessionStorage.getItem('cashiea_pending_photo')
        if (dataUrl) {
          sessionStorage.removeItem('cashiea_pending_photo')
          setMode('task')
          send(undefined, { data: dataUrl.split(',')[1] || '', mimeType: 'image/jpeg', preview: dataUrl })
        }
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoParam])

  const confirmAction = async (pending: any) => {
    if (loading) return
    setLoading(true)
    const confirmText = '✓ ' + (pending?.type === 'create_invoice' ? 'Create it' : pending?.type === 'send_whatsapp' ? 'Send it' : pending?.type === 'sync_stock_from_sheet' ? 'Sync it' : pending?.type === 'export_to_sheet' ? 'Export it' : 'Add it')
    const base = [...messages, { role: 'user' as const, text: confirmText }]
    setMessages(base)
    try {
      const res = await askAssistant('', false, scope, 'task', pending)
      const done = [...base, { role: 'meraj' as const, text: res.reply }]
      setMessages(done)
      if (res.reply) setTyping(true)
      upsertConvo(done, confirmText)
    } catch (e) {
      setMessages([...base, { role: 'meraj' as const, text: '⚠️ ' + (e instanceof Error ? e.message : 'Something went wrong.') }])
    } finally { setLoading(false) }
  }
  const cancelAction = (idx: number) => {
    const cleared = messages.map((msg, i) => (i === idx ? { ...msg, pending: undefined } : msg))
    const done = [...cleared, { role: 'meraj' as const, text: 'No problem — cancelled. What else can I do?' }]
    setMessages(done)
    upsertConvo(done, 'Conversation')
  }

  const openConvo = (c: Convo) => {
    setMessages(c.msgs)
    activeIdRef.current = c.id
    try { localStorage.setItem(ACTIVE_KEY, c.id) } catch { /* ignore */ }
    setShowHistory(false)
  }
  const newChat = () => {
    setMessages([])
    activeIdRef.current = null
    try { localStorage.removeItem(ACTIVE_KEY) } catch { /* ignore */ }
    try { localStorage.removeItem(CURRENT_KEY) } catch { /* ignore */ }
    setShowHistory(false)
    inputRef.current?.focus()
  }

  const startListen = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { toast.error('Voice input not supported on this browser.'); return }
    if (recRef.current) { try { recRef.current.stop() } catch { /* ignore */ } }
    const rec = new SR(); rec.lang = 'hi-IN'; rec.interimResults = false; rec.maxAlternatives = 1
    rec.onstart = () => setListening(true); rec.onend = () => setListening(false)
    rec.onerror = (e: any) => { setListening(false); const er = String(e?.error || ''); if (er === 'not-allowed' || er === 'service-not-allowed') toast.error('Microphone access is blocked — allow it in your browser settings.'); else if (er === 'no-speech') toast.error("I couldn't hear that clearly — try again."); else if (er && er !== 'aborted') toast.error('Microphone error — please try again.') }
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript; setInput((p) => (p ? p + ' ' : '') + t) }
    recRef.current = rec; rec.start()
  }
  const stopListen = () => { recRef.current?.stop(); setListening(false) }
  useEffect(() => () => recRef.current?.stop(), [])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    setShowCam(false)
    if (!file || !file.type.startsWith('image/')) { toast.error('Please choose an image.'); return }
    try {
      const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file) })
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl })
      const maxSize = 1024; const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas'); canvas.width = img.width * scale; canvas.height = img.height * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      const resized = canvas.toDataURL('image/jpeg', 0.8)
      setPendingImage({ data: resized.split(',')[1], mimeType: 'image/jpeg', preview: resized })
      toast.success('Image attached — send it to Meraj.')
    } catch { toast.error('Could not process the image.') }
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
          <MerajAvatar state={avatarState} context="icon" size="sm" />
          <div className="text-left leading-tight">
            <p className="font-semibold text-fg text-sm">Meraj</p>
            <p className="text-[10px] text-fg-subtle">{userTyping ? 'Hello — ask me anything' : scopeLabel ? `Focused · ${scopeLabel}` : 'Your shop assistant'}</p>
          </div>
        </div>
        <Link to="/app" className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2"><ArrowLeft className="w-5 h-5" strokeWidth={1.75} /></Link>
      </div>

      {/* ── Segmented control: Ask | Task (the command-center toggle) ── */}
      <div className="px-4 pt-3 pb-2 flex justify-center">
        <div className="relative inline-flex rounded-full border border-line bg-surface-2 p-1 shadow-inner">
          {(['ask', 'task'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`relative z-10 flex items-center gap-1.5 rounded-full px-5 h-8 text-xs font-bold transition-all ${
                mode === m
                  ? 'bg-surface text-fg shadow-[0_2px_8px_rgba(0,0,0,0.12)] scale-[1.02]'
                  : 'text-fg-subtle hover:text-fg-muted'
              }`}
            >
              {m === 'ask' ? <MessageCircle className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
              {m === 'ask' ? 'Ask' : 'Task'}
            </button>
          ))}
        </div>
      </div>

      {/* Character + messages (full-height scroll) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-area">
        {/* ── Empty state: Morning Briefing dashboard (Ask mode) ── */}
        {!messages.length && mode === 'ask' && (
          <div className="px-4 pt-6 pb-4 max-w-3xl mx-auto w-full">
            {/* Greeting — Meraj mascot + fresh 2-4 word micro-greeting */}
            <div className="flex items-start gap-3 mb-5">
              <div className="flex-shrink-0 -mt-1">
                <MerajAvatar state="idle" context="panel" size="md" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-fg leading-snug">{greeting}</h2>
              </div>
            </div>
            <p className="text-sm text-fg-muted mb-5">
                {briefing
                  ? briefing.pendingCount > 0
                    ? `Your store is running well — ${briefing.pendingCount} payment${briefing.pendingCount > 1 ? 's' : ''} to chase today.`
                    : briefing.lowStock > 0
                      ? `All bills collected — ${briefing.lowStock} item${briefing.lowStock > 1 ? 's' : ''} need restocking.`
                      : 'Your store is running smoothly. Here is what to look at today.'
                  : 'Here is what to look at today.'}
            </p>

            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              <div className="rounded-card border border-line bg-surface p-3.5 shadow-soft">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Today's Sales</span>
                  <TrendingUp className="w-3.5 h-3.5 text-positive" />
                </div>
                <p className="text-lg font-bold text-fg tabular-nums leading-tight">{briefing ? formatINR(briefing.salesToday, 0) : '—'}</p>
              </div>
              <div className="rounded-card border border-line bg-surface p-3.5 shadow-soft">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Pending Dues</span>
                  <span className={`w-2 h-2 rounded-full ${briefing && briefing.pendingCount > 0 ? 'bg-negative' : 'bg-positive'}`} />
                </div>
                <p className="text-lg font-bold text-fg tabular-nums leading-tight">{briefing ? formatINR(briefing.pendingSum, 0) : '—'}</p>
              </div>
              <div className="rounded-card border border-line bg-surface p-3.5 shadow-soft">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Low Stock</span>
                  <Package className={`w-3.5 h-3.5 ${briefing && briefing.lowStock > 0 ? 'text-warning' : 'text-positive'}`} />
                </div>
                <p className="text-lg font-bold text-fg tabular-nums leading-tight">{briefing ? (briefing.lowStock > 0 ? `${briefing.lowStock} items` : 'All good') : '—'}</p>
              </div>
            </div>

            {/* Proactive insight card */}
            {briefing && briefing.pendingCount > 0 && (
              <button
                onClick={() => send('Chase all my pending payments — draft polite WhatsApp reminders for each customer with dues')}
                className="w-full text-left rounded-card border border-accent/30 bg-accent-soft/50 p-4 mb-4 shadow-soft hover:border-accent/50 transition-colors active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-control bg-accent/15 text-accent flex items-center justify-center flex-shrink-0"><Wallet className="w-5 h-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-fg">Meraj noticed: {formatINR(briefing.pendingSum, 0)} is waiting</p>
                    <p className="text-xs text-fg-muted mt-0.5">Tap to draft WhatsApp reminders for {briefing.pendingCount} customer{briefing.pendingCount > 1 ? 's' : ''} →</p>
                  </div>
                </div>
              </button>
            )}
            {briefing && briefing.pendingCount === 0 && briefing.lowStock > 0 && (
              <button
                onClick={() => send('Which items are low on stock and how much should I reorder?')}
                className="w-full text-left rounded-card border border-warning/30 bg-warning/[0.06] p-4 mb-4 shadow-soft hover:border-warning/50 transition-colors active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-control bg-warning/15 text-warning flex items-center justify-center flex-shrink-0"><Package className="w-5 h-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-fg">Meraj noticed: {briefing.lowStock} items running low</p>
                    <p className="text-xs text-fg-muted mt-0.5">Tap to see reorder suggestions →</p>
                  </div>
                </div>
              </button>
            )}

            {/* Quick action cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: Wallet, label: 'Chase Payments', q: 'Chase all my pending payments — draft polite WhatsApp reminders for each customer with dues' },
                { icon: Package, label: 'Restock Alert', q: 'Which items are low on stock and how much should I reorder?' },
                { icon: TrendingUp, label: 'Boost Sales', q: 'How can I boost my sales this week? Give me 3 specific actions.' },
                { icon: FileText, label: 'Daily Report', q: 'Draft my daily business report for today' },
              ].map((a) => (
                <button key={a.label} onClick={() => send(a.q)} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5 shadow-soft hover:border-accent/40 active:scale-[0.98] transition-all">
                  <span className="w-9 h-9 rounded-control bg-accent-soft text-accent flex items-center justify-center flex-shrink-0"><a.icon className="w-4.5 h-4.5" /></span>
                  <span className="text-sm font-semibold text-fg">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state: Task action grid (Task mode) ── */}
        {!messages.length && mode === 'task' && (
          <div className="px-4 pt-6 pb-4 max-w-3xl mx-auto w-full">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-fg leading-tight">What should Meraj do?</h2>
              <p className="text-sm text-fg-muted mt-1">Pick an action — Meraj prepares it, you confirm, it's done.</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: Wallet, label: 'Chase Pending Payments', desc: 'Draft WhatsApp reminders', q: 'Chase all my pending payments — draft polite WhatsApp reminders for each customer with dues' },
                { icon: Package, label: 'Restock Low Inventory', desc: 'Suggest reorder quantities', q: 'List my low stock items and create a reorder plan' },
                { icon: FileText, label: 'Create Invoice', desc: 'GST bill in seconds', q: 'I want to create an invoice — ask me for the details' },
                { icon: BarChart3, label: 'Draft Daily Report', desc: 'Full day summary', q: 'Draft my daily business report for today' },
                { icon: Receipt, label: 'Scan Receipt', desc: 'Photo → bill entry', scan: true },
                { icon: Sparkles, label: 'Add Products', desc: 'Bulk stock entry', q: 'I want to add products to my stock — ask me for the list' },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={() => (a.scan ? cameraRef.current?.click() : send(a.q!))}
                  className="rounded-card border border-line bg-surface p-4 shadow-soft hover:border-accent/40 hover:shadow-float active:scale-[0.98] transition-all text-left"
                >
                  <span className="w-10 h-10 rounded-control bg-accent-soft text-accent flex items-center justify-center mb-2.5"><a.icon className="w-5 h-5" /></span>
                  <p className="text-sm font-bold text-fg leading-tight">{a.label}</p>
                  <p className="text-xs text-fg-subtle mt-0.5">{a.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}


        <div className="px-4 pb-6 space-y-6 max-w-3xl mx-auto w-full">
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="bg-surface-2/70 rounded-2xl rounded-br-md px-4 py-2.5 max-w-[75%]">
                {m.image && <img src={m.image} alt="sent" className="rounded-xl mb-2 max-h-52 w-auto max-w-full object-cover" />}
                {m.text && <p className="text-sm text-fg whitespace-pre-wrap">{m.text}</p>}
              </div>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center flex-shrink-0 mt-0.5"><MerajMark size={18} /></span>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="text-sm">
                    {typing && i === lastIdx
                      ? <TypewriterMessage text={m.text} onDone={() => setTyping(false)} />
                      : <SmartReply
                          text={m.text}
                          onEditDraft={(t) => { setInput(t); inputRef.current?.focus() }}
                          onSendDraft={(t) => { setMode('task'); send(`Send this WhatsApp message: "${t.replace(/"/g, "'")}"`) }}
                        />}
                  </div>
                  {m.images && m.images.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {m.images.map((img, j) => (
                        <GeneratedImage
                          key={j}
                          img={img}
                          onRegenerate={(newPrompt) => { setMode('task'); send(`Generate an image: ${newPrompt}`) }}
                        />
                      ))}
                    </div>
                  )}
                  {m.media && m.media.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {m.media.map((mi, j) => (
                        <a key={j} href={mi.link} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-line bg-surface-2">
                          <img src={mi.thumb} alt={mi.alt} className="w-full h-16 object-cover" loading="lazy" />
                        </a>
                      ))}
                    </div>
                  )}
                  {m.pending && (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => confirmAction(m.pending)} disabled={loading} className="btn-primary text-sm flex-1 h-9"><Sparkles className="w-4 h-4" /> {m.pending?.type === "create_invoice" ? "Create it" : m.pending?.type === "send_whatsapp" ? "Send it" : m.pending?.type === "sync_stock_from_sheet" ? "Sync it" : m.pending?.type === "export_to_sheet" ? "Export it" : "Add it"}</button>
                      <button onClick={() => cancelAction(i)} className="btn-secondary text-sm h-9">Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
          {loading && (
            <div className="flex gap-3">
              <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center flex-shrink-0 mt-0.5"><MerajMark size={18} /></span>
              <div className="flex items-center gap-1.5 pt-2">
                {[0, 1, 2].map((d) => (
                  <motion.span key={d} className="w-1.5 h-1.5 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Floating input bar ── */}
      <div className="px-3 pb-3 pt-1 bg-gradient-to-t from-surface via-surface to-transparent">
        {pendingImage && (
          <div className="flex items-center gap-2 px-1 pb-2">
            <img src={pendingImage.preview} className="w-12 h-12 rounded-xl object-cover border border-line" alt="preview" />
            <span className="text-xs text-fg-muted flex-1">Image ready to send</span>
            <button onClick={() => setPendingImage(null)} className="text-fg-subtle hover:text-negative"><X className="w-4 h-4" /></button>
          </div>
        )}
        <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-paper px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)] focus-within:border-accent/50 transition-colors">
          <div className="relative">
            <button onClick={() => setShowCam((s) => !s)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${showCam ? 'bg-accent-soft text-accent rotate-45' : 'text-fg-muted hover:text-fg hover:bg-surface-2'}`} aria-label="Add attachment">
              <Plus className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
            <AnimatePresence>
              {showCam && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute bottom-12 left-0 card p-1.5 w-44 shadow-float z-10">
                  <button onClick={() => cameraRef.current?.click()} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-fg hover:bg-surface-2"><Receipt className="w-4 h-4 text-accent" /> Scan Receipt</button>
                  <button onClick={() => galleryRef.current?.click()} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-fg hover:bg-surface-2"><ImageIcon className="w-4 h-4 text-accent" /> Attach Photo</button>
                  <button onClick={() => cameraRef.current?.click()} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-fg hover:bg-surface-2"><Camera className="w-4 h-4 text-accent" /> Take Photo</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={listening ? stopListen : startListen} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${listening ? 'text-negative bg-negative/10' : 'text-fg-muted hover:text-fg hover:bg-surface-2'}`} aria-label="Voice input">
            {listening ? <Square className="w-4 h-4" /> : <Mic className="w-[18px] h-[18px]" strokeWidth={1.75} />}
          </button>

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={mode === 'task' ? 'Tell Meraj what to do…' : 'Ask Meraj anything…'}
            className="flex-1 bg-transparent px-2 py-2 text-sm text-fg placeholder:text-fg-subtle outline-none min-w-0"
            disabled={loading}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} className="w-10 h-10 rounded-xl bg-fg text-paper flex items-center justify-center flex-shrink-0 hover:opacity-90 disabled:opacity-40 transition-opacity" aria-label="Send">
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
