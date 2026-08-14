import { MerajStateIcon } from './MerajStateIcon'
import { MerajCharacter, type MerajCharState, type MerajPose } from './MerajCharacter'

/**
 * <MerajAvatar /> — the SINGLE entry point for the Meraj mascot anywhere in
 * the app. No other component imports a Meraj asset (or the SVG mascot
 * pieces) directly — they all go through this.
 *
 * Props
 *   state    'idle' | 'listening' | 'thinking' | 'speaking'
 *   size     'xs' | 'sm' | 'md' | 'lg'
 *   context  'icon' | 'floating' | 'panel'
 *            · icon     → circular avatar badge (headers, buttons, message rows)
 *            · floating → the persistent floating-assistant button (compact)
 *            · panel    → the full character (voice companion / chat header / hero)
 *   pose     optional gesture for the panel context (e.g. 'wave' to greet)
 *
 * State is bound to real app behaviour via deriveAvatarState().
 */

export type MerajAvatarState = 'idle' | 'listening' | 'thinking' | 'speaking'
export type MerajAvatarSize = 'xs' | 'sm' | 'md' | 'lg'
export type MerajAvatarContext = 'icon' | 'floating' | 'panel'

const SIZE_PX: Record<MerajAvatarContext, Record<MerajAvatarSize, number>> = {
  icon: { xs: 22, sm: 26, md: 38, lg: 52 },
  floating: { xs: 30, sm: 40, md: 52, lg: 64 },
  panel: { xs: 60, sm: 84, md: 116, lg: 156 },
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
  pose?: MerajPose
  className?: string
}

export function MerajAvatar({ state = 'idle', size = 'md', context = 'icon', pose, className }: MerajAvatarProps) {
  const px = SIZE_PX[context][size]

  if (context === 'panel') {
    return <MerajCharacter state={STATE_TO_CHAR[state]} pose={pose} width={px} className={className} />
  }

  // icon | floating — circular state badge; compact when small or floating
  const compact = context === 'floating' || size === 'xs' || size === 'sm'
  return <MerajStateIcon state={state} size={px} compact={compact} className={className} />
}

export default MerajAvatar
