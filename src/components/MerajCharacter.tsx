import { useId } from 'react'
import { motion, type Transition } from 'framer-motion'

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  MERAJ — premium cinematic fox mascot (Pixar/DreamWorks quality)  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 *  Identity — a trusted digital assistant, NOT a children's mascot.
 *  Warm orange fur with cream chest/inner-ear/muzzle · individualised fur
 *  tufts · soft front-left key light + bronze rim light · expressive ice-blue
 *  eyes with detailed catchlights · small embroidered "Meraj" italic wordmark
 *  on the upper-right chest (the only mark — no other symbols/emblems).
 *
 *  Materials
 *  Fur     warm orange #E8793F (key-lit highlight → deep shadow)
 *  Cream   #FFF6E6 muzzle/chest/belly/inner-ear/tail-tip
 *  Eyes    ice-blue #5FB8E8, twin catchlights
 *  Jacket  ink-navy #12141F hoodie, glowing BRONZE seams (#D9A441)
 *  Goggles bronze-rim tech visor, pushed up on forehead
 *  Accent  warm bronze/gold (replaces the old cyan) — seams, glow, sole
 *
 *  Axes: expression · pose · action · view · mouthFrame (lip-sync) · state
 */

export type MerajView = 'front' | 'back' | 'side-left' | 'side-right'
export type MerajExpression = 'neutral' | 'happy' | 'wink' | 'thinking' | 'surprised' | 'confident'
export type MerajPose = 'idle' | 'wave' | 'peace' | 'arms-crossed' | 'presenting' | 'explaining'
export type MerajAction = 'idle' | 'walk' | 'turn'
export type MerajMouthFrame = 'closed' | 'small' | 'open'
export type MerajCharState = 'idle' | 'userTyping' | 'replying' | 'listening' | 'speaking'
export type MerajMode = 'idle' | 'listening' | 'thinking' | 'speaking'

export interface MerajCharacterProps {
  state?: MerajCharState
  expression?: MerajExpression
  pose?: MerajPose
  action?: MerajAction
  view?: MerajView
  /** Static mouth shape for lip-sync frames (overrides speaking animation). */
  mouthFrame?: MerajMouthFrame
  width?: number
  bust?: boolean
  showGround?: boolean
  className?: string
}

// ── Palette ──────────────────────────────────────────────────────────
const C = {
  fur: '#E8793F', furHi: '#F8A968', furRim: '#FFC089', furLo: '#B85A28', furShade: '#9C4A1F',
  cream: '#FFF6E6', creamLo: '#EAD7B4', creamHi: '#FFFFFF',
  navy: '#12141F', navyHi: '#222a45', navyLo: '#0A0C14',
  bronze: '#D9A441', bronzeHi: '#F4DDA8', bronzeLo: '#A9762E',
  eye: '#5FB8E8', eyeHi: '#BFE4F6', eyeLo: '#3F92C2',
  ink: '#0A0C14', brown: '#7A4A24',
}

interface Resolved { expression: MerajExpression; pose: MerajPose; action: MerajAction; mode: MerajMode }
function resolveState(state: MerajCharState | undefined): Resolved {
  switch (state) {
    case 'userTyping': return { expression: 'thinking', pose: 'explaining', action: 'idle', mode: 'thinking' }
    case 'replying':   return { expression: 'happy', pose: 'explaining', action: 'idle', mode: 'speaking' }
    case 'listening':  return { expression: 'neutral', pose: 'idle', action: 'idle', mode: 'listening' }
    case 'speaking':   return { expression: 'happy', pose: 'idle', action: 'idle', mode: 'speaking' }
    default:           return { expression: 'neutral', pose: 'idle', action: 'idle', mode: 'idle' }
  }
}

