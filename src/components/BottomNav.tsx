import { NavLink } from 'react-router-dom'
import { useState, useRef } from 'react'
import clsx from 'clsx'
import { LayoutDashboard, ShoppingCart, Users, LayoutGrid, X, Camera } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MerajAvatar, deriveAvatarState } from './MerajAvatar'
import { useSpeech } from '../lib/useSpeech'
import { askAssistant } from '../lib/ai'
import { renderMd } from '../lib/markdown'
import toast from 'react-hot-toast'
import { getPageContext } from '../lib/pageContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

/**
 * BottomNav — mobile primary navigation + voice Meraj in the center.
 * The CENTER button is a VOICE-first Meraj: tap → ears grow + listening →
 * speak → Gemini processes → Meraj speaks the reply with full face animation.
 */
interface Item { to: string; label: string; icon: LucideIcon; end?: boolean }
const LEFT: Item[] = [
  { to: '/app', label: 'Today', icon: LayoutDashboard, end: true },
  { to: '/app/pos', label: 'New Sale', icon: ShoppingCart },
]
const RIGHT: Item[] = [
  { to: '/app/customers', label: 'Customers', icon: Users },
]

const Slot = ({ item }: { item: Item }) => (
  <NavLink
    to={item.to}
    end={item.end}
    className={({ isActive }) => clsx(
      'flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors',
      isActive ? 'text-accent' : 'text-fg-subtle hover:text-fg'
    )}
  >
    {({ isActive }) => (
      <>
        <item.icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.25 : 1.75} />
        <span className="text-[10px] font-semibold">{item.label}</span>
      </>
    )}
  </NavLink>
)

