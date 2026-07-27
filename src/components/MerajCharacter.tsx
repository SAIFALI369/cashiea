import { motion } from 'framer-motion'

export type MerajCharState = 'idle' | 'userTyping' | 'replying'

/**
 * MerajCharacter — a small, professional full-body robot (head, torso, two
 * arms with hands, two legs) sitting next to a laptop on his LEFT.
 * State-driven, film-like motion (framer-motion):
 *   - idle:        stands, stares toward the user, gentle breathing
 *   - userTyping:  head tilts down, eyes look down at the input
 *   - replying:    hands move to the laptop keyboard and "type", head faces it
 */
export function MerajCharacter({ state = 'idle', width = 210 }: { state?: MerajCharState; width?: number }) {
  const replying = state === 'replying'
  const userTyping = state === 'userTyping'

  const headRotate = userTyping ? 10 : replying ? -8 : 0
  const pupilDy = userTyping ? 3.2 : 0
  const pupilDx = replying ? -2.2 : 0
  const breatheY = replying ? [0, -1.5, 0] : [0, -2.5, 0]
  const breatheDur = replying ? 0.85 : 3.2
  const legSway = replying ? [0, 1.5, 0] : [0, 0.8, 0]

  return (
    <motion.svg
      width={width}
      height={width * 0.72}
      viewBox="0 0 240 176"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* floor shadow */}
      <ellipse cx="120" cy="168" rx="74" ry="6" fill="rgb(var(--shadow) / 0.10)" />

      <motion.g animate={{ y: breatheY }} transition={{ duration: breatheDur, repeat: Infinity, ease: 'easeInOut' }}>
        {/* ── Laptop (left of the robot) ── */}
        <g>
          <rect x="22" y="118" width="66" height="36" rx="5" fill="rgb(var(--surface-2))" stroke="rgb(var(--line))" strokeWidth="1.5" />
          <rect x="28" y="124" width="54" height="24" rx="2.5" fill="rgb(var(--accent-soft))" />
          {replying ? (
            <motion.rect x="32" y="129" width="22" height="3" rx="1.5" fill="rgb(var(--accent))"
              animate={{ opacity: [0.25, 1, 0.25], width: [16, 26, 16] }} transition={{ duration: 0.7, repeat: Infinity }} />
          ) : (
            <rect x="32" y="129" width="18" height="3" rx="1.5" fill="rgb(var(--accent) / 0.5)" />
          )}
          <rect x="14" y="152" width="82" height="6" rx="3" fill="rgb(var(--surface-3))" />
        </g>

        {/* ── Legs ── */}
        <motion.g animate={{ y: legSway }} transition={{ duration: breatheDur, repeat: Infinity, ease: 'easeInOut' }}>
          <rect x="150" y="146" width="8" height="20" rx="3.5" fill="rgb(var(--surface-3))" />
          <rect x="166" y="146" width="8" height="20" rx="3.5" fill="rgb(var(--surface-3))" />
          <ellipse cx="154" cy="167" rx="9" ry="3.2" fill="rgb(var(--accent) / 0.8)" />
          <ellipse cx="170" cy="167" rx="9" ry="3.2" fill="rgb(var(--accent) / 0.8)" />
        </motion.g>

        {/* ── Body / torso ── */}
        <rect x="142" y="98" width="42" height="54" rx="17" fill="rgb(var(--surface))" stroke="rgb(var(--line))" strokeWidth="1.5" />
        <rect x="152" y="108" width="22" height="6" rx="3" fill="rgb(var(--accent-soft))" />
        <circle cx="163" cy="128" r="4" fill="rgb(var(--accent))" />

        {/* ── Right arm (relaxed, slight sway) ── */}
        <motion.path d="M182 106 q12 12 9 26" stroke="rgb(var(--surface-2))" strokeWidth="7.5" strokeLinecap="round" fill="none"
          animate={{ d: replying ? ['M182 106 q12 12 9 26', 'M182 106 q13 13 8 27', 'M182 106 q12 12 9 26'] : 'M182 106 q12 12 9 26' }}
          transition={{ duration: breatheDur, repeat: Infinity, ease: 'easeInOut' }} />
        <circle cx="191" cy="133" r="5" fill="rgb(var(--surface))" stroke="rgb(var(--line))" strokeWidth="1.2" />

        {/* ── Left arm + hand → reaches the laptop & types when replying ── */}
        <motion.g
          animate={replying ? { rotate: [-3, 3, -3] } : { rotate: 0 }}
          transition={{ duration: 0.45, repeat: replying ? Infinity : 0, ease: 'easeInOut' }}
          style={{ transformOrigin: '144px 106px' }}
        >
          <path d="M144 106 q-22 8 -46 20" stroke="rgb(var(--surface-2))" strokeWidth="7.5" strokeLinecap="round" fill="none" />
          <motion.circle cx="98" cy="126" r="5.5" fill="rgb(var(--surface))" stroke="rgb(var(--line))" strokeWidth="1.2"
            animate={replying ? { cy: [126, 130, 126] } : { cy: 126 }}
            transition={{ duration: 0.26, repeat: replying ? Infinity : 0, ease: 'easeInOut' }} />
        </motion.g>

        {/* ── Head ── */}
        <motion.g
          animate={{ rotate: headRotate }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          style={{ transformOrigin: '163px 86px' }}
        >
          {/* antenna + spark */}
          <line x1="163" y1="62" x2="163" y2="51" stroke="rgb(var(--line))" strokeWidth="2" strokeLinecap="round" />
          <motion.circle cx="163" cy="49" r="3.2" fill="rgb(var(--accent))"
            animate={{ scale: replying ? [1, 1.45, 1] : [1, 1.18, 1], opacity: [1, 0.65, 1] }}
            transition={{ duration: replying ? 0.7 : 2.6, repeat: Infinity, ease: 'easeInOut' }} />

          {/* head */}
          <rect x="139" y="62" width="48" height="40" rx="16" fill="rgb(var(--surface))" stroke="rgb(var(--accent))" strokeOpacity="0.4" strokeWidth="2" />

          {/* eyes */}
          <circle cx="153" cy="83" r="6.8" fill="rgb(var(--paper-deep))" />
          <circle cx="173" cy="83" r="6.8" fill="rgb(var(--paper-deep))" />
          <motion.circle r="3.1" fill="rgb(var(--fg))"
            animate={{ cx: 153 + pupilDx, cy: 83 + pupilDy }} transition={{ duration: 0.3, ease: 'easeOut' }} />
          <motion.circle r="3.1" fill="rgb(var(--fg))"
            animate={{ cx: 173 + pupilDx, cy: 83 + pupilDy }} transition={{ duration: 0.3, ease: 'easeOut' }} />

          {/* subtle cheeks + smile */}
          <circle cx="148" cy="90" r="2" fill="rgb(var(--accent) / 0.25)" />
          <circle cx="178" cy="90" r="2" fill="rgb(var(--accent) / 0.25)" />
          <path d="M156 94 q7 5 14 0" stroke="rgb(var(--fg-muted))" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </motion.g>
      </motion.g>
    </motion.svg>
  )
}

export default MerajCharacter
