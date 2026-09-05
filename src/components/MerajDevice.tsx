import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { CSSProperties } from 'react'
import type { BusinessMood } from '../lib/businessMood'

// ────────────────────────────────────────────────────────────────
// MerajDevice — the floating green TV mascot.
//
// DESIGN: a smooth green squircle body (superellipse, 1.2:1 TV
// form factor) with a wide inset screen (1.52:1), "CASHIEA" on the
// top bezel, "M" badge + "Meraj" wordmark + tagline + speaker dots
// on the bottom bezel.
//
// THEME-ADAPTIVE SCREEN: the screen layer is authored as BLACK
// screen + WHITE eyes/mouth (light theme). In dark mode CSS applies
// `filter: invert(1)` to it → WHITE screen + BLACK eyes/mouth.
// One asset set, both themes.
//
// ANIMATION (video-like):
//  • 8-frame flipbook sprite sheets played with CSS steps() (12fps)
//  • OR real 24fps .webm video loops drawn onto a canvas (video mode,
//    default for size="lg") — smooth eased motion, tiny file size
//  • The whole device floats with a gentle 3D tilt (±3° rock) and a
//    green breathing glow. (A true backflip remains out of scope —
//    tracked separately.)
//
// Face priority: active interaction states (listening / thinking /
// speaking) ALWAYS beat the resting businessMood.
// ────────────────────────────────────────────────────────────────

export type MerajInteractionState = 'idle' | 'listening' | 'thinking' | 'speaking'
export type MerajSize = 'sm' | 'md' | 'lg'
export type MerajContext = 'nav' | 'card' | 'panel'
export type MerajFace = 'neutral' | 'happy' | 'sad' | 'listening' | 'thinking' | 'speaking'
export type MerajAnimationMode = 'sprite' | 'video'

/** Static shared body — identical under every face state. */
export const MERAJ_BODY = '/meraj/device-body.png'

/** 8-frame flipbook sprite sheets (408x268 per frame, 3264x268 total). */
export const MERAJ_SHEETS: Record<MerajFace, string> = {
  neutral: '/meraj/sheet-neutral.png',
  happy: '/meraj/sheet-happy.png',
  sad: '/meraj/sheet-sad.png',
  listening: '/meraj/sheet-listening.png',
  thinking: '/meraj/sheet-thinking.png',
  speaking: '/meraj/sheet-speaking.png',
}

/** 24fps .webm face loops (VP9 + alpha) — used in video mode. */
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

/** Source canvas geometry (600x512) and the screen rect inside it. */
export const MERAJ_SCREEN = { x: 96, y: 122, w: 408, h: 268 }  // vertically centered in the body

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
  // idle → resting mood expression. Positive by default: only a real
  // revenue problem puts a sad face on Meraj.
  return businessMood === 'sad' ? 'sad' : 'happy'
}

const PIXELS: Record<MerajSize, number> = { sm: 48, md: 80, lg: 150 }
const FLOAT_PX: Record<MerajSize, number> = { sm: 2.5, md: 4, lg: 6 }
const GLOW_INSET: Record<MerajContext, string> = { nav: '-10%', card: '-14%', panel: '-20%' }

/** Pause animation when the device scrolls out of view (perf). */
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
  /** 'sprite' = flipbook; 'video' = 24fps .webm on a canvas.
   *  Default: 'video' for the large panel character, 'sprite' for
   *  small devices. Falls back to the sprite automatically if the
   *  video can't play (autoplay policy, missing file). */
  animationMode?: MerajAnimationMode
}