// ── Defs ─────────────────────────────────────────────────────────────
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-fur`} cx="38%" cy="30%" r="78%">
        <stop offset="0%" stopColor={C.furHi} />
        <stop offset="42%" stopColor={C.fur} />
        <stop offset="100%" stopColor={C.furLo} />
      </radialGradient>
      <linearGradient id={`${id}-furrim`} x1="0%" y1="0%" x2="60%" y2="80%">
        <stop offset="0%" stopColor={C.furRim} stopOpacity="0.9" />
        <stop offset="100%" stopColor={C.furRim} stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${id}-cream`} cx="45%" cy="36%" r="70%">
        <stop offset="0%" stopColor={C.creamHi} />
        <stop offset="55%" stopColor={C.cream} />
        <stop offset="100%" stopColor={C.creamLo} />
      </radialGradient>
      <linearGradient id={`${id}-navy`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor={C.navyHi} />
        <stop offset="55%" stopColor={C.navy} />
        <stop offset="100%" stopColor={C.navyLo} />
      </linearGradient>
      <linearGradient id={`${id}-bronze`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={C.bronzeLo} />
        <stop offset="50%" stopColor={C.bronze} />
        <stop offset="100%" stopColor={C.bronzeHi} />
      </linearGradient>
      <radialGradient id={`${id}-eye`} cx="42%" cy="32%" r="65%">
        <stop offset="0%" stopColor={C.eyeHi} />
        <stop offset="55%" stopColor={C.eye} />
        <stop offset="100%" stopColor={C.eyeLo} />
      </radialGradient>
      <radialGradient id={`${id}-goggle`} cx="48%" cy="36%" r="65%">
        <stop offset="0%" stopColor="#3A2A14" />
        <stop offset="100%" stopColor="#1A1208" />
      </radialGradient>
      <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={C.bronze} stopOpacity="0.5" />
        <stop offset="55%" stopColor={C.bronze} stopOpacity="0.12" />
        <stop offset="100%" stopColor={C.bronze} stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}-soft`} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="3.5" stdDeviation="3.5" floodColor={C.navy} floodOpacity="0.4" />
      </filter>
      <filter id={`${id}-bloom`} x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="2.6" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  )
}

const T_BREATHE: Transition = { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
const T_TAIL: Transition = { duration: 3.8, repeat: Infinity, ease: 'easeInOut' }
const T_BLINK: Transition = { duration: 4.4, repeat: Infinity, ease: 'easeInOut' }
const T_WALK_LEG: Transition = { duration: 0.54, repeat: Infinity, ease: 'easeInOut' }
const T_WALK_ARM: Transition = { duration: 0.54, repeat: Infinity, ease: 'easeInOut' }
const T_BOB: Transition = { duration: 0.54, repeat: Infinity, ease: 'easeInOut' }
const T_TURN: Transition = { duration: 3.8, repeat: Infinity, ease: 'easeInOut' }
const T_PULSE: Transition = { duration: 1.7, repeat: Infinity, ease: 'easeInOut' }

// ── FACE ─────────────────────────────────────────────────────────────
function Eye({ id, x, r, halfLid, closed }: { id: string; x: number; r: number; halfLid?: boolean; closed?: boolean }) {
  if (closed) {
    return <path d={`M${x - r} 106 Q${x} ${112} ${x + r} 106`} stroke={C.ink} strokeWidth={2.8} strokeLinecap="round" fill="none" />
  }
  return (
    <g>
      <ellipse cx={x} cy={106} rx={r} ry={halfLid ? r * 0.6 : r} fill={`url(#${id}-eye)`} />
      <ellipse cx={x - 1} cy={108} rx={r * 0.78} ry={r * 0.5} fill={C.eyeLo} opacity={0.25} />
      {/* iris/pupil */}
      <circle cx={x} cy={107} r={r * 0.42} fill={C.ink} />
      {/* twin catchlights */}
      <circle cx={x + r * 0.22} cy={104.5} r={r * 0.2} fill="#fff" />
      <circle cx={x - r * 0.22} cy={108.5} r={r * 0.1} fill="#fff" opacity={0.7} />
      {/* upper lid line */}
      <path d={`M${x - r} ${100} Q${x} ${97} ${x + r} ${100}`} stroke={C.furShade} strokeWidth={1.4} fill="none" opacity={0.5} />
    </g>
  )
}

