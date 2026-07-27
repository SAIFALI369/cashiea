import { motion } from 'framer-motion'

export type MerajCharState = 'idle' | 'userTyping' | 'replying'

/**
 * Meraj — a small, cute, warm HUMAN-LIKE ROBOT (soft rounded proportions,
 * friendly simple face, clearly a little robot — not human, not a cold mascot).
 * Seated at a tiny desk/laptop, BOTH hands on the keyboard. Designed to live
 * persistently in the chat header. All motion is transform-based (GPU) so it
 * stays smooth/fluid on mobile:
 *   idle        → gentle breathing + blink, relaxed, looking ahead
 *   userTyping  → head glances down toward the input field
 *   replying    → both hands type on the laptop, head faces it, focused
 */
export function MerajCharacter({ state = 'idle', width = 76 }: { state?: MerajCharState; width?: number }) {
  const replying = state === 'replying'
  const userTyping = state === 'userTyping'

  const headRotate = userTyping ? 8 : replying ? -6 : 0
  const pupilY = userTyping ? 2.4 : 0
  const pupilX = replying ? -1.6 : 0
  const breatheY = replying ? [0, -0.8, 0] : [0, -1.4, 0]
  const breatheDur = replying ? 0.8 : 3.2

  return (
    <motion.svg width={width} height={width * 0.64} viewBox="0 0 150 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <motion.g animate={{ y: breatheY }} transition={{ duration: breatheDur, repeat: Infinity, ease: 'easeInOut' }}>
        {/* Desk */}
        <rect x="3" y="74" width="144" height="7" rx="3.5" fill="rgb(var(--surface-3))" />
        <rect x="3" y="80" width="144" height="14" rx="2" fill="rgb(var(--surface-2))" opacity="0.6" />

        {/* Laptop */}
        <rect x="54" y="65" width="44" height="9" rx="2.5" fill="rgb(var(--surface-2))" stroke="rgb(var(--line))" strokeWidth="1" />
        <rect x="57" y="49" width="38" height="17" rx="2.5" fill="rgb(var(--surface-3))" stroke="rgb(var(--line))" strokeWidth="1" />
        {replying
          ? <motion.rect x="61" y="53" width="22" height="2.6" rx="1.3" fill="rgb(var(--accent))" animate={{ opacity: [0.3, 1, 0.3], width: [14, 26, 14] }} transition={{ duration: 0.7, repeat: Infinity }} />
          : <rect x="61" y="53" width="16" height="2.6" rx="1.3" fill="rgb(var(--accent))" opacity="0.4" />}

        {/* Torso (seated, lower half behind the desk) */}
        <path d="M61 46 q14 -8 28 0 l1 22 -30 0 z" fill="rgb(var(--surface))" stroke="rgb(var(--line))" strokeWidth="1" />
        <circle cx="75" cy="58" r="2.4" fill="rgb(var(--accent))" />

        {/* BOTH arms + hands → both rest on the keyboard; both type when replying */}
        <motion.g animate={{ y: replying ? [0, 1.6, 0] : 0 }} transition={{ duration: 0.26, repeat: replying ? Infinity : 0, ease: 'easeInOut' }}>
          <path d="M64 47 q-3 12 2 19" stroke="rgb(var(--surface))" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M86 47 q3 12 -2 19" stroke="rgb(var(--surface))" strokeWidth="6" strokeLinecap="round" fill="none" />
          <circle cx="66" cy="66" r="4" fill="rgb(var(--surface))" stroke="rgb(var(--line))" strokeWidth="1" />
          <circle cx="84" cy="66" r="4" fill="rgb(var(--surface))" stroke="rgb(var(--line))" strokeWidth="1" />
        </motion.g>

        {/* Head */}
        <motion.g animate={{ rotate: headRotate }} transition={{ duration: 0.45, ease: 'easeInOut' }} style={{ transformOrigin: '75px 26px' }}>
          {/* antenna + spark */}
          <line x1="75" y1="9" x2="75" y2="3" stroke="rgb(var(--line))" strokeWidth="1.6" strokeLinecap="round" />
          <motion.circle cx="75" cy="2" r="2.4" fill="rgb(var(--accent))"
            animate={{ scale: replying ? [1, 1.4, 1] : [1, 1.18, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: replying ? 0.7 : 2.6, repeat: Infinity, ease: 'easeInOut' }} />

          {/* head shape (soft, rounded) */}
          <rect x="60" y="9" width="30" height="30" rx="14" fill="rgb(var(--surface))" stroke="rgb(var(--accent))" strokeOpacity="0.4" strokeWidth="1.6" />
          {/* ear-bolts */}
          <circle cx="60" cy="24" r="2.4" fill="rgb(var(--surface-3))" />
          <circle cx="90" cy="24" r="2.4" fill="rgb(var(--surface-3))" />

          {/* eyes (blink) */}
          <motion.g animate={{ scaleY: [1, 1, 0.12, 1] }} transition={{ duration: 4, times: [0, 0.92, 0.96, 1], repeat: Infinity }} style={{ transformOrigin: '75px 23px' }}>
            <circle cx="69" cy="23" r="4.4" fill="rgb(var(--paper-deep))" />
            <circle cx="81" cy="23" r="4.4" fill="rgb(var(--paper-deep))" />
            <motion.g animate={{ x: pupilX, y: pupilY }} transition={{ duration: 0.3, ease: 'easeOut' }}>
              <circle cx="69" cy="23.5" r="2.1" fill="rgb(var(--fg))" />
              <circle cx="81" cy="23.5" r="2.1" fill="rgb(var(--fg))" />
              <circle cx="70" cy="22.4" r="0.7" fill="#fff" />
              <circle cx="82" cy="22.4" r="0.7" fill="#fff" />
            </motion.g>
          </motion.g>

          {/* smile + cheeks */}
          <path d="M69 31 q6 5 12 0" stroke="rgb(var(--fg-muted))" strokeWidth="1.7" strokeLinecap="round" fill="none" />
          <circle cx="65" cy="30" r="2.2" fill="rgb(var(--accent))" opacity="0.18" />
          <circle cx="85" cy="30" r="2.2" fill="rgb(var(--accent))" opacity="0.18" />
        </motion.g>
      </motion.g>
    </motion.svg>
  )
}

export default MerajCharacter
