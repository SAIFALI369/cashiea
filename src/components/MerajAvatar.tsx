import { MerajStateIcon } from './MerajStateIcon'
import { MerajCharacter, type MerajCharState } from './MerajCharacter'

/**
 * <MerajAvatar /> — the SINGLE entry point for the Meraj mascot anywhere in
 * the app. No other component imports a Meraj asset (or the SVG mascot
 * pieces) directly — they all go through this.
 *
 * Props
 *   state    'idle' | 'listening' | 'thinking' | 'speaking'  (bind to live app behaviour)
 *   size     'sm' | 'md' | 'lg'
 *   context  'icon' | 'floating' | 'panel'
 *            · icon     → circular avatar badge (headers, buttons, message rows)
 *            · floating → the persistent floating-assistant button (compact, glow rings)
 *            · panel    → the full character (chat header / voice overlay / hero units)
 *
 * Bound to real app state via deriveAvatarState():
 *   listening → mic active · loading → AI request in flight (thinking) ·
 *   speaking  → TTS playing · otherwise idle.
 *
 * icon/floating/panel are driven by the SVG mascot, so the state is ALWAYS
 * pixel-consistent, correctly labelled and animated (the right face for
 * "listening" every time) and crisp at any size.
 */

export type MerajAvatarState = 'idle' | 'listening' | 'thinking' | 'speaking'
export type MerajAvatarSize = 'sm' | 'md' | 'lg'
export type MerajAvatarContext = 'icon' | 'floating' | 'panel'

const SIZE_PX: Record<MerajAvatarContext, Record<MerajAvatarSize, number>> = {
  icon: { sm: 26, md: 38, lg: 52 },
  floating: { sm: 40, md: 52, lg: 64 },
  panel: { sm: 84, md: 116, lg: 156 },
}

const STATE_TO_CHAR: Record<MerajAvatarState, MerajCharState> = {
  idle: 'idle',
  listening: 'listening',
  thinking: 'userTyping',
  speaking: 'speaking',
}

/** Derive the avatar state from live voice/AI flags. */
export function deriveAvatarState(o: { listening?: boolean; loading?: boolean; speaking?: boolean }): MerajAvatarState {
  if (o.listening) return 'listening'
  if (o.loading) return 'thinking'
  if (o.speaking) return 'speaking'
  return 'idle'
}

export interface MerajAvatarProps {
  state?: MerajAvatarState
  size?: MerajAvatarSize
  context?: MerajAvatarContext
  className?: string
}

export function MerajAvatar({ state = 'idle', size = 'md', context = 'icon', className }: MerajAvatarProps) {
  const px = SIZE_PX[context][size]

  if (context === 'panel') {
    return <MerajCharacter state={STATE_TO_CHAR[state]} width={px} className={className} />
  }

  // icon | floating — circular state badge; compact when small or floating
  const compact = context === 'floating' || size === 'sm'
  return <MerajStateIcon state={state} size={px} compact={compact} className={className} />
}

export default MerajAvatar