function Face({ id, expression, mode, mouthFrame }: { id: string; expression: MerajExpression; mode: MerajMode; mouthFrame?: MerajMouthFrame }) {
  const speaking = mode === 'speaking' && !mouthFrame
  const alert = mode === 'listening'
  const think = mode === 'thinking'
  let px = 0, py = 0
  if (think) { px = 3; py = -3 }
  else if (alert) { py = 1.2 }
  const eyeR = expression === 'surprised' ? 12.5 : 10.5
  const halfLid = expression === 'confident'
  const wink = expression === 'wink'

  const Eyes = (
    <motion.g
      animate={{ scaleY: [1, 1, 0.08, 1] }}
      transition={{ ...T_BLINK, times: [0, 0.9, 0.945, 1] }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    >
      <motion.g animate={{ x: px, y: py }} transition={{ duration: 0.4 }}>
        <Eye id={id} x={96} r={eyeR} halfLid={halfLid} />
        {wink ? <Eye id={id} x={144} r={eyeR} closed /> : <Eye id={id} x={144} r={eyeR} halfLid={halfLid} />}
      </motion.g>
    </motion.g>
  )

  // brows
  const B = expression
  const browL = B === 'thinking'
    ? <path d="M85 89 Q94 86 102 90" stroke={C.furShade} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
    : B === 'surprised'
    ? <path d="M86 83 Q95 80 103 84" stroke={C.furShade} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
    : B === 'confident'
    ? <path d="M85 92 Q94 91 102 93" stroke={C.furShade} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
    : <path d="M86 89 Q95 88 102 90" stroke={C.furShade} strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.5" />
  const browR = B === 'thinking'
    ? <path d="M138 84 Q146 81 154 85" stroke={C.furShade} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
    : B === 'surprised'
    ? <path d="M137 84 Q145 80 154 83" stroke={C.furShade} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
    : B === 'confident'
    ? <path d="M138 93 Q146 91 155 92" stroke={C.furShade} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
    : <path d="M138 90 Q146 88 154 89" stroke={C.furShade} strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.5" />

  // mouth — lip-sync frame overrides
  let Mouth: JSX.Element
  if (mouthFrame === 'closed') {
    Mouth = <path d="M111 135 Q120 139 129 135" stroke={C.brown} strokeWidth="2.6" strokeLinecap="round" fill="none" />
  } else if (mouthFrame === 'small') {
    Mouth = <ellipse cx={120} cy={136} rx={4} ry={2.6} fill={C.ink} />
  } else if (mouthFrame === 'open') {
    Mouth = (
      <g>
        <ellipse cx={120} cy={137} rx={6.5} ry={7.5} fill={C.ink} />
        <ellipse cx={120} cy={141} rx={4.5} ry={3} fill="#C0563A" opacity={0.8} />
      </g>
    )
  } else if (speaking) {
    Mouth = (
      <motion.ellipse cx={120} cy={136} rx={6} ry={5} fill={C.ink}
        animate={{ ry: [2, 6, 3, 5, 2], rx: [5, 6.5, 5.5, 6, 5] }}
        transition={{ duration: 0.34, repeat: Infinity, ease: 'easeInOut' }} />
    )
  } else if (expression === 'happy') {
    Mouth = (
      <g>
        <path d="M103 130 Q120 150 137 130 Q120 138 103 130 Z" fill={C.ink} />
        <path d="M108 131 Q120 136 132 131" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M115 139 Q120 143 125 139" fill="#D9633E" opacity={0.85} />
      </g>
    )
  } else if (expression === 'wink' || expression === 'confident') {
    Mouth = <path d="M111 135 Q122 141 133 132" stroke={C.brown} strokeWidth="2.8" strokeLinecap="round" fill="none" />
  } else if (expression === 'surprised') {
    Mouth = <ellipse cx={120} cy={138} rx={5.5} ry={7} fill={C.ink} />
  } else if (expression === 'thinking') {
    Mouth = <path d="M113 137 L127 134" stroke={C.brown} strokeWidth="2.6" strokeLinecap="round" fill="none" />
  } else {
    Mouth = <path d="M108 134 Q120 146 132 134" stroke={C.brown} strokeWidth="2.6" strokeLinecap="round" fill="none" />
  }

  return (
    <g>
      <circle cx={80} cy={126} r={7.5} fill={C.fur} opacity={0.3} />
      <circle cx={160} cy={126} r={7.5} fill={C.fur} opacity={0.3} />
      {Eyes}
      {browL}{browR}
      <path d="M112 116 L128 116 L120 125 Z" fill={C.ink} />
      <ellipse cx={116.5} cy={119} rx={2.4} ry={1.5} fill="#3a3a44" opacity={0.6} />
      {Mouth}
    </g>
  )
}

// ── ARMS ─────────────────────────────────────────────────────────────
function Sleeve(x: number, id: string) {
  return (
    <>
      <rect x={x} y={158} width={17} height={62} rx={8.5} fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.8} />
      <line x1={x + 8.5} y1={164} x2={x + 8.5} y2={214} stroke={`url(#${id}-bronze)`} strokeWidth={1.2} opacity={0.7} />
    </>
  )
}
function Hand(x: number, id: string) {
  return (
    <g>
      <ellipse cx={x} cy={224} rx={8.5} ry={9} fill={`url(#${id}-fur)`} />
      <path d={`M${x - 3} 217 L${x - 3} 213 M${x} 216 L${x} 212 M${x + 3} 217 L${x + 3} 213`} stroke={C.furLo} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

function Arms({ id, pose, walking }: { id: string; pose: MerajPose; walking: boolean }) {
  if (pose === 'arms-crossed') {
    return (
      <g>
        <rect x={78} y={176} width={68} height={17} rx={8.5} fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.8} transform="rotate(-12 112 184)" />
        <rect x={94} y={188} width={68} height={17} rx={8.5} fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.8} transform="rotate(12 128 196)" />
        <ellipse cx={150} cy={184} rx={9} ry={8.5} fill={`url(#${id}-fur)`} />
        <ellipse cx={90} cy={196} rx={9} ry={8.5} fill={`url(#${id}-fur)`} />
      </g>
    )
  }
  if (pose === 'presenting') {
    return (
      <g>
        <rect x={86} y={178} width={68} height={44} rx={7} fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={1} />
        <rect x={92} y={184} width={56} height={32} rx={3} fill="#0c1622" />
        <motion.rect x={97} y={189} width={30} height={3.4} rx={1.7} fill={C.bronze}
          animate={{ opacity: [0.4, 1, 0.4] }} transition={T_PULSE} filter={`url(#${id}-bloom)`} />
        <rect x={97} y={197} width={42} height={2.6} rx={1.3} fill={C.bronzeHi} opacity={0.5} />
        <rect x={97} y={203} width={34} height={2.6} rx={1.3} fill={C.bronzeHi} opacity={0.4} />
        <rect x={97} y={209} width={24} height={2.6} rx={1.3} fill={C.bronzeHi} opacity={0.35} />
        <ellipse cx={84} cy={196} rx={8} ry={8.5} fill={`url(#${id}-fur)`} />
        <ellipse cx={156} cy={196} rx={8} ry={8.5} fill={`url(#${id}-fur)`} />
      </g>
    )
  }
  // explaining — right hand gesturing outward (open palm up-right)
  if (pose === 'explaining') {
    return (
      <g>
        <motion.g animate={walking ? { rotate: [-7, 7, -7] } : { rotate: 0 }} transition={walking ? T_WALK_ARM : { duration: 0 }} style={{ transformOrigin: '96px 160px' }}>
          {Sleeve(88, id)}{Hand(96, id)}
        </motion.g>
        <motion.g animate={{ rotate: [-46, -38, -46] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '144px 160px' }}>
          {Sleeve(135, id)}
          <g>
            <ellipse cx={150} cy={150} rx={10} ry={10} fill={`url(#${id}-fur)`} />
            <path d="M144 142 L143 133 M150 141 L150 131 M156 142 L158 133" stroke={C.furLo} strokeWidth={2.6} strokeLinecap="round" />
          </g>
        </motion.g>
      </g>
    )
  }

  const wave = pose === 'wave' || pose === 'peace'
  return (
    <g>
      <motion.g animate={walking ? { rotate: [-7, 7, -7] } : { rotate: 0 }} transition={walking ? T_WALK_ARM : { duration: 0 }} style={{ transformOrigin: '96px 160px' }}>
        {Sleeve(88, id)}{Hand(96, id)}
      </motion.g>
      {wave ? (
        <motion.g animate={{ rotate: [-128, -115, -128] }} transition={{ duration: 0.95, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '144px 160px' }}>
          {Sleeve(135, id)}
          <g>
            <ellipse cx={144} cy={96} rx={9.5} ry={9.5} fill={`url(#${id}-fur)`} />
            {pose === 'peace'
              ? <><path d="M141 88 L140 78" stroke={C.furLo} strokeWidth={3} strokeLinecap="round" /><path d="M148 88 L150 78" stroke={C.furLo} strokeWidth={3} strokeLinecap="round" /></>
              : <path d="M138 90 Q144 84 150 90" stroke={C.furLo} strokeWidth={1.6} fill="none" strokeLinecap="round" />}
          </g>
        </motion.g>
      ) : (
        <motion.g animate={walking ? { rotate: [7, -7, 7] } : { rotate: 0 }} transition={walking ? T_WALK_ARM : { duration: 0 }} style={{ transformOrigin: '144px 160px' }}>
          {Sleeve(135, id)}{Hand(144, id)}
        </motion.g>
      )}
    </g>
  )
}

