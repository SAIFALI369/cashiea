import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import clsx from 'clsx'
import { LayoutDashboard, ShoppingCart, Users, LayoutGrid, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MerajAvatar, deriveAvatarState } from './MerajAvatar'
import { useSpeech } from '../lib/useSpeech'
import { askAssistant } from '../lib/ai'
import { getPageContext } from '../lib/pageContext'
import { useLocation } from 'react-router-dom'
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
    setVoiceActive(true); setVoiceReply(''); setVoiceLoading(false)
    const ok = startListening(async (text) => {
      setVoiceLoading(true)
      try {
        const res = await askAssistant(text, false, undefined, 'ask', undefined, pageContext)
        setVoiceReply(res.reply)
        if (res.reply) speak(res.reply, () => setTimeout(() => { setVoiceActive(false); setVoiceReply('') }, 2500))
        else setTimeout(() => setVoiceActive(false), 1500)
      } catch (e) {
        setVoiceReply('⚠️ ' + (e instanceof Error ? e.message : 'Something went wrong.'))
        setTimeout(() => setVoiceActive(false), 3000)
      } finally { setVoiceLoading(false) }
    })
    if (!ok) { setVoiceActive(false); setVoiceReply('Voice not supported on this browser.') }
  }

  const cancelVoice = () => { stopListening(); stopSpeaking(); setVoiceActive(false); setVoiceReply(''); setVoiceLoading(false) }

  return (
    <>
      {/* Voice overlay — covers the lower screen when active */}
      {voiceActive && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col items-center justify-end pb-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }} onClick={(e) => { if (e.target === e.currentTarget) cancelVoice() }}>
          <div className="w-full max-w-md mx-auto px-4 flex flex-col items-center gap-3 pb-4">
            {/* Character */}
            <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-surface border-2 border-accent/30 shadow-float">
              <MerajAvatar state={avatarState} size="md" context="panel" />
            </div>
            {/* Status */}
            <p className="text-sm font-semibold text-white">{statusText || (voiceReply ? 'Done' : '')}</p>
            {/* Reply text */}
            {voiceReply && (
              <div className="card p-3.5 w-full max-h-40 overflow-y-auto scroll-area">
                <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: voiceReply.replace(/[*#`]/g, '') }} />
              </div>
            )}
            {/* Loading spinner */}
            {voiceLoading && <Loader2 className="w-5 h-5 text-accent animate-spin" />}
            {/* Controls */}
            <div className="flex items-center gap-4">
              {listening && (
                <button onClick={cancelVoice} className="flex flex-col items-center gap-1">
                  <span className="w-12 h-12 rounded-full bg-negative text-white flex items-center justify-center active:scale-95 transition-transform"><X className="w-5 h-5" /></span>
                  <span className="text-[10px] font-medium text-white/70">Cancel</span>
                </button>
              )}
              {!listening && !speaking && !voiceLoading && voiceReply && (
                <button onClick={startVoice} className="flex flex-col items-center gap-1">
                  <span className="w-12 h-12 rounded-full bg-accent-strong text-accent-fg flex items-center justify-center active:scale-95 transition-transform">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                  </span>
                  <span className="text-[10px] font-medium text-white/70">Ask again</span>
                </button>
              )}
              {!listening && !voiceLoading && !speaking && (
                <button onClick={cancelVoice} className="flex flex-col items-center gap-1">
                  <span className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center active:scale-95 transition-transform"><X className="w-4 h-4" /></span>
                  <span className="text-[10px] font-medium text-white/70">Close</span>
                </button>
              )}
            </div>
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
              <span className={`w-12 h-12 -mt-6 rounded-full shadow-float ring-4 ring-surface flex items-center justify-center active:scale-95 transition-all ${listening || speaking ? 'bg-accent text-accent-fgl border-2 border-accent' : 'bg-accent-strong text-accent-fg'}`}>
                <MerajAvatar state={voiceActive ? avatarState : 'idle'} size="sm" context="floating" />
              </span>
              <span className="text-[10px] font-bold text-accent -mt-0.5">Talk</span>
            </button>
          </div>

          {RIGHT.map((it) => <Slot key={it.to} item={it} />)}

          <button
            onClick={onMore}
            className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-fg-subtle hover:text-fg transition-colors"
            aria-label="More"
          >
            <LayoutGrid className="w-[22px] h-[22px]" strokeWidth={1.75} />
            <span className="text-[10px] font-semibold">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
