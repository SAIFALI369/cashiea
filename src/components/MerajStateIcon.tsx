import { motion, type Transition } from 'framer-motion'

/**
 * MerajStateIcon — circular UI state badges mapping 1:1 to Meraj's functional
 * states. Bronze accent (premium reboot). Fox-head in a soft disc.
 *
 *   idle      → neutral, relaxed, no motion indicators
 *   listening → slight head tilt, subtle bronze glow ring, alert, mouth closed
 *   thinking  → eyes narrowed/upward, subtle pulsing glow, contemplative
 *   speaking  → mouth mid-word, animated sound-wave glow ring around border
 *
 * `compact` → simplified, bolder shapes for the persistent 40–60px floating icon.
 */
export type MerajState = 'idle' | 'listening' | 'thinking' | 'speaking'

const T: Transition = { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }

export function MerajStateIcon({
  state = 'idle', size = 40, compact = false, className = '',
}: { state?: MerajState; size?: number; compact?: boolean; className?: string }) {
  const bronze = '#D9A441'
  const bronzeHi = '#F4DDA8'
  const fur = '#E8793F'
  const cream = '#FFF6E6'
  const navy = '#12141F'
  const eye = '#5FB8E8'
  const listening = state === 'listening'
  const thinking = state === 'thinking'
  const speaking = state === 'speaking'
  const active = listening || speaking

  return (
    <motion.svg width={size} height={size} viewBox="0 0 80 80" fill="none" className={className} role="img" aria-label={`Meraj ${state}`}>
      {/* border glow rings */}
      {active && (
        <motion.circle cx={40} cy={40} r={37} fill="none" stroke={bronze} strokeWidth={2}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.94, 1.04, 0.94] }} transition={T} style={{ transformOrigin: '40px 40px' }} />
      )}
      {speaking && (
        <motion.circle cx={40} cy={40} r={33} fill="none" stroke={bronze} strokeWidth={1.4}
          animate={{ opacity: [0.1, 0.5, 0.1], scale: [1.02, 1.16, 1.02] }} transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '40px 40px' }} />
      )}

      {/* disc */}
      <circle cx={40} cy={40} r={34} fill={navy} opacity={0.94} />
      {thinking && (
        <motion.circle cx={40} cy={40} r={34} fill={bronze} opacity={0.16}
          animate={{ opacity: [0.07, 0.26, 0.07] }} transition={T} />
      )}

      {/* fox head (tilts when listening) */}
      <motion.g animate={listening ? { rotate: [-7, -4, -7] } : { rotate: 0 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '40px 42px' }}>
        {/* ears */}
        <motion.g animate={listening ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={T} style={{ transformOrigin: '40px 26px' }}>
          <path d="M24 30 L20 12 L34 24 Z" fill={fur} />
          <path d="M56 30 L60 12 L46 24 Z" fill={fur} />
          {!compact && <><path d="M26 28 L24 16 L32 24 Z" fill={cream} opacity={0.85} /><path d="M54 28 L56 16 L48 24 Z" fill={cream} opacity={0.85} /></>}
        </motion.g>
        {/* head */}
        <ellipse cx={40} cy={38} rx={20} ry={18} fill={fur} />
        {/* goggle band */}
        <rect x={22} y={28} width={36} height={compact ? 4 : 5} rx={2.5} fill={navy} />
        {!compact && <ellipse cx={31} cy={30.5} rx={5} ry={2.4} fill="none" stroke={bronze} strokeWidth={0.8} opacity={0.8} />}
        {!compact && <ellipse cx={49} cy={30.5} rx={5} ry={2.4} fill="none" stroke={bronze} strokeWidth={0.8} opacity={0.8} />}
        {/* muzzle */}
        <ellipse cx={40} cy={46} rx={12} ry={9} fill={cream} />
        {/* eyes */}
        <motion.g animate={state === 'idle' ? { scaleY: [1, 1, 0.1, 1] } : thinking ? { scaleY: [1, 0.78, 1] } : { scaleY: 1 }} transition={thinking ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : { duration: 3.6, repeat: Infinity, times: [0, 0.9, 0.95, 1], ease: 'easeInOut' }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <circle cx={32} cy={40} r={compact ? 4 : 3.6} fill={eye} />
          <circle cx={48} cy={40} r={compact ? 4 : 3.6} fill={eye} />
          <circle cx={32} cy={40.6} r={compact ? 1.9 : 1.6} fill={navy} />
          <circle cx={48} cy={40.6} r={compact ? 1.9 : 1.6} fill={navy} />
          {!compact && <><circle cx={33} cy={39.4} r={0.8} fill="#fff" /><circle cx={49} cy={39.4} r={0.8} fill="#fff" /></>}
        </motion.g>
        {/* nose */}
        <path d="M37 44 L43 44 L40 48 Z" fill={navy} />
        {/* mouth */}
        {speaking ? (
          <motion.ellipse cx={40} cy={52} rx={3} ry={3} fill={navy} animate={{ ry: [1, 3.2, 1.6, 2.8, 1] }} transition={{ duration: 0.32, repeat: Infinity, ease: 'easeInOut' }} />
        ) : thinking ? (
          <path d="M37 51 L43 50" stroke="#7A4A24" strokeWidth={1.6} strokeLinecap="round" fill="none" />
        ) : (
          <path d="M36 50 Q40 54 44 50" stroke="#7A4A24" strokeWidth={1.6} strokeLinecap="round" fill="none" />
        )}
        {/* thinking dots */}
        {thinking && !compact && (
          <motion.g animate={{ opacity: [0.2, 1, 0.2] }} transition={T}>
            <circle cx={59} cy={20} r={2.4} fill={bronze} />
            <circle cx={65} cy={15} r={1.8} fill={bronze} opacity={0.7} />
            <circle cx={69} cy={10} r={1.3} fill={bronze} opacity={0.5} />
          </motion.g>
        )}
      </motion.g>

      {/* sound-wave bars (listening/speaking) */}
      {(listening || speaking) && !compact && (
        <g>
          <Wave x={9} color={bronze} on={listening} />
          <Wave x={66} color={bronze} on={speaking} />
        </g>
      )}
    </motion.svg>
  )
}

function Wave({ x, color, on }: { x: number; color: string; on: boolean }) {
  return (
    <motion.g animate={on ? { scaleY: [0.4, 1, 0.55, 0.9, 0.4] } : { scaleY: 0.3 }} transition={on ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }} style={{ transformOrigin: `${x}px 40px` }}>
      <rect x={x - 1.6} y={34} width={3.2} height={12} rx={1.6} fill={color} />
      <rect x={x + 4} y={36} width={3.2} height={8} rx={1.6} fill={color} opacity={0.85} />
      <rect x={x - 7.6} y={36} width={3.2} height={8} rx={1.6} fill={color} opacity={0.85} />
    </motion.g>
  )
}

export default MerajStateIcon