// ── HEAD ─────────────────────────────────────────────────────────────
function Ears({ id, alert }: { id: string; alert: boolean }) {
  return (
    <motion.g animate={alert ? { scale: [1, 1.13, 1] } : { scale: [1, 1.06, 1] }} transition={alert ? { duration: 0.85, repeat: Infinity, ease: 'easeInOut' } : { duration: 4, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '120px 52px' }}>
      <path d="M70 62 L50 4 L90 50 Z" fill={`url(#${id}-fur)`} stroke={C.furLo} strokeWidth={0.7} />
      <path d="M70 62 L54 16 L86 48 Z" fill={`url(#${id}-furrim)`} opacity={0.5} />
      <path d="M74 58 L62 18 L84 49 Z" fill={C.cream} opacity={0.92} />
      <path d="M170 62 L190 4 L150 50 Z" fill={`url(#${id}-fur)`} stroke={C.furLo} strokeWidth={0.7} />
      <path d="M170 62 L186 16 L154 48 Z" fill={`url(#${id}-furrim)`} opacity={0.4} />
      <path d="M166 58 L178 18 L156 49 Z" fill={C.cream} opacity={0.92} />
    </motion.g>
  )
}

function HeadShape({ id }: { id: string }) {
  return (
    <g>
      {/* main head — fox shape with cheek fluff */}
      <path d="M120 42 C92 42 74 58 71 80 C68 96 72 108 77 116 L66 122 L81 119 C86 131 101 142 120 143 C139 142 154 131 159 119 L174 122 L163 116 C168 108 172 96 169 80 C166 58 148 42 120 42 Z"
        fill={`url(#${id}-fur)`} stroke={C.furLo} strokeWidth={0.7} />
      {/* warm key-light on upper-left */}
      <path d="M120 44 C98 44 82 58 78 78 C76 90 80 100 84 106 C82 90 92 58 120 54 C140 54 150 70 150 86 C152 78 156 70 162 80 C166 60 148 44 120 44 Z"
        fill={`url(#${id}-furrim)`} opacity={0.55} />
      {/* brow tuft */}
      <path d="M110 46 L120 36 L130 46 Z" fill={`url(#${id}-fur)`} stroke={C.furLo} strokeWidth={0.5} />
    </g>
  )
}

