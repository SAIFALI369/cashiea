import { motion } from 'framer-motion'

export type MerajCharState = 'idle' | 'userTyping' | 'replying' | 'listening' | 'speaking'

/**
 * Meraj — a small, cute robot that feels ALIVE. 5 states:
 *   idle        → breathing + blink, relaxed
 *   userTyping  → head glances down
 *   replying    → typing on laptop
 *   listening   → ears GROW, glow pulse, eyes wide, alert
 *   speaking    → mouth opens/closes, eyebrows move, head bobs — talking
 */
export function MerajCharacter({ state = 'idle', width = 76 }: { state?: MerajCharState; width?: number }) {
  const s = state
  const replying = s === 'replying'
  const userTyping = s === 'userTyping'
  const listening = s === 'listening'
  const speaking = s === 'speaking'

  const headRotate = userTyping ? 8 : replying ? -6 : speaking ? [0, -3, 0, 3, 0] : 0
  const headRotDur = speaking ? 0.8 : 0.45
  const pupilY = userTyping ? 2.4 : listening ? -0.5 : 0
  const pupilR = listening ? 2.8 : 2.1
  const breatheY = replying ? [0, -0.8, 0] : speaking ? [0, -1, 0] : [0, -1.4, 0]
  const breatheDur = replying ? 0.8 : speaking ? 0.6 : 3.2
  const earR = listening ? [3.5, 5.5, 3.5] : speaking ? 3 : 2.4
  const earDur = listening ? 0.8 : 0.3
  const showGlow = listening || speaking
  const eyeScaleY = listening ? 1.15 : 1
  const blinkDur = speaking ? 1.8 : listening ? 6 : 4

  return (
    <motion.svg width={width} height={width * 0.64} viewBox="0 0 150 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Glow (listening/speaking) */}
      {showGlow && (
        <motion.circle cx="75" cy="40" r="48" fill="rgb(var(--accent))"
          animate={{ opacity: [0.04, 0.14, 0.04], scale: [0.92, 1.08, 0.92] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '75px 40px' }}
        />
      )}

      <motion.g animate={{ y: breatheY }} transition={{ duration: breatheDur, repeat: Infinity, ease: 'easeInOut' }}>
        {/* Desk */}
        <rect x="3" y="74" width="144" height="7" rx="3.5" fill="rgb(var(--surface-3))" />
        <rect x="3" y="80" width="144" height="14" rx="2" fill="rgb(var(--surface-2))" opacity="0.6" />

        {/* Laptop */}
        <rect x="54" y="65" width="44" height="9" rx="2.5" fill="rgb(var(--surface-2))" stroke="rgb(var(--line))" strokeWidth="1" />
        <rect x="57" y="49" width="38" height="17" rx="2.5" fill="rgb(var(--surface-3))" stroke="rgb(var(--line))" strokeWidth="1" />
        {replying
          ? <motion.rect x="61" y="53" width="22" height="2.6" rx="1.3" fill="rgb(var(--accent))" animate={{ opacity: [0.3, 1, 0.3], width: [14, 26, 14] }} transition={{ duration: 0.7, repeat: Infinity }} />
          : <rect x="61" y="53" width="16" height="2.6" rx="1.3" fill="rgb(var(--accent))" opacity={listening ? 0.7 : 0.4} />}

        {/* Torso */}
        <path d="M61 46 q14 -8 28 0 l1 22 -30 0 z" fill="rgb(var(--surface))" stroke="rgb(var(--line))" strokeWidth="1" />
        <motion.circle cx="75" cy="58" r="2.4" fill="rgb(var(--accent))" animate={{ opacity: listening ? [0.5, 1, 0.5] : 1 }} transition={{ duration: 1, repeat: listening ? Infinity : 0 }} />

        {/* Arms + hands */}
        <motion.g animate={{ y: replying ? [0, 1.6, 0] : 0 }} transition={{ duration: 0.26, repeat: replying ? Infinity : 0, ease: 'easeInOut' }}>
          <path d="M64 47 q-3 12 2 19" stroke="rgb(var(--surface))" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M86 47 q3 12 -2 19" stroke="rgb(var(--surface))" strokeWidth="6" strokeLinecap="round" fill="none" />
          <circle cx="66" cy="66" r="4" fill="rgb(var(--surface))" stroke="rgb(var(--line))" strokeWidth="1" />
          <circle cx="84" cy="66" r="4" fill="rgb(var(--surface))" stroke="rgb(var(--line))" strokeWidth="1" />
        </motion.g>

        {/* Head */}
        <motion.g animate={{ rotate: headRotate }} transition={{ duration: headRotDur, repeat: speaking ? Infinity : 0, ease: 'easeInOut' }} style={{ transformOrigin: '75px 26px' }}>
          {/* Antenna + spark */}
          <line x1="75" y1="9" x2="75" y2="3" stroke="rgb(var(--line))" strokeWidth="1.6" strokeLinecap="round" />
          <motion.circle cx="75" cy="2" r="2.4" fill="rgb(var(--accent))"
            animate={{ scale: replying ? [1, 1.4, 1] : listening ? [1, 1.6, 1] : [1, 1.18, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: replying ? 0.7 : listening ? 0.5 : 2.6, repeat: Infinity, ease: 'easeInOut' }} />

          {/* Ears (ear-bolts that GROW when listening) */}
          <motion.circle cx="60" cy="24" fill={listening ? 'rgb(var(--accent))' : 'rgb(var(--surface-3))'}
            animate={{ r: typeof earR === 'object' ? earR : earR }} transition={{ duration: earDur, repeat: typeof earR === 'object' ? Infinity : 0, ease: 'easeInOut' }} />
          <motion.circle cx="90" cy="24" fill={listening ? 'rgb(var(--accent))' : 'rgb(var(--surface-3))'}
            animate={{ r: typeof earR === 'object' ? earR : earR }} transition={{ duration: earDur, repeat: typeof earR === 'object' ? Infinity : 0, ease: 'easeInOut' }} />

          {/* Head shape */}
          <rect x="60" y="9" width="30" height="30" rx="14" fill="rgb(var(--surface))" stroke="rgb(var(--accent))" strokeOpacity={listening ? 0.8 : 0.4} strokeWidth={listening ? 2 : 1.6} />

          {/* Eyebrows (animate when speaking) */}
          <motion.g animate={{ y: speaking ? [0, -1.5, 0] : listening ? -1 : 0 }} transition={{ duration: 0.4, repeat: speaking ? Infinity : 0, ease: 'easeInOut' }}>
            <rect x="66" y="17" width="6.5" height="1.8" rx="0.9" fill="rgb(var(--fg-muted))" opacity="0.7" />
            <rect x="77.5" y="17" width="6.5" height="1.8" rx="0.9" fill="rgb(var(--fg-muted))" opacity="0.7" />
          </motion.g>

          {/* Nose (tiny dot, subtle movement) */}
          <motion.circle cx="75" cy="27" r="0.9" fill="rgb(var(--fg-subtle))" opacity="0.5"
            animate={{ cy: speaking ? [27, 27.4, 27] : 27 }} transition={{ duration: 0.5, repeat: speaking ? Infinity : 0 }} />

          {/* Eyes (blink + expression) */}
          <motion.g animate={{ scaleY: [eyeScaleY, eyeScaleY, 0.12, eyeScaleY] }} transition={{ duration: blinkDur, times: [0, 0.92, 0.96, 1], repeat: Infinity }} style={{ transformOrigin: '75px 23px' }}>
            <circle cx="69" cy="23" r={listening ? 4.8 : 4.4} fill="rgb(var(--paper-deep))" />
            <circle cx="81" cy="23" r={listening ? 4.8 : 4.4} fill="rgb(var(--paper-deep))" />
            <motion.g animate={{ x: 0, y: pupilY }} transition={{ duration: 0.3, ease: 'easeOut' }}>
              <circle cx="69" cy="23.5" r={pupilR} fill="rgb(var(--fg))" />
              <circle cx="81" cy="23.5" r={pupilR} fill="rgb(var(--fg))" />
              <circle cx="70" cy="22.4" r="0.7" fill="#fff" />
              <circle cx="82" cy="22.4" r="0.7" fill="#fff" />
            </motion.g>
          </motion.g>

          {/* Mouth — smile (idle) OR animated talking (speaking) */}
          {speaking ? (
            <motion.ellipse cx="75" cy="32" rx="4.5" fill="rgb(var(--fg-muted))" opacity="0.8"
              animate={{ ry: [0.8, 3.5, 1.2, 2.8, 0.8] }} transition={{ duration: 0.35, repeat: Infinity, ease: 'easeInOut' }} />
          ) : (
            <path d={listening ? 'M67 30 q8 6 16 0' : 'M69 31 q6 5 12 0'} stroke="rgb(var(--fg-muted))" strokeWidth="1.7" strokeLinecap="round" fill="none" />
          )}

          {/* Cheeks */}
          <circle cx="65" cy="30" r="2.2" fill="rgb(var(--accent))" opacity={listening ? 0.35 : 0.18} />
          <circle cx="85" cy="30" r="2.2" fill="rgb(var(--accent))" opacity={listening ? 0.35 : 0.18} />
        </motion.g>
      </motion.g>
    </motion.svg>
  )
}

export default MerajCharacter
