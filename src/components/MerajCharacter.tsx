import { motion } from 'framer-motion'

export type MerajMood = 'idle' | 'look' | 'working'

/**
 * MerajCharacter — a small, cute-but-professional AI robot sitting at a desk.
 * Smooth, state-driven life (framer-motion):
 *   - idle:    gentle breathing
 *   - look:    eyes drift down toward the input (owner is typing)
 *   - working: antenna spark pulses, a thinking ring spins, body bobs, typing dots
 * Intentionally stylised (not a mascot cartoon) — clean shapes, brand palette.
 */
export function MerajCharacter({ mood = 'idle', size = 132 }: { mood?: MerajMood; size?: number }) {
  const working = mood === 'working'
  const look = mood === 'look'

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      animate={{ y: working ? [0, -3, 0] : [0, -1.5, 0] }}
      transition={{ duration: working ? 0.7 : 2.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Desk + laptop */}
      <rect x="26" y="94" width="68" height="6" rx="3" fill="rgb(var(--surface-3))" />
      <rect x="44" y="80" width="32" height="14" rx="3" fill="rgb(var(--surface-2))" stroke="rgb(var(--line))" strokeWidth="1.5" />
      <rect x="48" y="83" width="24" height="8" rx="1.5" fill="rgb(var(--accent-soft))" />

      {/* Body */}
      <rect x="42" y="68" width="36" height="24" rx="11" fill="rgb(var(--surface-2))" stroke="rgb(var(--line))" strokeWidth="1.5" />
      <circle cx="60" cy="80" r="3" fill="rgb(var(--accent))" />

      {/* Antenna + spark */}
      <line x1="60" y1="34" x2="60" y2="22" stroke="rgb(var(--line))" strokeWidth="2" strokeLinecap="round" />
      <motion.circle
        cx="60" cy="20" r="3.5" fill="rgb(var(--accent))"
        animate={working ? { scale: [1, 1.5, 1], opacity: [1, 0.55, 1] } : { scale: [1, 1.15, 1] }}
        transition={{ duration: working ? 0.8 : 2.6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Head */}
      <rect x="34" y="34" width="52" height="42" rx="16" fill="rgb(var(--surface))" stroke="rgb(var(--accent))" strokeOpacity="0.4" strokeWidth="2" />

      {/* Eye whites */}
      <circle cx="50" cy="52" r="7" fill="rgb(var(--paper-deep))" />
      <circle cx="70" cy="52" r="7" fill="rgb(var(--paper-deep))" />

      {/* Pupils — drift down while the owner types */}
      <motion.circle cx="50" fill="rgb(var(--fg))" r="3.3"
        animate={{ cy: working ? [52, 50, 54, 52] : look ? 55 : 51 }}
        transition={{ duration: working ? 1.1 : 0.45, repeat: working ? Infinity : 0, ease: 'easeInOut' }} />
      <motion.circle cx="70" fill="rgb(var(--fg))" r="3.3"
        animate={{ cy: working ? [52, 54, 50, 52] : look ? 55 : 51 }}
        transition={{ duration: working ? 1.1 : 0.45, repeat: working ? Infinity : 0, ease: 'easeInOut' }} />

      {/* Smile */}
      <path d="M53 64 Q60 69 67 64" stroke="rgb(var(--fg-muted))" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* Thinking ring (working) */}
      {working && (
        <motion.path
          d="M84 30 A8 8 0 1 1 84 29.99"
          stroke="rgb(var(--accent))" strokeWidth="2.4" strokeLinecap="round" fill="none"
          animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '92px 38px' }}
        />
      )}

      {/* Typing dots (working) */}
      {working && (
        <motion.g animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.1, repeat: Infinity }}>
          <circle cx="96" cy="58" r="2" fill="rgb(var(--accent))" />
          <circle cx="103" cy="58" r="2" fill="rgb(var(--accent))" />
          <circle cx="110" cy="58" r="2" fill="rgb(var(--accent))" />
        </motion.g>
      )}
    </motion.svg>
  )
}

export default MerajCharacter