function Goggles({ id, glow }: { id: string; glow: boolean }) {
  return (
    <g>
      {/* strap wrap */}
      <rect x={60} y={66} width={120} height={3} fill={C.navy} opacity={0.55} />
      {/* visor band pushed up on forehead */}
      <rect x={68} y={66} width={104} height={15} rx={7.5} fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.9} />
      {/* lenses (dark, bronze rim) */}
      <ellipse cx={91} cy={73} rx={12} ry={7} fill={`url(#${id}-goggle)`} stroke={C.bronze} strokeWidth={1.1} />
      <ellipse cx={149} cy={73} rx={12} ry={7} fill={`url(#${id}-goggle)`} stroke={C.bronze} strokeWidth={1.1} />
      {/* lens highlights */}
      <ellipse cx={87} cy={70.5} rx={4} ry={1.8} fill={C.bronzeHi} opacity={0.7} />
      <ellipse cx={145} cy={70.5} rx={4} ry={1.8} fill={C.bronzeHi} opacity={0.7} />
      {/* bronze rim glow */}
      <motion.ellipse cx={91} cy={73} rx={12.5} ry={7.4} fill="none" stroke={C.bronze} strokeWidth={0.8}
        animate={glow ? { opacity: [0.4, 0.9, 0.4] } : { opacity: 0.6 }} transition={glow ? T_PULSE : { duration: 0 }} filter={`url(#${id}-bloom)`} />
      <motion.ellipse cx={149} cy={73} rx={12.5} ry={7.4} fill="none" stroke={C.bronze} strokeWidth={0.8}
        animate={glow ? { opacity: [0.4, 0.9, 0.4] } : { opacity: 0.6 }} transition={glow ? T_PULSE : { duration: 0 }} filter={`url(#${id}-bloom)`} />
    </g>
  )
}

