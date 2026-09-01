import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { CSSProperties } from 'react'
import type { BusinessMood } from '../lib/businessMood'

// ────────────────────────────────────────────────────────────────
// MerajDevice — the oval device-character (cream/gold body, dark
// glass screen-face, "Meraj" display panel, "M" speaker, Cashiea
// branding baked into the render).
//
// VIDEO-LIKE ANIMATION:
// The body is one static render; the screen-face is an 8-frame
// flipbook sprite sheet that plays on loop with CSS `steps()` —
// eyes blink, pupils drift, waveforms dance, thought dots pulse,
// the mouth chatters. The whole device floats + breathes with a
// glow halo. (A true 3D backflip is still out of scope — tracked
// as a separate future task.)
//
// Optional video upgrade: drop {state}.webm files next to the
// sheets and pass animationMode="video" — each is played through a
// hidden <video> and drawn onto a shared canvas per state, so the
// face runs at 60fps while the body stays a crisp still.
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
// ────────────────────────────────────────────────────────────────

export type MerajInteractionState = 'idle' | 'listening' | 'thinking' | 'speaking'
export type MerajSize = 'sm' | 'md' | 'lg'
export type MerajContext = 'nav' | 'card' | 'panel'
export type MerajFace = 'neutral' | 'happy' | 'sad' | 'listening' | 'thinking' | 'speaking'
export type MerajAnimationMode = 'sprite' | 'video'

/** 8-frame flipbook sprite sheets (220x240 per frame, 1760x240 total). */
export const MERAJ_SHEETS: Record<MerajFace, string> = {
  neutral: '/meraj/sheet-neutral.png',
  happy: '/meraj/sheet-happy.png',
  sad: '/meraj/sheet-sad.png',
  listening: '/meraj/sheet-listening.png',
  thinking: '/meraj/sheet-thinking.png',
  speaking: '/meraj/sheet-speaking.png',
}

/** Static shared body — same render under every face state. */
export const MERAJ_BODY = '/meraj/device-body.png'

/** Optional 60fps video loops ({state}.webm) — used when animationMode="video". */
export const MERAJ_VIDEOS: Record<MerajFace, string> = {
  neutral: '/meraj/neutral.webm',
  happy: '/meraj/happy.webm',
  sad: '/meraj/sad.webm',
  listening: '/meraj/listening.webm',
  thinking: '/meraj/thinking.webm',
  speaking: '/meraj/speaking.webm',
}

export const MERAJ_FRAMES = 8
export const MERAJ_FPS = 12

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

/** Pause the flipbook when the device scrolls out of view (perf). */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(true)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '80px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, inView }
}

interface MerajDeviceProps {
  /** Real app state: listening while the mic is active, thinking while
   *  a request is in flight, speaking while a response is playing. */
  interactionState?: MerajInteractionState
  /** Resting expression — only shown when interactionState is 'idle'. */
  businessMood?: BusinessMood
  size?: MerajSize
  context?: MerajContext
  className?: string
  /** 'sprite' = 8-frame flipbook (default). 'video' = draw {state}.webm
   *  loops through a hidden <video> onto a canvas (60fps). */
  animationMode?: MerajAnimationMode
}

