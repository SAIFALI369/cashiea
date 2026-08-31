import clsx from 'clsx'
import type { CSSProperties } from 'react'
import type { BusinessMood } from '../lib/businessMood'

// ────────────────────────────────────────────────────────────────
// MerajDevice — the oval device-character (cream/gold body, dark
// glass screen-face, "Meraj" display panel, "M" speaker, Cashiea
// branding baked into the render).
//
// One component, three placements:
//   • context="nav"   — bottom-nav center launcher (size sm)
//   • context="card"  — Dashboard "Meraj noticed something" card (md)
//   • context="panel" — full Meraj / talk panel (lg)
//
// Face priority: active interaction states (listening / thinking /
// speaking) ALWAYS beat the resting businessMood — an active
// conversation is more urgent than the resting mood. businessMood
// (happy / neutral / sad) only renders when interactionState is idle.
//
// Motion is CSS-only: an idle float + breathing glow (no 3D, no
// backflips — a full 3D rotation is deliberately out of scope and is
// tracked separately).
// ────────────────────────────────────────────────────────────────

export type MerajInteractionState = 'idle' | 'listening' | 'thinking' | 'speaking'
export type MerajSize = 'sm' | 'md' | 'lg'
export type MerajContext = 'nav' | 'card' | 'panel'
export type MerajFace = 'neutral' | 'happy' | 'sad' | 'listening' | 'thinking' | 'speaking'

/** The 6 face-state variants of the SAME base character render. */
export const MERAJ_FACE_IMAGES: Record<MerajFace, string> = {
  neutral: '/meraj/face-neutral.png',
  happy: '/meraj/face-happy.png',
  sad: '/meraj/face-sad.png',
  listening: '/meraj/face-listening.png',
  thinking: '/meraj/face-thinking.png',
  speaking: '/meraj/face-speaking.png',
}

const FACE_LABEL: Record<MerajFace, string> = {
  neutral: 'Meraj, resting',
  happy: 'Meraj, happy — business is going well',
  sad: 'Meraj, concerned — business needs attention',
  listening: 'Meraj, listening',
  thinking: 'Meraj, thinking',
  speaking: 'Meraj, speaking',
}

/**
 * Face resolution (exported for tests): interaction states take
 * priority; idle defers to businessMood.
 */
export function resolveMerajFace(
  interactionState: MerajInteractionState,
  businessMood: BusinessMood,
): MerajFace {
  if (interactionState === 'listening') return 'listening'
  if (interactionState === 'thinking') return 'thinking'
  if (interactionState === 'speaking') return 'speaking'
  // idle → resting mood expression
  return businessMood === 'happy' ? 'happy' : businessMood === 'sad' ? 'sad' : 'neutral'
}

const PIXELS: Record<MerajSize, number> = { sm: 48, md: 80, lg: 150 }
const FLOAT_PX: Record<MerajSize, number> = { sm: 2.5, md: 4, lg: 6 }
const GLOW_INSET: Record<MerajContext, string> = { nav: '-12%', card: '-16%', panel: '-22%' }

interface MerajDeviceProps {
  /** Real app state: listening while the mic is active, thinking while
   *  a request is in flight, speaking while a response is playing. */
  interactionState?: MerajInteractionState
  /** Resting expression — only shown when interactionState is 'idle'. */
  businessMood?: BusinessMood
  size?: MerajSize
  context?: MerajContext
  className?: string
}

export default function MerajDevice({
  interactionState = 'idle',
  businessMood = 'neutral',
  size = 'md',
  context = 'card',
  className = '',
}: MerajDeviceProps) {
  const face = resolveMerajFace(interactionState, businessMood)
  const active = interactionState !== 'idle'
  const px = PIXELS[size]

  return (
    <span
      role="img"
      aria-label={FACE_LABEL[face]}
      title={FACE_LABEL[face]}
      data-active={active ? 'true' : 'false'}
      className={clsx('meraj-device relative inline-flex items-center justify-center flex-shrink-0', className)}
      style={{
        width: px,
        height: px,
        '--meraj-float': `${FLOAT_PX[size]}px`,
      } as CSSProperties}
    >
      {/* Breathing glow halo (CSS animation) */}
      <span
        aria-hidden="true"
        className="meraj-glow absolute rounded-full pointer-events-none"
        style={{
          inset: GLOW_INSET[context],
          background: 'radial-gradient(closest-side, rgb(var(--accent) / 0.5), transparent 72%)',
          filter: 'blur(6px)',
        }}
      />

      {/* All 6 faces are stacked and cross-faded, so swapping states
          reads as ONE continuous device, never a different character. */}
      <span className="meraj-float relative w-full h-full">
        {(Object.keys(MERAJ_FACE_IMAGES) as MerajFace[]).map((key) => (
          <img
            key={key}
            src={MERAJ_FACE_IMAGES[key]}
            alt=""
            aria-hidden="true"
            draggable={false}
            loading="eager"
            decoding="async"
            className={clsx(
              'absolute inset-0 w-full h-full object-contain select-none pointer-events-none transition-opacity duration-300',
              key === face ? 'opacity-100' : 'opacity-0',
            )}
          />
        ))}
      </span>
    </span>
  )
}