function FrontHead({ id, expression, mode, mouthFrame }: { id: string; expression: MerajExpression; mode: MerajMode; mouthFrame?: MerajMouthFrame }) {
  const alert = mode === 'listening'
  const glow = mode === 'listening' || mode === 'thinking' || mode === 'speaking'
  return (
    <g>
      <Ears id={id} alert={alert} />
      <HeadShape id={id} />
      <Goggles id={id} glow={glow} />
      <ellipse cx={120} cy={126} rx={33} ry={25} fill={`url(#${id}-cream)`} />
      {/* whisker hints */}
      <path d="M96 120 L84 118 M96 124 L83 124 M144 120 L156 118 M144 124 L157 124" stroke={C.creamLo} strokeWidth={0.8} opacity={0.7} />
      <Face id={id} expression={expression} mode={mode} mouthFrame={mouthFrame} />
    </g>
  )
}

function BackHead({ id }: { id: string }) {
  return (
    <g>
      <Ears id={id} alert={false} />
      <ellipse cx={120} cy={96} rx={63} ry={57} fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.8} />
      <ellipse cx={120} cy={142} rx={30} ry={14} fill={`url(#${id}-fur)`} />
      <rect x={58} y={70} width={124} height={9} rx={4.5} fill={C.navy} stroke={C.ink} strokeWidth={0.8} />
      <ellipse cx={91} cy={74} rx={12} ry={7} fill={`url(#${id}-goggle)`} stroke={C.bronze} strokeWidth={1} />
      <ellipse cx={149} cy={74} rx={12} ry={7} fill={`url(#${id}-goggle)`} stroke={C.bronze} strokeWidth={1} />
      <path d="M120 40 Q120 96 120 150" stroke={C.navyHi} strokeWidth={2} fill="none" opacity={0.7} />
    </g>
  )
}

// ── TORSO / LEGS / TAIL ──────────────────────────────────────────────
function Tail({ id, alert }: { id: string; alert: boolean }) {
  return (
    <motion.g animate={alert ? { rotate: [-4, 6, -4] } : { rotate: [0, 5, 0] }} transition={alert ? { duration: 0.75, repeat: Infinity, ease: 'easeInOut' } : T_TAIL} style={{ transformOrigin: '158px 236px' }}>
      <path d="M150 240 C204 250 234 196 221 145 C215 122 197 116 189 134 C197 156 179 185 167 205 C160 218 156 230 150 240 Z" fill={`url(#${id}-fur)`} stroke={C.furLo} strokeWidth={0.7} />
      <path d="M150 240 C190 244 214 210 212 168" stroke={C.furRim} strokeWidth={2} fill="none" opacity={0.4} />
      <path d="M168 205 C177 196 189 177 193 157" stroke={C.furLo} strokeWidth={1} fill="none" opacity={0.4} />
      {/* white fluffy tip with tufts */}
      <path d="M221 145 C227 127 211 114 199 126 C206 137 212 148 208 160 C216 159 224 153 221 145 Z" fill={C.cream} />
      <path d="M214 130 L218 120 M208 128 L209 117 M202 132 L200 122" stroke={C.cream} strokeWidth={2.4} strokeLinecap="round" />
    </motion.g>
  )
}