export default function MerajDevice({
  interactionState = 'idle',
  businessMood = 'neutral',
  size = 'md',
  context = 'card',
  className = '',
  animationMode = 'sprite',
}: MerajDeviceProps) {
  const face = resolveMerajFace(interactionState, businessMood)
  const active = interactionState !== 'idle'
  const px = PIXELS[size]
  const { ref: inViewRef, inView } = useInView<HTMLSpanElement>()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const video = animationMode === 'video'

  // ── Video mode: loop the active state's .webm, draw onto the shared
  // canvas. The body stays a crisp still; only the face is video.
  useEffect(() => {
    if (!video) return
    const vid = videoRef.current
    const canvas = canvasRef.current
    if (!vid || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const src = MERAJ_VIDEOS[face]
    if (vid.src !== new URL(src, window.location.href).href) {
      vid.src = src
      vid.loop = true
      vid.muted = true
      vid.playsInline = true
    }

    let raf = 0
    const draw = () => {
      if (vid.readyState >= 2) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
      }
      raf = requestAnimationFrame(draw)
    }
    const tryPlay = () => {
      if (inView) vid.play().catch(() => { /* autoplay blocked — retry on next interaction */ })
      else vid.pause()
    }
    tryPlay()
    raf = requestAnimationFrame(draw)
    const onVis = () => (document.visibilityState === 'visible' ? tryPlay() : vid.pause())
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [video, face, inView])

  return (
    <span
      ref={inViewRef}
      role="img"
      aria-label={FACE_LABEL[face]}
      title={FACE_LABEL[face]}
      data-active={active ? 'true' : 'false'}
      data-anim={video ? 'video' : 'sprite'}
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

      {/* Whole device floats; the frame is clipped to the oval body so
          animated face states never paint outside the character. */}
      <span className="meraj-float relative w-full h-full">
        <span
          className="meraj-clip absolute inset-0 overflow-hidden"
          style={{ borderRadius: '50% 50% 50% 50% / 44% 44% 56% 56%' }}
        >
          {/* Static shared body — identical under every state */}
          <img
            src={MERAJ_BODY}
            alt=""
            aria-hidden="true"
            draggable={false}
            loading="eager"
            decoding="async"
            className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
          />

          {/* Animated screen-face.
              Sprite mode: one <img> per state, cross-faded, flipbook
              playback via CSS steps(). All faces share the same body,
              so state swaps read as one continuous device. */}
          {!video &&
            (Object.keys(MERAJ_SHEETS) as MerajFace[]).map((key) => (
              <span
                key={key}
                aria-hidden="true"
                className={clsx(
                  'meraj-face absolute transition-opacity duration-300',
                  key === face ? 'opacity-100' : 'opacity-0',
                )}
                style={{
                  width: `${(220 / 512) * 100}%`,
                  height: `${(240 / 512) * 100}%`,
                  left: `${(146 / 512) * 100}%`,
                  top: `${(75 / 512) * 100}%`,
                }}
              >
                <img
                  src={MERAJ_SHEETS[key]}
                  alt=""
                  draggable={false}
                  loading="eager"
                  decoding="async"
                  className="meraj-flipbook absolute left-0 top-0 h-full w-auto max-w-none select-none pointer-events-none"
                  style={{
                    animationPlayState: inView ? 'running' : 'paused',
                    aspectRatio: `${MERAJ_FRAMES * 220} / 240`, // 1760/240 strip
                  }}
                />
              </span>
            ))}

          {/* Video mode: hidden <video> loop drawn onto this canvas */}
          {video && (
            <canvas
              ref={canvasRef}
              aria-hidden="true"
              className="absolute left-0 top-0 w-full h-full"
              width={220}
              height={240}
            />
          )}
        </span>
      </span>

      {video && (
        <video ref={videoRef} muted loop playsInline preload="auto" className="hidden" />
      )}
    </span>
  )
}


/**
 * MerajGlyph — a tiny inline-SVG silhouette of the device character
 * (oval body, screen band, "M" speaker) for 12–24px icon slots where
 * spinning the full 6-sheet flipbook would be wasteful. Uses currentColor.
 */
export function MerajGlyph({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <ellipse cx="12" cy="12" rx="8.2" ry="10.4" fill="currentColor" opacity="0.16" />
      <ellipse cx="12" cy="12" rx="8.2" ry="10.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="6.8" y="6.2" width="10.4" height="6.4" rx="2.6" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M10 11.4 L12 8.8 L14 11.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="12" cy="16.6" r="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </svg>
  )
}

/** Map a legacy deriveAvatarState() result to device interaction states. */
export function interactionFromAvatarState(state: string): MerajInteractionState {
  if (state === 'listening') return 'listening'
  if (state === 'thinking' || state === 'loading') return 'thinking'
  if (state === 'speaking') return 'speaking'
  return 'idle'
}
