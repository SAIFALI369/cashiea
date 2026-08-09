import { motion, type Transition } from 'framer-motion'

/**
 * MerajStateIcon — circular functional state badges that map 1:1 to Meraj's
 * UI states: idle · listening · thinking · speaking.
 *
 * A compact fox-head in a soft circle, with a state-specific motif:
 *   idle      → calm, slow blink
 *   listening → alert ears, sound-wave bars, accent ring pulse
 *   thinking  → glow pulse, dots
 *   speaking  → open mouth, sound-wave bars, accent ring
 */
export type MerajState = 'idle' | 'listening' | 'thinking' | 'speaking'

const T: Transition = { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }

function WaveBars({ x, color, on }: { x: number; color: string; on: boolean }) {
  return (
    <motion.g animate={on ? { scaleY: [0.4, 1, 0.55, 0.9, 0.4] } : { scaleY: 0.3 }} transition={on ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }} style={{ transformOrigin: `${x}px 40px` }}>
      <rect x={x - 1.6} y={34} width={3.2} height={12} rx={1.6} fill={color} />
      <rect x={x + 4} y={36} width={3.2} height={8} rx={1.6} fill={color} opacity={0.85} />
      <rect x={x - 7.6} y={36} width={3.2} height={8} rx={1.6} fill={color} opacity={0.85} />
    </motion.g>
  )
}

export function MerajStateIcon({
  state = 'idle', size = 40, className = '',
}: { state?: MerajState; size?: number; className?: string }) {
  const accent = '#2FD6FF'
  const fur = '#E8793F'
  const cream = '#FFF8EE'
  const navy = '#12141F'
  const listening = state === 'listening'
  const thinking = state === 'thinking'
  const speaking = state === 'speaking'
  const active = listening || speaking
  const ring = active

  return (
    <motion.svg width={size} height={size} viewBox="0 0 80 80" fill="none" className={className} role="img" aria-label={`Meraj ${state}`}>
      {/* accent ring */}
      {ring && (
        <motion.circle cx={40} cy={40} r={37} fill="none" stroke={accent} strokeWidth={2}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.94, 1.04, 0.94] }}
          transition={T} style={{ transformOrigin: '40px 40px' }} />
      )}

      {/* soft disc */}
      <circle cx={40} cy={40} r={34} fill={navy} opacity={0.92} />
      {thinking && (
        <motion.circle cx={40} cy={40} r={34} fill={accent} opacity={0.16}
          animate={{ opacity: [0.08, 0.28, 0.08] }} transition={T} />
      )}

      {/* fox head (compact) */}
      <g>
        {/* ears */}
        <motion.g animate={listening ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={T} style={{ transformOrigin: '40px 26px' }}>
          <path d="M24 30 L20 12 L34 24 Z" fill={fur} />
          <path d="M56 30 L60 12 L46 24 Z" fill={fur} />
          <path d="M26 28 L24 16 L32 24 Z" fill={cream} opacity={0.85} />
          <path d="M54 28 L56 16 L48 24 Z" fill={cream} opacity={0.85} />
        </motion.g>
        {/* head */}
        <ellipse cx={40} cy={38} rx={20} ry={18} fill={fur} />
        {/* goggle strap on forehead */}
        <rect x={22} y={28} width={36} height={5} rx={2.5} fill={navy} />
        {/* muzzle */}
        <ellipse cx={40} cy={46} rx={12} ry={9} fill={cream} />

        {/* eyes */}
        <motion.g animate={state === 'idle' ? { scaleY: [1, 1, 0.1, 1] } : { scaleY: 1 }} transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.9, 0.95, 1], ease: 'easeInOut' }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <circle cx={32} cy={40} r={3.6} fill="#5FB8E8" />
          <circle cx={48} cy={40} r={3.6} fill="#5FB8E8" />
          <circle cx={32} cy={40.6} r={1.6} fill={navy} />
          <circle cx={48} cy={40.6} r={1.6} fill={navy} />
        </motion.g>

        {/* nose */}
        <path d="M37 44 L43 44 L40 48 Z" fill={navy} />

        {/* mouth */}
        {speaking ? (
          <motion.ellipse cx={40} cy={52} rx={3} ry={3} fill={navy}
            animate={{ ry: [1, 3.2, 1.6, 2.8, 1] }} transition={{ duration: 0.3, repeat: Infinity, ease: 'easeInOut' }} />
        ) : (
          <path d="M36 50 Q40 54 44 50" stroke="#8B5A2B" strokeWidth={1.6} strokeLinecap="round" fill="none" />
        )}

        {/* thinking dots */}
        {thinking && (
          <motion.g animate={{ opacity: [0.2, 1, 0.2] }} transition={T}>
            <circle cx={58} cy={20} r={2.4} fill={accent} />
            <circle cx={64} cy={15} r={1.8} fill={accent} opacity={0.7} />
            <circle cx={68} cy={10} r={1.3} fill={accent} opacity={0.5} />
          </motion.g>
        )}
      </g>

      {/* sound-wave motif */}
      {(listening || speaking) && (
        <g>
          <WaveBars x={7} color={accent} on={listening} />
          <WaveBars x={66} color={accent} on={speaking} />
        </g>
      )}
    </motion.svg>
  )
}

export default MerajStateIcon