function Legs({ id, walking }: { id: string; walking: boolean }) {
  const Leg = (x: number, footX: number, rot: number[], pivot: string) => (
    <motion.g animate={walking ? { rotate: rot } : { rotate: 0 }} transition={walking ? T_WALK_LEG : { duration: 0 }} style={{ transformOrigin: pivot }}>
      <rect x={x} y={236} width={22} height={64} rx={11} fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.8} />
      <path d={`M${footX - 16} 296 Q${footX - 18} 312 ${footX - 6} 312 L${footX + 18} 312 Q${footX + 22} 312 ${footX + 20} 304 L${footX + 16} 298 Z`} fill="#0c0d14" stroke={C.ink} strokeWidth={0.7} />
      <rect x={footX - 16} y={308} width={38} height={4} rx={2} fill={`url(#${id}-bronze)`} filter={`url(#${id}-bloom)`} opacity={0.85} />
    </motion.g>
  )
  return <g>{Leg(98, 109, [8, -8, 8], '109px 240px')}{Leg(120, 131, [-8, 8, -8], '131px 240px')}</g>
}

function Torso({ id }: { id: string }) {
  return (
    <g>
      <path d="M94 150 Q120 138 146 150 Q152 164 144 168 Q120 158 96 168 Q88 164 94 150 Z" fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.8} />
      <path d="M88 156 Q83 200 86 240 Q86 250 98 250 L142 250 Q154 250 154 240 Q157 200 152 156 Q146 148 120 148 Q94 148 88 156 Z" fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.9} />
      {/* chest pocket (upper-right) + Meraj wordmark — the only mark */}
      <rect x={128} y={160} width={22} height={16} rx={3} fill={C.navyLo} stroke={C.ink} strokeWidth={0.5} opacity={0.8} />
      <text x={146} y={171.5} textAnchor="end" fontFamily="'Georgia','Times New Roman',serif" fontStyle="italic" fontWeight={600} fontSize={8.2} fill={C.bronzeHi} opacity={0.7} letterSpacing={0.2} transform="rotate(-7 146 170)">Meraj</text>
      {/* left-hip pouch */}
      <rect x={90} y={214} width={24} height={17} rx={4} fill={C.navyLo} stroke={C.ink} strokeWidth={0.6} />
      <line x1={96} y1={222} x2={108} y2={222} stroke={C.navyHi} strokeWidth={1.4} />
    </g>
  )
}

function FrontTorsoFx({ id }: { id: string }) {
  return (
    <g>
      {/* bronze seams */}
      <path d="M97 153 Q120 145 143 153" stroke={`url(#${id}-bronze)`} strokeWidth={1.4} fill="none" filter={`url(#${id}-bloom)`} opacity={0.8} />
      <motion.line x1={120} y1={156} x2={120} y2={244} stroke={C.bronze} strokeWidth={1.5} filter={`url(#${id}-bloom)`} animate={{ opacity: [0.5, 0.95, 0.5] }} transition={T_PULSE} />
      <line x1={91} y1={210} x2={102} y2={210} stroke={C.bronze} strokeWidth={1} filter={`url(#${id}-bloom)`} opacity={0.5} />
      <line x1={138} y1={210} x2={149} y2={210} stroke={C.bronze} strokeWidth={1} filter={`url(#${id}-bloom)`} opacity={0.5} />
    </g>
  )
}

function BackTorsoFx({ id }: { id: string }) {
  return (
    <g>
      <path d="M86 156 Q90 200 92 240" stroke={C.navyHi} strokeWidth={1.6} fill="none" opacity={0.6} />
      <path d="M154 156 Q150 200 148 240" stroke={C.navyHi} strokeWidth={1.6} fill="none" opacity={0.6} />
      <path d="M97 153 Q120 145 143 153" stroke={C.bronze} strokeWidth={1.3} fill="none" filter={`url(#${id}-bloom)`} opacity={0.55} />
      <motion.path d="M86 200 Q120 186 154 200" stroke={C.bronze} strokeWidth={1.3} fill="none" filter={`url(#${id}-bloom)`} opacity={0.5} animate={{ opacity: [0.35, 0.7, 0.35] }} transition={T_PULSE} />
    </g>
  )
}

