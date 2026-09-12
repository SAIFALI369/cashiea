import { NavLink } from 'react-router-dom'
import { useState, useRef } from 'react'
import clsx from 'clsx'
import { motion } from './motion'
import {
  LayoutDashboard, ShoppingCart, Package, Users, Camera,
  Lightbulb,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import MerajDevice, { interactionFromAvatarState } from './MerajDevice'
import { useBusinessMood } from '../lib/businessMood'
import { useSpeech } from '../lib/useSpeech'
import { askAssistant } from '../lib/ai'
import { renderMd } from '../lib/markdown'
import toast from 'react-hot-toast'
import { getPageContext } from '../lib/pageContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import { useIsDesktop } from '../lib/useIsDesktop'

/**
 * BottomNav — primary navigation, different shapes on mobile vs desktop.
 *
 * MOBILE (<lg): fixed bottom bar with 5 slots (Today · New Sale · [Meraj
 *   voice button] · Customers · Scan). Voice launches a tiny companion
 *   overlay in the corner (the whole app stays usable while Meraj
 *   listens/thinks/speaks).
 *
 * DESKTOP (≥lg): a wider fixed bottom bar with 7 slots arranged as
 *   Dashboard · Sales (POS) · Stocks · [Meraj talk] · Customers ·
 *   Suggestions · Scanner. Same 7-entry order the owner requested.
 *   The Meraj slot is a voice launcher (not a page) just like mobile,
 *   sized to feel premium on desktop. The voice companion floats in
 *   the bottom-right corner rather than covering the nav.
 */

interface Item { to: string; label: string; icon: LucideIcon; end?: boolean }

// ── Mobile items (5 slots; centre is Meraj voice, not a NavLink) ──
const MOBILE_LEFT: Item[] = [
  { to: '/app', label: 'Today', icon: LayoutDashboard, end: true },
  { to: '/app/pos', label: 'New Sale', icon: ShoppingCart },
]
const MOBILE_RIGHT: Item[] = [
  { to: '/app/customers', label: 'Customers', icon: Users },
]

// ── Desktop items (7 slots; index 3 is the Meraj talk feature, not a page) ──
// ── Desktop dock entries — 7 slots. 'meraj' and 'scanner' are special
// (buttons, not NavLinks): Meraj opens voice, Scanner opens the camera.
type DeskEntry = Item | { special: 'meraj'; label: string } | { special: 'scanner'; label: string }

const DESKTOP_ITEMS: DeskEntry[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/pos', label: 'Sales (POS)', icon: ShoppingCart },
  { to: '/app/products', label: 'Stocks', icon: Package },
  { special: 'meraj', label: 'Meraj' },
  { to: '/app/customers', label: 'Customers', icon: Users },
  { to: '/app/suggestions', label: 'Suggestions', icon: Lightbulb },
  { special: 'scanner', label: 'Scanner' },
]

function deriveAvatarStateCompat({ listening, loading, speaking }: { listening: boolean; loading?: boolean; speaking: boolean }) {
  if (listening) return 'listening'
  if (loading) return 'thinking'
  if (speaking) return 'speaking'
  return 'idle'
}

const MobileSlot = ({ item }: { item: Item }) => (
  <NavLink
    to={item.to}
    end={item.end}
    className={({ isActive }) => clsx(
      'relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors',
      // Sapphire = navigation. Emerald stays for actions (Meraj, Scan).
      isActive ? 'text-secondary-strong' : 'text-fg-subtle hover:text-fg'
    )}
  >
    {({ isActive }) => (
      <>
        {/* Active pill glides between slots — spring, never teleport. */}
        {isActive && (
          <motion.span
            layoutId="mobile-nav-pill"
            className="absolute inset-x-2.5 top-1 bottom-1 rounded-xl bg-secondary-soft"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            aria-hidden="true"
          />
        )}
        <item.icon className="relative w-[22px] h-[22px]" strokeWidth={isActive ? 2.25 : 1.75} />
        <span className="relative text-[10px] font-semibold">{item.label}</span>
      </>
    )}
  </NavLink>
)

const DesktopSlot = ({ item }: { item: Item }) => (
  <NavLink
    to={item.to}
    end={item.end}
    className={({ isActive }) => clsx(
      'group flex flex-col items-center justify-center gap-1 py-2 h-full flex-1 transition-colors relative rounded-t-xl',
      // Sapphire = navigation (the way you move). Meraj stays emerald.
      isActive ? 'text-secondary-strong' : 'text-fg-muted hover:text-fg hover:bg-surface-2/60'
    )}
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <motion.span
            layoutId="desktop-nav-underline"
            className="absolute top-0 left-3 right-3 h-0.5 bg-secondary rounded-full"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            aria-hidden="true"
          />
        )}
        <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 1.75} />
        <span className="text-[11px] font-semibold">{item.label}</span>
      </>
    )}
  </NavLink>
)