export default function BottomNav({ onMore }: { onMore: () => void }) {
  const location = useLocation()
  const pageContext = (() => { const c = getPageContext(location.pathname); return c ? { name: c.name, description: c.description } : undefined })()
  const { speak, stopSpeaking, speaking, startListening, stopListening, listening } = useSpeech()
  const [voiceActive, setVoiceActive] = useState(false)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [voiceReply, setVoiceReply] = useState('')

  const avatarState = deriveAvatarState({ listening, loading: voiceLoading, speaking })
  const statusText = listening ? 'Listening…' : voiceLoading ? 'Thinking…' : speaking ? 'Speaking…' : ''

  const startVoice = () => {
    if (!navigator.onLine) {
      const m = "Voice needs an internet connection. Please connect, or type your question in Meraj."
      setVoiceActive(true); setVoiceReply(m); speak(m); setTimeout(() => setVoiceActive(false), 5500)
      return
    }
    setVoiceActive(true); setVoiceReply(''); setVoiceLoading(false)
    const ok = startListening(
      async (text) => {
        if (!navigator.onLine) {
          const m = "No internet connection right now. I'll answer as soon as you're back online."
          setVoiceReply(m); speak(m); return
        }
        setVoiceLoading(true)
        try {
          const res = await askAssistant(text, false, undefined, 'ask', undefined, pageContext)
          setVoiceReply(res.reply)
          if (res.reply) speak(res.reply, () => setTimeout(() => { setVoiceActive(false); setVoiceReply('') }, 2500))
          else setTimeout(() => setVoiceActive(false), 1500)
        } catch (e) {
          const m = e instanceof Error ? e.message : 'Something went wrong.'
          setVoiceReply('⚠️ ' + m); speak("Sorry, that didn't work. " + m)
          setTimeout(() => setVoiceActive(false), 3500)
        } finally { setVoiceLoading(false) }
      },
      (errMsg) => {
        if (errMsg) { setVoiceReply(errMsg); speak(errMsg) }
        setTimeout(() => setVoiceActive(false), 3500)
      }
    )
    if (!ok) {
      const m = "Voice isn't supported on this browser. Open Meraj from the menu to type your question."
      setVoiceReply(m); speak(m); setTimeout(() => setVoiceActive(false), 4500)
    }
  }

  const cancelVoice = () => { stopListening(); stopSpeaking(); setVoiceActive(false); setVoiceReply(''); setVoiceLoading(false) }

  const navigate = useNavigate()
  const cameraRef = useRef<HTMLInputElement>(null)
  const onCamera = () => cameraRef.current?.click()
  const onCameraFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) { toast.error('Please take a photo.'); return }
    try {
      toast.loading('Processing photo…', { id: 'cam' })
      const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file) })
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl })
      const maxSize = 1024; const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas'); canvas.width = img.width * scale; canvas.height = img.height * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      const resized = canvas.toDataURL('image/jpeg', 0.8)
      sessionStorage.setItem('cashiea_pending_photo', resized)
      toast.dismiss('cam')
      navigate('/app/assistant?photo=true')
    } catch { toast.error('Could not process the photo.'); toast.dismiss('cam') }
  }

  return (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onCameraFile} />
      {/* Voice overlay — covers the lower screen when active */}
      {/* Voice COMPANION — small & non-blocking. The whole app stays usable
          while Meraj listens / thinks / speaks down in the corner. */}
      {voiceActive && (
        <div className="lg:hidden fixed z-40 right-3 flex flex-col items-end gap-2" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}>
          {voiceReply && (
            <div className="card p-3 max-w-[230px] max-h-44 overflow-y-auto scroll-area prose-content text-sm shadow-float">
              <div dangerouslySetInnerHTML={{ __html: renderMd(voiceReply) }} />
            </div>
          )}
          <div className="flex items-center gap-2">
            {statusText && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent bg-surface/95 border border-line px-2.5 py-1 rounded-full shadow-float">
                {voiceLoading && <Loader2 className="w-3 h-3 animate-spin" />}{statusText}
              </span>
            )}
            <button onClick={cancelVoice} aria-label="Close Meraj" className="w-8 h-8 rounded-full bg-surface border border-line text-fg-muted hover:text-negative flex items-center justify-center active:scale-95 transition-transform shadow-float">
              <X className="w-4 h-4" />
            </button>
            <button onClick={() => (listening ? cancelVoice() : startVoice())} aria-label="Tap to talk to Meraj" className="active:scale-95 transition-transform">
              <MerajAvatar state={avatarState} size="sm" context="panel" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-surface/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div className="grid grid-cols-5 max-w-md mx-auto items-center">
          {LEFT.map((it) => <Slot key={it.to} item={it} />)}

          {/* Center — VOICE Meraj (tap to talk) */}
          <div className="flex justify-center">
            <button
              onClick={startVoice}
              className="flex flex-col items-center justify-center gap-0.5 min-h-[56px]"
              aria-label="Talk to Meraj"
            >
              <span className={`w-12 h-12 -mt-6 rounded-full ring-4 ring-surface flex items-center justify-center active:scale-95 transition-all shadow-[0_6px_20px_-4px_rgb(var(--accent))] ${listening || speaking ? 'bg-accent text-accent-fgl border-2 border-accent' : 'bg-accent-strong text-accent-fg'}`}>
                <MerajAvatar state={voiceActive ? avatarState : 'idle'} size="sm" context="floating" />
              </span>
              <span className="text-[9px] font-bold text-accent -mt-0.5">Talk to Meraj</span>
            </button>
          </div>

          {RIGHT.map((it) => <Slot key={it.to} item={it} />)}

          {/* Camera — scan a photo to create bills/sales */}
          <div className="flex justify-center">
            <button onClick={onCamera} className="flex flex-col items-center justify-center gap-0.5 min-h-[56px]" aria-label="Scan photo">
              <span className="w-12 h-12 -mt-6 rounded-full shadow-float ring-4 ring-surface flex items-center justify-center active:scale-95 transition-all bg-surface border border-line">
                <Camera className="w-5 h-5 text-accent" strokeWidth={1.75} />
              </span>
              <span className="text-[10px] font-bold text-accent -mt-0.5">Scan</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  )
}