// ── MAIN ─────────────────────────────────────────────────────────────
export function MerajCharacter({
  state, expression, pose, action, view = 'front', mouthFrame,
  width = 120, bust, showGround = true, className,
}: MerajCharacterProps) {
  const uid = useId().replace(/:/g, '')
  const r = state !== undefined ? resolveState(state) : null
  const expressionF = expression ?? r?.expression ?? 'neutral'
  const poseF = pose ?? r?.pose ?? 'idle'
  const actionF = action ?? r?.action ?? 'idle'
  const mode: MerajMode = r?.mode ?? 'idle'

  const turning = actionF === 'turn'
  const walking = actionF === 'walk'
  const alert = mode === 'listening' || expressionF === 'surprised'
  const glow = mode === 'listening' || mode === 'thinking' || mode === 'speaking'

  const isBust = bust ?? width < 60
  const ratio = 360 / 240
  const height = width * ratio
  const viewBox = isBust ? '40 -6 160 170' : '0 0 240 360'
  const staticBack = view === 'back' && !turning
  const sideMirror = view === 'side-left' ? -1 : view === 'side-right' ? 1 : 1

  return (
    <motion.svg width={width} height={isBust ? width * (170 / 160) : height} viewBox={viewBox} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} role="img" aria-label="Meraj">
      <Defs id={uid} />
      {glow && !isBust && (
        <motion.circle cx={120} cy={150} r={120} fill={`url(#${uid}-glow)`} animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.92, 1.04, 0.92] }} transition={T_PULSE} style={{ transformOrigin: '120px 150px' }} />
      )}
      <motion.g animate={turning ? { scaleX: [1, 0.05, 0.04, 0.05, 1] } : { scaleX: sideMirror }} transition={turning ? { ...T_TURN, times: [0, 0.32, 0.5, 0.68, 1] } : { duration: 0 }} style={{ transformOrigin: '120px 180px' }}>
        <motion.g animate={turning ? { y: walking ? [-2, 2, -2] : [0, -1.5, 0], rotate: walking ? [-1.5, 1.5, -1.5] : 0 } : { y: walking ? [-2, 2, -2] : [0, -1.6, 0], rotate: 0 }} transition={turning ? T_TURN : walking ? T_BOB : T_BREATHE} style={{ transformOrigin: '120px 200px' }} filter={`url(#${uid}-soft)`}>
          {showGround && !isBust && <motion.ellipse cx={120} cy={322} rx={70} ry={10} fill={C.ink} opacity={0.2} animate={walking ? { rx: [64, 74, 64] } : { rx: 70 }} transition={walking ? T_BOB : { duration: 0 }} />}
          <Tail id={uid} alert={alert} />
          <Legs id={uid} walking={walking} />
          <Torso id={uid} />
          <Arms id={uid} pose={poseF} walking={walking} />
          <motion.g animate={{ opacity: staticBack ? 0 : (turning ? [1, 0, 0, 0, 1] : 1) }} transition={turning ? { ...T_TURN, times: [0, 0.32, 0.5, 0.68, 1] } : { duration: 0 }}>
            <FrontTorsoFx id={uid} />
            <motion.g animate={{ rotate: alert ? [0, 5, 0] : mode === 'speaking' ? [0, -3, 0, 2, 0] : [0, 2.5, 0, -2.5, 0] }} transition={alert ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : mode === 'speaking' ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 5, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '120px 96px' }}>
              <FrontHead id={uid} expression={expressionF} mode={mode} mouthFrame={mouthFrame} />
            </motion.g>
          </motion.g>
          <motion.g animate={{ opacity: staticBack ? 1 : (turning ? [0, 1, 1, 1, 0] : 0) }} transition={turning ? { ...T_TURN, times: [0, 0.32, 0.5, 0.68, 1] } : { duration: 0 }}>
            <BackTorsoFx id={uid} />
            <BackHead id={uid} />
          </motion.g>
        </motion.g>
      </motion.g>
    </motion.svg>
  )
}

export default MerajCharacter
