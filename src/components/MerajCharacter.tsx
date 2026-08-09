import { useId } from 'react'
import { motion, type Transition } from 'framer-motion'

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  MERAJ — full-body chibi fox mascot (Anthropic/Pixar aesthetic)   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 *  Identity
 *  ────────  anthropomorphic fox · ~1:1.3 head-to-body · stylised 3D render
 *  Fur     rust-orange #E8793F · cream-white #FFF8EE muzzle/belly/inner-ear/tail-tip
 *  Eyes    ice-blue #5FB8E8 · single catchlight · black pupil
 *  Nose    small black triangle
 *  Gear    blue-lens tech goggles pushed up on forehead · black/ink-navy zip
 *          hoodie with glowing cyan piping (#2FD6FF) + chest chevron logo ·
 *          navy joggers · black sneakers with cyan LED sole · left-hip pouch
 *  Tail    oversized, fluffy, white-tipped — grounding shape in every pose
 *
 *  Driven by three independent axes (plus a legacy `state` shortcut):
 *    • expression  → face (neutral · happy · wink · thinking · surprised · confident)
 *    • pose        → arms/body (idle · wave · peace · arms-crossed · presenting)
 *    • action      → motion (idle · walk · turn)  · turn animates front→back→front
 *    • view        → static framing (front · back · side-left · side-right)
 *
 *  `state` (idle/userTyping/replying/listening/speaking) maps to sensible
 *  expression+pose+action combinations and is kept for backward compatibility
 *  with BottomNav / FloatingMeraj / AIAssistant / Landing.
 */

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────
export type MerajView = 'front' | 'back' | 'side-left' | 'side-right'
export type MerajExpression = 'neutral' | 'happy' | 'wink' | 'thinking' | 'surprised' | 'confident'
export type MerajPose = 'idle' | 'wave' | 'peace' | 'arms-crossed' | 'presenting'
export type MerajAction = 'idle' | 'walk' | 'turn'
export type MerajCharState = 'idle' | 'userTyping' | 'replying' | 'listening' | 'speaking'
export type MerajMode = 'idle' | 'listening' | 'thinking' | 'speaking'

export interface MerajCharacterProps {
  /** Legacy functional state — maps to expression+pose+action+mode. */
  state?: MerajCharState
  /** Face. Overrides the expression implied by `state`. */
  expression?: MerajExpression
  /** Arms/body arrangement. Overrides the pose implied by `state`. */
  pose?: MerajPose
  /** Motion: idle / walk (legs+arms) / turn (front→back→front). */
  action?: MerajAction
  /** Static view when not turning. */
  view?: MerajView
  /** Render width in px. Height auto-scales to the mascot's portrait ratio. */
  width?: number
  /** Crop to head+chest (good under ~60px). Defaults to auto when width<60. */
  bust?: boolean
  /** Soft elliptical ground shadow under the feet. */
  showGround?: boolean
  className?: string
}

// ─────────────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────────────
const C = {
  fur: '#E8793F', furHi: '#F5975A', furLo: '#C96532',
  cream: '#FFF8EE', creamLo: '#F0E4D0',
  navy: '#12141F', navyHi: '#1E2235',
  cyan: '#2FD6FF', cyanSoft: '#7FE6FF',
  eye: '#5FB8E8', eyeHi: '#9FD6F2', goggle: '#2FA8E8',
  ink: '#0B0D16', brown: '#8B5A2B',
}

// ─────────────────────────────────────────────────────────────────────
// State resolution
// ─────────────────────────────────────────────────────────────────────
interface Resolved {
  expression: MerajExpression
  pose: MerajPose
  action: MerajAction
  mode: MerajMode
}
function resolveState(state: MerajCharState | undefined): Resolved {
  switch (state) {
    case 'userTyping': return { expression: 'thinking', pose: 'idle', action: 'idle', mode: 'thinking' }
    case 'replying':   return { expression: 'confident', pose: 'presenting', action: 'idle', mode: 'speaking' }
    case 'listening':  return { expression: 'neutral', pose: 'idle', action: 'idle', mode: 'listening' }
    case 'speaking':   return { expression: 'happy', pose: 'idle', action: 'idle', mode: 'speaking' }
    default:           return { expression: 'neutral', pose: 'idle', action: 'idle', mode: 'idle' }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Shared defs (gradients + filters), unique per instance via useId
// ─────────────────────────────────────────────────────────────────────
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-fur`} cx="42%" cy="32%" r="70%">
        <stop offset="0%" stopColor={C.furHi} />
        <stop offset="58%" stopColor={C.fur} />
        <stop offset="100%" stopColor={C.furLo} />
      </radialGradient>
      <radialGradient id={`${id}-cream`} cx="45%" cy="38%" r="65%">
        <stop offset="0%" stopColor={C.cream} />
        <stop offset="100%" stopColor={C.creamLo} />
      </radialGradient>
      <linearGradient id={`${id}-navy`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor={C.navyHi} />
        <stop offset="100%" stopColor={C.navy} />
      </linearGradient>
      <radialGradient id={`${id}-eye`} cx="40%" cy="34%" r="62%">
        <stop offset="0%" stopColor={C.eyeHi} />
        <stop offset="68%" stopColor={C.eye} />
        <stop offset="100%" stopColor="#3A9ED0" />
      </radialGradient>
      <radialGradient id={`${id}-goggle`} cx="50%" cy="38%" r="62%">
        <stop offset="0%" stopColor="#8FD8FF" />
        <stop offset="100%" stopColor={C.goggle} />
      </radialGradient>
      <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={C.cyan} stopOpacity="0.55" />
        <stop offset="60%" stopColor={C.cyan} stopOpacity="0.14" />
        <stop offset="100%" stopColor={C.cyan} stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}-soft`} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={C.navy} floodOpacity="0.32" />
      </filter>
      <filter id={`${id}-glowf`} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="2.2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  )
}

// Reusable transitions
const T_BREATHE: Transition = { duration: 3.1, repeat: Infinity, ease: 'easeInOut' }
const T_TAIL: Transition = { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
const T_BLINK: Transition = { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }
const T_WALK_LEG: Transition = { duration: 0.52, repeat: Infinity, ease: 'easeInOut' }
const T_WALK_ARM: Transition = { duration: 0.52, repeat: Infinity, ease: 'easeInOut' }
const T_BOB: Transition = { duration: 0.52, repeat: Infinity, ease: 'easeInOut' }
const T_TURN: Transition = { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
const T_PULSE: Transition = { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }

// ─────────────────────────────────────────────────────────────────────
// FACE — eyes / brows / nose / mouth vary by expression + mode
// ─────────────────────────────────────────────────────────────────────
function Face({ id, expression, mode }: { id: string; expression: MerajExpression; mode: MerajMode }) {
  const speaking = mode === 'speaking'
  const alert = mode === 'listening'
  const think = mode === 'thinking'

  // pupil offset
  let px = 0, py = 0
  if (think) { px = 3; py = -3 }            // looking up-right (thinking)
  else if (alert) { py = 1.2 }              // listening — gaze dips slightly
  const eyeR = expression === 'surprised' ? 13 : 11
  const pupilR = 4.6
  const wink = expression === 'wink'
  const halfLid = expression === 'confident'

  const Eyes = (
    <motion.g
      animate={{ scaleY: [1, 1, 0.08, 1] }}
      transition={{ ...T_BLINK, times: [0, 0.9, 0.945, 1] }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    >
      {/* left eye (always open-ish) */}
      <g>
        <ellipse cx={96} cy={106} rx={eyeR} ry={halfLid ? 6.5 : eyeR} fill={`url(#${id}-eye)`} />
        <motion.g animate={{ x: px, y: py }} transition={{ duration: 0.4 }}>
          <circle cx={96} cy={106.5} r={pupilR} fill={C.ink} />
          <circle cx={98} cy={104} r={1.7} fill="#fff" opacity={0.95} />
        </motion.g>
      </g>
      {/* right eye — winks in 'wink', half-lidded in 'confident', else mirror */}
      {wink ? (
        // closed happy eye — downward arc
        <path d="M133 106 Q142 112 151 106" stroke={C.ink} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      ) : (
        <g>
          <ellipse cx={144} cy={106} rx={eyeR} ry={halfLid ? 6.5 : eyeR} fill={`url(#${id}-eye)`} />
          <motion.g animate={{ x: px, y: py }} transition={{ duration: 0.4 }}>
            <circle cx={144} cy={106.5} r={pupilR} fill={C.ink} />
            <circle cx={146} cy={104} r={1.7} fill="#fff" opacity={0.95} />
          </motion.g>
        </g>
      )}
    </motion.g>
  )

  // brows
  let browL: JSX.Element, browR: JSX.Element
  const browBase = 88
  if (expression === 'thinking') {
    browL = <rect x={87} y={browBase} width={16} height={3.2} rx={1.6} fill={C.furLo} transform="rotate(-10 95 89)" opacity={0.7} />
    browR = <rect x={137} y={browBase - 4} width={16} height={3.2} rx={1.6} fill={C.furLo} transform="rotate(12 145 86)" opacity={0.7} />
  } else if (expression === 'surprised') {
    browL = <rect x={86} y={browBase - 5} width={16} height={3.2} rx={1.6} fill={C.furLo} transform="rotate(-6 94 84)" opacity={0.6} />
    browR = <rect x={138} y={browBase - 5} width={16} height={3.2} rx={1.6} fill={C.furLo} transform="rotate(6 146 84)" opacity={0.6} />
  } else if (expression === 'happy' || expression === 'wink') {
    browL = <rect x={88} y={browBase - 2} width={15} height={3} rx={1.5} fill={C.furLo} transform="rotate(-4 95 87)" opacity={0.55} />
    browR = <rect x={137} y={browBase - 2} width={15} height={3} rx={1.5} fill={C.furLo} transform="rotate(4 144 87)" opacity={0.55} />
  } else if (expression === 'confident') {
    browL = <rect x={87} y={browBase + 2} width={16} height={3.2} rx={1.6} fill={C.furLo} transform="rotate(6 95 91)" opacity={0.7} />
    browR = <rect x={137} y={browBase + 2} width={16} height={3.2} rx={1.6} fill={C.furLo} transform="rotate(-6 145 91)" opacity={0.7} />
  } else {
    browL = <rect x={88} y={browBase} width={15} height={3} rx={1.5} fill={C.furLo} transform="rotate(-3 95 89)" opacity={0.5} />
    browR = <rect x={137} y={browBase} width={15} height={3} rx={1.5} fill={C.furLo} transform="rotate(3 144 89)" opacity={0.5} />
  }

  // mouth
  let Mouth: JSX.Element
  if (speaking) {
    Mouth = (
      <motion.ellipse cx={120} cy={136} rx={6} ry={5} fill={C.ink}
        animate={{ ry: [2, 6, 3, 5, 2], rx: [5, 6.5, 5.5, 6, 5] }}
        transition={{ duration: 0.32, repeat: Infinity, ease: 'easeInOut' }} />
    )
  } else if (expression === 'happy') {
    Mouth = (
      <g>
        <path d="M104 130 Q120 148 136 130 Q120 138 104 130 Z" fill={C.ink} />
        <path d="M108 131 Q120 136 132 131" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" />
        <path d="M116 138 Q120 142 124 138" fill="#E8793F" opacity={0.8} />
      </g>
    )
  } else if (expression === 'wink' || expression === 'confident') {
    // smirk — asymmetric
    Mouth = <path d="M112 135 Q122 140 132 132" stroke={C.brown} strokeWidth={2.6} strokeLinecap="round" fill="none" />
  } else if (expression === 'surprised') {
    Mouth = <ellipse cx={120} cy={137} rx={5.5} ry={7} fill={C.ink} />
  } else if (expression === 'thinking') {
    Mouth = <path d="M114 137 L126 134" stroke={C.brown} strokeWidth={2.6} strokeLinecap="round" fill="none" />
  } else {
    // neutral — soft smile
    Mouth = <path d="M110 134 Q120 142 130 134" stroke={C.brown} strokeWidth={2.6} strokeLinecap="round" fill="none" />
  }

  return (
    <g>
      {/* cheeks */}
      <circle cx={82} cy={124} r={6} fill={C.fur} opacity={0.22} />
      <circle cx={158} cy={124} r={6} fill={C.fur} opacity={0.22} />
      {Eyes}
      {browL}{browR}
      {/* nose */}
      <path d="M112 116 L128 116 L120 125 Z" fill={C.ink} />
      <ellipse cx={117} cy={119} rx={2.4} ry={1.6} fill="#3a3a44" opacity={0.6} />
      {Mouth}
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────
// ARMS — by pose (rendered in front of torso)
// ─────────────────────────────────────────────────────────────────────
function Arms({ id, pose, walking }: { id: string; pose: MerajPose; walking: boolean }) {
  const Sleeve = (x: number) => (
    <>
      <rect x={x} y={158} width={17} height={62} rx={8.5} fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.8} />
      <line x1={x + 8.5} y1={164} x2={x + 8.5} y2={214} stroke={C.cyan} strokeWidth={1.1} opacity={0.55} />
    </>
  )
  const Hand = (x: number) => (
    <g>
      <ellipse cx={x} cy={224} rx={8.5} ry={9} fill={`url(#${id}-fur)`} />
      <path d={`M${x - 3} 217 L${x - 3} 213 M${x} 216 L${x} 212 M${x + 3} 217 L${x + 3} 213`} stroke={C.furLo} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )

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
        {/* tablet */}
        <rect x={86} y={178} width={68} height={44} rx={7} fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={1} />
        <rect x={92} y={184} width={56} height={32} rx={3} fill="#0c1622" />
        <motion.rect x={97} y={189} width={30} height={3.4} rx={1.7} fill={C.cyan}
          animate={{ opacity: [0.4, 1, 0.4] }} transition={T_PULSE} filter={`url(#${id}-glowf)`} />
        <rect x={97} y={197} width={42} height={2.6} rx={1.3} fill={C.cyanSoft} opacity={0.5} />
        <rect x={97} y={203} width={34} height={2.6} rx={1.3} fill={C.cyanSoft} opacity={0.4} />
        <rect x={97} y={209} width={24} height={2.6} rx={1.3} fill={C.cyanSoft} opacity={0.35} />
        {/* hands holding */}
        <ellipse cx={84} cy={196} rx={8} ry={8.5} fill={`url(#${id}-fur)`} />
        <ellipse cx={156} cy={196} rx={8} ry={8.5} fill={`url(#${id}-fur)`} />
      </g>
    )
  }

  // idle / wave / peace — left arm hangs, right arm pose-dependent
  const wave = pose === 'wave' || pose === 'peace'

  return (
    <g>
      {/* LEFT arm — hangs (swings when walking) */}
      <motion.g
        animate={walking ? { rotate: [-7, 7, -7] } : { rotate: 0 }}
        transition={walking ? T_WALK_ARM : { duration: 0 }}
        style={{ transformOrigin: '96px 160px' }}
      >
        {Sleeve(88)}
        {Hand(96)}
      </motion.g>

      {/* RIGHT arm */}
      {wave ? (
        <motion.g
          animate={{ rotate: [-128, -116, -128] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '144px 160px' }}
        >
          {Sleeve(135)}
          <g>
            <ellipse cx={144} cy={96} rx={9} ry={9} fill={`url(#${id}-fur)`} />
            {pose === 'peace' ? (
              <>
                <path d="M141 88 L140 78" stroke={C.furLo} strokeWidth={3} strokeLinecap="round" />
                <path d="M148 88 L150 78" stroke={C.furLo} strokeWidth={3} strokeLinecap="round" />
              </>
            ) : (
              <path d="M138 90 Q144 84 150 90" stroke={C.furLo} strokeWidth={1.6} fill="none" strokeLinecap="round" />
            )}
          </g>
        </motion.g>
      ) : (
        <motion.g
          animate={walking ? { rotate: [7, -7, 7] } : { rotate: 0 }}
          transition={walking ? T_WALK_ARM : { duration: 0 }}
          style={{ transformOrigin: '144px 160px' }}
        >
          {Sleeve(135)}
          {Hand(144)}
        </motion.g>
      )}
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────
// HEAD — front (with face) and back (hood) variants
// ─────────────────────────────────────────────────────────────────────
function Ears({ id, alert }: { id: string; alert: boolean }) {
  return (
    <motion.g
      animate={alert ? { scale: [1, 1.14, 1] } : { scale: 1 }}
      transition={alert ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
      style={{ transformOrigin: '120px 52px' }}
    >
      {/* left ear */}
      <path d="M70 60 L52 6 L88 48 Z" fill={`url(#${id}-fur)`} stroke={C.furLo} strokeWidth={0.7} />
      <path d="M74 56 L62 18 L84 47 Z" fill={C.cream} opacity={0.92} />
      {/* right ear */}
      <path d="M170 60 L188 6 L152 48 Z" fill={`url(#${id}-fur)`} stroke={C.furLo} strokeWidth={0.7} />
      <path d="M166 56 L178 18 L156 47 Z" fill={C.cream} opacity={0.92} />
    </motion.g>
  )
}

function FrontHead({ id, expression, mode }: { id: string; expression: MerajExpression; mode: MerajMode }) {
  const alert = mode === 'listening'
  const glow = mode === 'listening' || mode === 'thinking' || mode === 'speaking'
  return (
    <g>
      <Ears id={id} alert={alert} />
      {/* head */}
      <ellipse cx={120} cy={96} rx={60} ry={54} fill={`url(#${id}-fur)`} />
      {/* goggle strap wrap (sides) */}
      <rect x={62} y={66} width={116} height={3} fill={C.navy} opacity={0.5} />
      {/* goggles pushed up on forehead */}
      <rect x={70} y={66} width={100} height={14} rx={7} fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.9} />
      <ellipse cx={92} cy={73} rx={12} ry={7} fill={`url(#${id}-goggle)`} opacity={0.85} />
      <ellipse cx={148} cy={73} rx={12} ry={7} fill={`url(#${id}-goggle)`} opacity={0.85} />
      <ellipse cx={89} cy={71} rx={3.5} ry={2} fill="#BFEAFF" opacity={0.8} />
      <motion.path d="M115 73 L120 67 L125 73" stroke={C.cyan} strokeWidth={1.4} fill="none"
        strokeLinecap="round" filter={`url(#${id}-glowf)`}
        animate={glow ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.8 }} transition={glow ? T_PULSE : { duration: 0 }} />
      {/* muzzle */}
      <ellipse cx={120} cy={124} rx={34} ry={26} fill={`url(#${id}-cream)`} />
      <Face id={id} expression={expression} mode={mode} />
    </g>
  )
}

function BackHead({ id }: { id: string }) {
  return (
    <g>
      <Ears id={id} alert={false} />
      {/* hood covering back of head */}
      <ellipse cx={120} cy={96} rx={62} ry={56} fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.8} />
      {/* a hint of fur peeking at the bottom (neck) */}
      <ellipse cx={120} cy={140} rx={30} ry={14} fill={`url(#${id}-fur)`} />
      {/* goggle strap wrapping around */}
      <rect x={60} y={70} width={120} height={9} rx={4.5} fill={C.navy} stroke={C.ink} strokeWidth={0.8} />
      <path d="M115 74 L120 68 L125 74" stroke={C.cyan} strokeWidth={1.4} fill="none"
        strokeLinecap="round" filter={`url(#${id}-glowf)`} opacity={0.9} />
      {/* hood seam */}
      <path d="M120 40 Q120 96 120 150" stroke={C.navyHi} strokeWidth={2} fill="none" opacity={0.7} />
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────
// TORSO + LEGS + TAIL (shared across front/back)
// ─────────────────────────────────────────────────────────────────────
function Tail({ id, alert }: { id: string; alert: boolean }) {
  return (
    <motion.g
      animate={alert ? { rotate: [-4, 6, -4] } : { rotate: [0, 5, 0] }}
      transition={alert ? { duration: 0.7, repeat: Infinity, ease: 'easeInOut' } : T_TAIL}
      style={{ transformOrigin: '158px 236px' }}
    >
      <path d="M150 240 C202 248 232 198 220 148 C215 126 198 120 190 136 C197 156 180 184 168 204 C161 217 156 230 150 240 Z"
        fill={`url(#${id}-fur)`} stroke={C.furLo} strokeWidth={0.7} />
      <path d="M168 204 C176 196 188 178 192 158" stroke={C.furLo} strokeWidth={1} fill="none" opacity={0.4} />
      {/* white fluffy tip */}
      <path d="M220 148 C225 132 212 120 202 130 C208 140 213 150 210 160 C217 159 223 154 220 148 Z" fill={C.cream} />
      <circle cx="214" cy="140" r="3" fill="#fff" opacity={0.7} />
    </motion.g>
  )
}

function Legs({ id, walking }: { id: string; walking: boolean }) {
  const Leg = (x: number, footX: number, rot: number[], pivot: string) => (
    <motion.g
      animate={walking ? { rotate: rot } : { rotate: 0 }}
      transition={walking ? T_WALK_LEG : { duration: 0 }}
      style={{ transformOrigin: pivot }}
    >
      <rect x={x} y={236} width={22} height={64} rx={11} fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.8} />
      {/* shoe */}
      <path d={`M${footX - 16} 296 Q${footX - 18} 312 ${footX - 6} 312 L${footX + 18} 312 Q${footX + 22} 312 ${footX + 20} 304 L${footX + 16} 298 Z`} fill="#0c0d14" stroke={C.ink} strokeWidth={0.7} />
      <rect x={footX - 16} y={308} width={38} height={4} rx={2} fill={C.cyan} filter={`url(#${id}-glowf)`} opacity={0.85} />
    </motion.g>
  )
  return (
    <g>
      {Leg(98, 109, [8, -8, 8], '109px 240px')}
      {Leg(120, 131, [-8, 8, -8], '131px 240px')}
    </g>
  )
}

function Torso({ id }: { id: string }) {
  return (
    <g>
      {/* hood collar behind neck */}
      <path d="M94 150 Q120 138 146 150 Q152 164 144 168 Q120 158 96 168 Q88 164 94 150 Z" fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.8} />
      {/* body */}
      <path d="M88 156 Q83 200 86 240 Q86 250 98 250 L142 250 Q154 250 154 240 Q157 200 152 156 Q146 148 120 148 Q94 148 88 156 Z"
        fill={`url(#${id}-navy)`} stroke={C.ink} strokeWidth={0.9} />
      {/* left-hip pouch */}
      <rect x={90} y={214} width={24} height={17} rx={4} fill="#0c0d14" stroke={C.ink} strokeWidth={0.6} />
      <line x1={96} y1={222} x2={108} y2={222} stroke={C.navyHi} strokeWidth={1.4} />
    </g>
  )
}

// front-only torso overlays (zip, chest chevron, collar piping)
function FrontTorsoFx({ id }: { id: string }) {
  return (
    <g>
      {/* collar piping */}
      <path d="M97 153 Q120 145 143 153" stroke={C.cyan} strokeWidth={1.3} fill="none" filter={`url(#${id}-glowf)`} opacity={0.8} />
      {/* zip line */}
      <motion.line x1={120} y1={156} x2={120} y2={244} stroke={C.cyan} strokeWidth={1.4}
        filter={`url(#${id}-glowf)`}
        animate={{ opacity: [0.55, 1, 0.55] }} transition={T_PULSE} />
      {/* cuff piping */}
      <line x1={91} y1={210} x2={102} y2={210} stroke={C.cyan} strokeWidth={1} filter={`url(#${id}-glowf)`} opacity={0.5} />
      <line x1={138} y1={210} x2={149} y2={210} stroke={C.cyan} strokeWidth={1} filter={`url(#${id}-glowf)`} opacity={0.5} />
      {/* chest chevron logo */}
      <motion.path d="M108 198 L120 182 L132 198" stroke={C.cyan} strokeWidth={2.4} fill="none"
        strokeLinecap="round" strokeLinejoin="round" filter={`url(#${id}-glowf)`}
        animate={{ opacity: [0.55, 1, 0.55] }} transition={T_PULSE} />
    </g>
  )
}

// back-only torso overlays (big back chevron + seam)
function BackTorsoFx({ id }: { id: string }) {
  return (
    <g>
      <path d="M86 156 Q90 200 92 240" stroke={C.navyHi} strokeWidth={1.6} fill="none" opacity={0.6} />
      <path d="M154 156 Q150 200 148 240" stroke={C.navyHi} strokeWidth={1.6} fill="none" opacity={0.6} />
      {/* back chevron (bigger) */}
      <motion.path d="M104 206 L120 182 L136 206 M112 206 L120 194 L128 206" stroke={C.cyan} strokeWidth={2.6} fill="none"
        strokeLinecap="round" strokeLinejoin="round" filter={`url(#${id}-glowf)`}
        animate={{ opacity: [0.5, 1, 0.5] }} transition={T_PULSE} />
      {/* hood seam piping */}
      <path d="M97 153 Q120 145 143 153" stroke={C.cyan} strokeWidth={1.2} fill="none" filter={`url(#${id}-glowf)`} opacity={0.6} />
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────
export function MerajCharacter({
  state, expression, pose, action, view = 'front',
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
  const ratio = 360 / 240 // portrait
  const height = width * ratio
  // bust crops to head + chest
  const viewBox = isBust ? '42 -6 156 168' : '0 0 240 360'

  // static back view (no turn)
  const staticBack = view === 'back' && !turning
  const sideMirror = view === 'side-left' ? -1 : view === 'side-right' ? 1 : 1

  return (
    <motion.svg
      width={width}
      height={isBust ? width * (168 / 156) : height}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Meraj"
    >
      <Defs id={uid} />

      {/* ambient glow */}
      {glow && !isBust && (
        <motion.circle cx={120} cy={150} r={120} fill={`url(#${uid}-glow)`}
          animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.92, 1.04, 0.92] }}
          transition={T_PULSE} style={{ transformOrigin: '120px 150px' }} />
      )}

      {/* TURN WRAPPER — scaleX squeeze + crossfade front/back */}
      <motion.g
        animate={turning ? {
          scaleX: [1, 0.05, 0.04, 0.05, 1],
        } : { scaleX: sideMirror }}
        transition={turning ? {
          ...T_TURN,
          times: [0, 0.32, 0.5, 0.68, 1],
        } : { duration: 0 }}
        style={{ transformOrigin: '120px 180px' }}
      >
        <motion.g
          animate={turning ? {
            y: walking ? [-2, 2, -2] : [0, -1.5, 0],
            rotate: walking ? [-1.5, 1.5, -1.5] : 0,
          } : {
            y: walking ? [-2, 2, -2] : [0, -1.6, 0],
            rotate: 0,
          }}
          transition={turning ? T_TURN : walking ? T_BOB : T_BREATHE}
          style={{ transformOrigin: '120px 200px' }}
          filter={`url(#${uid}-soft)`}
        >
          {/* ground shadow */}
          {showGround && !isBust && (
            <motion.ellipse cx={120} cy={322} rx={70} ry={10} fill={C.ink} opacity={0.18}
              animate={walking ? { rx: [64, 74, 64] } : { rx: 70 }}
              transition={walking ? T_BOB : { duration: 0 }} />
          )}

          {/* shared body stack */}
          <Tail id={uid} alert={alert} />
          <Legs id={uid} walking={walking} />
          <Torso id={uid} />

          {/* ARMS */}
          <Arms id={uid} pose={poseF} walking={walking} />

          {/* FRONT layer (face + front fx) */}
          <motion.g
            animate={{ opacity: staticBack ? 0 : (turning ? [1, 0, 0, 0, 1] : 1) }}
            transition={turning ? { ...T_TURN, times: [0, 0.32, 0.5, 0.68, 1] } : { duration: 0 }}
          >
            <FrontTorsoFx id={uid} />
            {/* head */}
            <motion.g
              animate={{ rotate: alert ? [0, 5, 0] : mode === 'speaking' ? [0, -3, 0, 2, 0] : 0 }}
              transition={alert ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : mode === 'speaking' ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
              style={{ transformOrigin: '120px 96px' }}
            >
              <FrontHead id={uid} expression={expressionF} mode={mode} />
            </motion.g>
          </motion.g>

          {/* BACK layer (hood + back fx) */}
          <motion.g
            animate={{ opacity: staticBack ? 1 : (turning ? [0, 1, 1, 1, 0] : 0) }}
            transition={turning ? { ...T_TURN, times: [0, 0.32, 0.5, 0.68, 1] } : { duration: 0 }}
          >
            <BackTorsoFx id={uid} />
            <BackHead id={uid} />
          </motion.g>
        </motion.g>
      </motion.g>
    </motion.svg>
  )
}

export default MerajCharacter