export default function MerajDevice({
  interactionState = 'idle',
  businessMood = 'neutral',
  size = 'md',
  context = 'card',
  className = '',
  animationMode,
}: MerajDeviceProps) {
  const face = resolveMerajFace(interactionState, businessMood)
  const active = interactionState !== 'idle'

  // Crossfade memory: render only the current face's sprite (plus the
  // previous one briefly, for the fade) — mounting all six sheets in
  // every placement decoded 6× the images for no visual gain.
  const [prevFace, setPrevFace] = useState<MerajFace | null>(null)
  const faceRef = useRef<MerajFace>(face)
  useEffect(() => {
    if (faceRef.current === face) return
    const oldFace = faceRef.current
    faceRef.current = face
    setPrevFace(oldFace)
    const t = window.setTimeout(() => setPrevFace((p) => (p === oldFace ? null : p)), 400)
    return () => window.clearTimeout(t)
  }, [face])
  const height = PIXELS[size]
  const width = height * (600 / 512) // TV form factor (1.171875 : 1)
  // The mascot rests still by default — an endlessly looping screen feels
  // gimmicky. The flipbook animates only while the device is active
  // (interaction, via data-active), and callers can still opt into the
  // 24fps video loop explicitly through animationMode.
  const mode: MerajAnimationMode = animationMode ?? 'sprite'
  const { ref: inViewRef, inView } = useInView<HTMLSpanElement>()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [videoOk, setVideoOk] = useState(false)

  const video = mode === 'video'

  // ── Video mode: loop the active state's .webm, draw it onto the
  // shared canvas. The body stays a crisp still; only the screen is
  // video. Any failure → the sprite faces stay visible underneath.
  useEffect(() => {
    if (!video) {
      setVideoOk(false)
      return
    }
    const vid = videoRef.current
    const canvas = canvasRef.current
    if (!vid || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setVideoOk(false)
    const src = MERAJ_VIDEOS[face]
    if (vid.src !== new URL(src, window.location.href).href) {
      vid.src = src
      vid.loop = true
      vid.muted = true
      vid.playsInline = true
      vid.preload = 'auto'
    }

    let raf = 0
    let lastDraw = 0
    const draw = (now: number) => {
      // Only paint while visible and actually playing, at most ~30fps —
      // no hidden/paused rAF loop draining battery.
      if (!inView || vid.paused || vid.readyState < 2) {
        raf = 0
        return
      }
      if (now - lastDraw >= 33) {
        lastDraw = now
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
      }
      raf = requestAnimationFrame(draw)
    }
    const tryPlay = () => {
      if (!inView) {
        vid.pause()
        return
      }
      vid.play().then(() => {
        setVideoOk(true)
        if (!raf) raf = requestAnimationFrame(draw)
      }).catch(() => setVideoOk(false))
    }
    const onPlaying = () => setVideoOk(true)
    const onError = () => setVideoOk(false)
    vid.addEventListener('playing', onPlaying)
    vid.addEventListener('error', onError)
    tryPlay()
    const onVis = () => (document.visibilityState === 'visible' ? tryPlay() : vid.pause())
    // No playback possible (autoplay blocked / missing file) → kill the
    // draw loop; the sprite fallback beneath takes over.
    const giveUp = () => { cancelAnimationFrame(raf); raf = 0 }
    const onStall = () => { if (vid.error) giveUp() }
    vid.addEventListener('stalled', onStall)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      vid.removeEventListener('playing', onPlaying)
      vid.removeEventListener('error', onError)
      vid.removeEventListener('stalled', onStall)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [video, face, inView])

  // ── Screen layer geometry (percent of the 600x512 source canvas)
  const scr = {
    width: `${(MERAJ_SCREEN.w / 600) * 100}%`,
    height: `${(MERAJ_SCREEN.h / 512) * 100}%`,
    left: `${(MERAJ_SCREEN.x / 600) * 100}%`,
    top: `${(MERAJ_SCREEN.y / 512) * 100}%`,
  }

  return (
    <span
      ref={inViewRef}
      role="img"
      aria-label={FACE_LABEL[face]}
      title={FACE_LABEL[face]}
      data-active={active ? 'true' : 'false'}
      data-face={face}
      data-inview={inView ? 'true' : 'false'}
      data-anim={video ? 'video' : 'sprite'}
      className={clsx('meraj-device relative inline-flex items-center justify-center flex-shrink-0', className)}
      style={{
        width,
        height,
        '--meraj-float': `${FLOAT_PX[size]}px`,
      } as CSSProperties}
    >
      {/* Green breathing glow halo */}
      <span
        aria-hidden="true"
        className="meraj-glow absolute rounded-full pointer-events-none"
        style={{
          inset: GLOW_INSET[context],
          background: 'radial-gradient(closest-side, rgb(var(--meraj-glow, 46 166 103) / 0.42), rgb(var(--meraj-glow, 46 166 103) / 0.16) 46%, transparent 78%)',
        }}
      />

      {/* Floating + tilting device */}
      <span className="meraj-float relative w-full h-full">
        {/* THE SCREEN — animated face layer, UNDER the body so the
            bezel frames it. Inverted in dark mode via CSS (.dark). */}
        <span
          aria-hidden="true"
          className="meraj-screen absolute pointer-events-none"
          style={scr}
        >
          {/* Sprite faces — only the active (and briefly the previous)
              sheet is mounted; the container clips the 8-frame strip to
              the screen (see .meraj-screen CSS). */}
          {[...(prevFace && prevFace !== face ? [prevFace] : []), face].map((key) => (
            <img
              key={key}
              src={MERAJ_SHEETS[key]}
              alt=""
              draggable={false}
              loading="eager"
              decoding="async"
              className={clsx(
                'meraj-flipbook absolute left-0 top-0 h-full w-auto max-w-none select-none transition-opacity duration-300',
                !videoOk && key === face ? 'opacity-100' : 'opacity-0',
              )}
              style={{
                animationPlayState: inView && !videoOk ? 'running' : 'paused',
                aspectRatio: `${MERAJ_FRAMES * MERAJ_SCREEN.w} / ${MERAJ_SCREEN.h}`,
              }}
            />
          ))}

          {/* Video loop canvas (24fps) — fades in once playback starts */}
          {video && (
            <canvas
              ref={canvasRef}
              width={MERAJ_SCREEN.w}
              height={MERAJ_SCREEN.h}
              className={clsx(
                'absolute left-0 top-0 w-full h-full transition-opacity duration-300',
                videoOk ? 'opacity-100' : 'opacity-0',
              )}
            />
          )}
        </span>

        {/* THE BODY — static green TV frame with the screen hole */}
        <img
          src={MERAJ_BODY}
          alt=""
          aria-hidden="true"
          draggable={false}
          loading="eager"
          decoding="async"
          className="meraj-body absolute inset-0 w-full h-full select-none pointer-events-none"
        />
      </span>

      {video && (
        <video ref={videoRef} muted loop playsInline preload="auto" className="hidden" />
      )}
    </span>
  )
}

/**
 * MerajGlyph — a tiny inline-SVG silhouette of the TV character
 * (squircle body, screen band, "M" speaker) for 12–24px icon slots
 * where the flipbook engine would be wasteful. Uses currentColor.
 */
export function MerajGlyph({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size * 0.86}
      viewBox="0 0 28 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="1" y="1" width="26" height="22" rx="7.5" fill="currentColor" opacity="0.16" />
      <rect x="1" y="1" width="26" height="22" rx="7.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="5" y="5.4" width="18" height="10" rx="2.8" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M10.4 11.8 L14 8.2 L17.6 11.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="17.2" r="1.6" stroke="currentColor" strokeWidth="1.3" fill="none" />
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