export default function BottomNav() {
  const isDesktop = useIsDesktop()
  const location = useLocation()
  const navigate = useNavigate()
  // On the Dashboard, MerajSection IS the voice surface — the floating
  // companion would be redundant. Everywhere else it's the quick-access voice.
  const onDashboard = location.pathname === '/app' || location.pathname === '/app/onboarding'
  const pageContext = (() => { const c = getPageContext(location.pathname); return c ? { name: c.name, description: c.description } : undefined })()
  const { speak, stopSpeaking, speaking, cancelListening, startLiveListening, listening, transcribing, unlockTts } = useSpeech()
  const [voiceActive, setVoiceActive] = useState(false)
  const [voicePending, setVoicePending] = useState<any>(null)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [voiceReply, setVoiceReply] = useState('')

  const avatarState = deriveAvatarStateCompat({ listening, loading: voiceLoading || transcribing, speaking })
  const businessMood = useBusinessMood() ?? 'neutral'
  const interaction = interactionFromAvatarState(avatarState)
  const statusText = listening ? 'Listening…' : transcribing ? 'Transcribing…' : voiceLoading ? 'Thinking…' : speaking ? 'Speaking…' : ''

  const startVoice = async () => {
    unlockTts() // iOS/Android: unlock TTS inside the tap gesture so replies SPEAK
    setVoiceActive(true); setVoiceReply(''); setVoiceLoading(false)
    let heard = ''
    const ok = await startLiveListening(
      (text, isFinal) => {
        if (text) {
          heard += (heard ? ' ' : '') + text
          setVoiceReply(heard) // live words in the companion bubble
        }
        if (isFinal) {
          if (!heard.trim()) {
            setVoiceReply("I didn't catch that — tap me and try again.")
            speak("I didn't catch that. Try again.")
            setTimeout(() => { setVoiceActive(false); setVoiceReply('') }, 3500)
            return
          }
          setVoiceLoading(true)
          // TASK mode: brief employee answers AND real tool calls (invoice,
          // product, customer…) with a one-tap confirm — voice can run the shop.
          askAssistant(heard, false, undefined, 'task', undefined, pageContext, undefined, undefined, true)
            .then((res) => {
              const reply = (res && typeof res.reply === 'string' && res.reply.trim()) ? res.reply : "I couldn't think of a reply — try asking again."
              setVoiceReply(reply)
              setVoicePending(res?.pending || null)
              try { window.dispatchEvent(new CustomEvent('meraj:voice-reply', { detail: { text: reply } })) } catch { /* older browsers */ }
              speak(reply, () => setTimeout(() => { setVoiceActive(false); setVoiceReply('') }, 4000))
            })
            .catch((e) => {
              const m = e instanceof Error ? e.message : 'Something went wrong.'
              setVoiceReply('⚠️ ' + m)
              speak('Sorry, that did not work.')
              setTimeout(() => setVoiceActive(false), 5000)
            })
            .finally(() => setVoiceLoading(false))
        }
      },
      (msg) => { setVoiceActive(false); if (msg) toast.error(msg) },
      { windowMs: 2000, stopOnSilence: true },
    )
    if (!ok) {
      const m = "Voice isn't supported on this browser. Open Meraj to type your question."
      setVoiceReply(m); speak(m); setTimeout(() => setVoiceActive(false), 4500)
    }
  }

  const cancelVoice = () => { cancelListening(); stopSpeaking(); setVoiceActive(false); setVoiceReply(''); setVoiceLoading(false) }

  // ── Camera / Scanner (mobile + desktop) ──
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
      try { sessionStorage.setItem('cashiea_pending_photo', resized) } catch {
        toast.error('Could not save the photo — storage is full or private mode is on.'); return
      }
      toast.dismiss('cam')
      navigate('/app/assistant?photo=true')
    } catch { toast.error('Could not process the photo.'); toast.dismiss('cam') }
  }

  return (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onCameraFile} />

      {/* ── Voice companion — positioned differently on mobile vs desktop ── */}
      {voiceActive && !onDashboard && (
        <div
          className={clsx(
            'fixed z-40 flex flex-col items-end gap-2',
            isDesktop ? 'right-6' : 'right-3'
          )}
          style={isDesktop
            ? { bottom: '96px' }
            : { bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }
          }
        >
          {voiceReply && (
            <div className="card p-3 max-w-[260px] max-h-48 overflow-y-auto scroll-area prose-content text-sm shadow-float">
              <div dangerouslySetInnerHTML={{ __html: renderMd(voiceReply) }} />
            </div>
          )}
          {voicePending && (
            <div className="card p-3 max-w-[260px] shadow-float space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Meraj prepared an action</p>
              <p className="text-sm font-semibold text-fg leading-snug">
                {String(voicePending?.preview?.summary || voicePending?.preview?.title || voicePending?.input?.summary || 'Ready to run — confirm?')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const p = voicePending
                    setVoicePending(null)
                    if (p?.type === 'open_desk' && p?.input?.href) { navigate(String(p.input.href)); setVoiceActive(false); return }
                    setVoiceLoading(true)
                    askAssistant('', false, undefined, 'task', p, undefined, undefined, undefined, true)
                      .then((r) => {
                        setVoiceLoading(false)
                        const done = (r && typeof r.reply === 'string' && r.reply.trim()) ? r.reply : 'Done.'
                        setVoiceReply(done)
                        speak(done, () => setTimeout(() => { setVoiceActive(false); setVoiceReply('') }, 4000))
                      })
                      .catch(() => { setVoiceLoading(false); setVoiceReply('Could not run that — try again.') })
                  }}
                  className="btn-primary text-xs h-8 flex-1"
                >
                  ✓ Confirm
                </button>
                <button onClick={() => setVoicePending(null)} className="btn-secondary text-xs h-8">
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            {statusText && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent bg-surface/95 border border-line px-2.5 py-1 rounded-full shadow-float">
                {voiceLoading && <Loader2 className="w-3 h-3 animate-spin" />}{statusText}
              </span>
            )}
            <button onClick={cancelVoice} aria-label="Close Meraj" title="Close Meraj" className="w-8 h-8 rounded-full bg-surface border border-line text-fg-muted hover:text-negative flex items-center justify-center active:scale-95 transition-transform shadow-float">
              <X className="w-4 h-4" />
            </button>
            <button onClick={() => (listening ? cancelVoice() : startVoice())} aria-label="Tap to talk to Meraj" className="active:scale-95 transition-transform">
              <MerajDevice interactionState={interaction} businessMood={businessMood} size="sm" context="nav" />
            </button>
          </div>
        </div>
      )}

      {/* ────────────────── MOBILE BOTTOM NAV (<lg) ──────────────────
         A solid, opaque bar with a subtle top shadow — never a
         translucent layer over content. Meraj is the CENTER button,
         sitting INSIDE the bar (Instagram/TikTok "Post" pattern) so it
         can never float over customer data. */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface shadow-nav"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div className="grid grid-cols-5 w-full items-center">
          {MOBILE_LEFT.map((it) => <MobileSlot key={it.to} item={it} />)}

          {/* Center — VOICE Meraj (tap to talk), part of the bar itself */}
          <div className="flex justify-center">
            <button
              onClick={startVoice}
              className="flex flex-col items-center justify-center gap-1 py-2 min-h-[56px]"
              aria-label="Talk to Meraj" title="Talk to Meraj"
            >
              <span className={`w-[42px] h-[42px] rounded-2xl flex items-center justify-center active:scale-95 transition-all ${listening || speaking ? 'bg-accent' : 'bg-accent-strong'}`}>
                <MerajDevice interactionState={voiceActive ? interaction : 'idle'} businessMood={businessMood} size="sm" context="nav" />
              </span>
              <span className="text-[10px] font-semibold text-accent-strong leading-none">Meraj</span>
            </button>
          </div>

          {MOBILE_RIGHT.map((it) => <MobileSlot key={it.to} item={it} />)}

          <button onClick={onCamera} className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-fg-subtle hover:text-fg transition-colors active:scale-95" aria-label="Scan photo" title="Scan photo">
            <Camera className="w-[22px] h-[22px]" strokeWidth={1.75} />
            <span className="text-[10px] font-semibold">Scan</span>
          </button>
        </div>
      </nav>

      {/* ────────────────── DESKTOP BOTTOM NAV (≥lg) ──────────────────
         7 slots spread evenly across the full width, anchored to the
         bottom of the viewport. Meraj (slot index 3) is a larger
         central launch button — the "talk" feature, not a page. */}
      <nav
        className="hidden lg:flex fixed bottom-0 inset-x-0 z-30 bg-surface shadow-nav h-[72px] items-stretch px-4 xl:px-8"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div className="max-w-[1400px] w-full mx-auto grid grid-cols-7 items-stretch">
          {DESKTOP_ITEMS.map((entry) => {
            if ('special' in entry && entry.special === 'meraj') {
              return (
                <div key="meraj" className="flex justify-center items-center col-span-1">
                  <button
                    onClick={startVoice}
                    className="group relative flex flex-col items-center justify-center gap-1"
                    aria-label="Talk to Meraj" title="Talk to Meraj"
                  >
                    <span className={clsx(
                      'w-11 h-11 rounded-2xl flex items-center justify-center transition-all',
                      listening || speaking || voiceActive
                        ? 'bg-accent scale-105'
                        : 'bg-accent-strong hover:bg-accent'
                    )}>
                      <MerajDevice
                        interactionState={voiceActive ? interaction : 'idle'}
                        businessMood={businessMood}
                        size="sm"
                        context="nav"
                      />
                    </span>
                    <span className="text-[11px] font-semibold text-accent-strong leading-none">Meraj</span>
                  </button>
                </div>
              )
            }
            if ('special' in entry && entry.special === 'scanner') {
              return (
                <button
                  key="scanner"
                  onClick={onCamera}
                  className="group flex flex-col items-center justify-center gap-1 py-2 h-full flex-1 transition-colors text-fg-muted hover:text-fg hover:bg-surface-2/60 rounded-t-xl"
                  aria-label="Open scanner"
                  title="Scan"
                >
                  <Camera className="w-[22px] h-[22px]" strokeWidth={1.75} />
                  <span className="text-[11px] font-semibold">Scanner</span>
                </button>
              )
            }
            const item = entry as Item
            return <DesktopSlot key={item.to} item={item} />
          })}
        </div>
      </nav>
    </>
  )
}
