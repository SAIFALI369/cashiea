import { motion } from 'framer-motion'

export type MerajCharState = 'idle' | 'userTyping' | 'replying'

/**
 * Meraj — a small, cute HUMANOID character (human-like face + expressions),
 * dressed in a luxury green shirt and ultra-dark black pants, beside a laptop
 * on his left. State-driven, all transform-based (GPU) for smoothness on mobile:
 *   idle        → relaxed brows, gentle smile, looks at you, blinks, breathes
 *   userTyping  → brows lower (focused), looks down at the input, neutral mouth
 *   replying    → brows concentrate, turns to the laptop, hand types, mouth firm
 */
export function MerajCharacter({ state = 'idle', width = 180 }: { state?: MerajCharState; width?: number }) {
  const replying = state === 'replying'
  const userTyping = state === 'userTyping'

  const browY = userTyping ? 2.4 : replying ? 1.8 : 0
  const pupilX = replying ? -2.6 : 0
  const pupilY = userTyping ? 3 : replying ? 1.2 : 0
  const headRotate = userTyping ? 7 : replying ? -6 : 0
  const breatheY = replying ? [0, -1.4, 0] : [0, -2.2, 0]
  const breatheDur = replying ? 0.9 : 3.4

  const SKIN = '#e8b88f', SKIN_SH = '#d69b6e', HAIR = '#2a211b'
  const SHIRT = '#0f6b3d', SHIRT_DK = '#0a4f2c', SHIRT_LT = '#13824b'
  const PANTS = '#0b0b0c', SHOE = '#171718'

  return (
    <motion.svg width={width} height={width * 1.34} viewBox="0 0 220 280" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="112" cy="270" rx="70" ry="6" fill="rgb(0 0 0 / 0.10)" />

      <motion.g animate={{ y: breatheY }} transition={{ duration: breatheDur, repeat: Infinity, ease: 'easeInOut' }}>
        {/* Laptop (left) */}
        <g>
          <rect x="14" y="196" width="68" height="30" rx="4" fill="#23232a" />
          <rect x="19" y="201" width="58" height="20" rx="2" fill="#10131a" />
          {replying
            ? <motion.rect x="22" y="205" width="22" height="3" rx="1.5" fill={SHIRT_LT} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.7, repeat: Infinity }} />
            : <rect x="22" y="205" width="16" height="3" rx="1.5" fill={SHIRT_LT} opacity="0.45" />}
          <rect x="6" y="224" width="84" height="6" rx="3" fill="#2c2c33" />
        </g>

        {/* Legs (ultra-dark pants) + shoes */}
        <rect x="96" y="188" width="18" height="56" rx="8" fill={PANTS} />
        <rect x="118" y="188" width="18" height="56" rx="8" fill={PANTS} />
        <rect x="92" y="186" width="48" height="10" rx="4" fill={PANTS} />
        <ellipse cx="104" cy="248" rx="14" ry="6" fill={SHOE} />
        <ellipse cx="128" cy="248" rx="14" ry="6" fill={SHOE} />
        <ellipse cx="100" cy="246" rx="6" ry="2.4" fill="#2a2a2e" />
        <ellipse cx="124" cy="246" rx="6" ry="2.4" fill="#2a2a2e" />

        {/* Torso: luxury green shirt */}
        <path d="M84 132 q28 -14 56 0 l6 60 -68 0 z" fill={SHIRT} />
        <path d="M112 120 l-12 14 l12 8 l12 -8 z" fill={SHIRT_DK} />
        <path d="M84 132 q28 -14 56 0 l3 14 q-31 -10 -62 0 z" fill={SHIRT_DK} opacity="0.5" />
        <circle cx="112" cy="150" r="2" fill={SHIRT_LT} />
        <circle cx="112" cy="162" r="2" fill={SHIRT_LT} />
        <circle cx="112" cy="174" r="2" fill={SHIRT_LT} />

        {/* Right arm (relaxed) */}
        <motion.g animate={{ rotate: replying ? [0, 2, 0] : [0, 1, 0] }} transition={{ duration: breatheDur, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '140px 134px' }}>
          <path d="M138 132 q16 14 13 34" stroke={SHIRT} strokeWidth="13" strokeLinecap="round" fill="none" />
          <circle cx="151" cy="167" r="7" fill={SKIN} />
        </motion.g>

        {/* Left arm → reaches laptop & types when replying */}
        <motion.g animate={{ rotate: replying ? [-4, 4, -4] : 0 }} transition={{ duration: 0.42, repeat: replying ? Infinity : 0, ease: 'easeInOut' }} style={{ transformOrigin: '86px 134px' }}>
          <path d="M86 134 q-26 8 -50 22" stroke={SHIRT} strokeWidth="13" strokeLinecap="round" fill="none" />
          <motion.g animate={{ y: replying ? [0, 4, 0] : 0 }} transition={{ duration: 0.26, repeat: replying ? Infinity : 0, ease: 'easeInOut' }}>
            <circle cx="36" cy="158" r="7.5" fill={SKIN} />
          </motion.g>
        </motion.g>

        {/* Neck */}
        <rect x="103" y="108" width="18" height="16" fill={SKIN_SH} />

        {/* Head + face (human-like) */}
        <motion.g animate={{ rotate: headRotate }} transition={{ duration: 0.45, ease: 'easeInOut' }} style={{ transformOrigin: '112px 80px' }}>
          <path d="M78 74 q-4 -40 34 -42 q38 2 34 42 q-6 -16 -34 -16 q-28 0 -34 16 z" fill={HAIR} />
          <ellipse cx="112" cy="78" rx="30" ry="34" fill={SKIN} />
          <circle cx="83" cy="80" r="5" fill={SKIN} />
          <circle cx="141" cy="80" r="5" fill={SKIN} />
          <path d="M82 60 q10 -26 30 -26 q20 0 30 26 q-14 -12 -30 -12 q-16 0 -30 12 z" fill={HAIR} />

          {/* eyes (blink) */}
          <motion.g animate={{ scaleY: [1, 1, 0.12, 1] }} transition={{ duration: 4.2, times: [0, 0.92, 0.96, 1], repeat: Infinity }} style={{ transformOrigin: '112px 78px' }}>
            <ellipse cx="100" cy="78" rx="7.5" ry="9" fill="#fff" />
            <ellipse cx="124" cy="78" rx="7.5" ry="9" fill="#fff" />
            <motion.g animate={{ x: pupilX, y: pupilY }} transition={{ duration: 0.3, ease: 'easeOut' }}>
              <circle cx="100" cy="79" r="3.6" fill="#241c14" />
              <circle cx="124" cy="79" r="3.6" fill="#241c14" />
              <circle cx="101.4" cy="77.4" r="1.2" fill="#fff" />
              <circle cx="125.4" cy="77.4" r="1.2" fill="#fff" />
            </motion.g>
          </motion.g>

          {/* eyebrows (expression) */}
          <motion.g animate={{ y: browY }} transition={{ duration: 0.3 }} style={{ transformOrigin: '112px 64px' }}>
            <path d="M92 66 q8 -3 14 0" stroke={HAIR} strokeWidth="2.6" strokeLinecap="round" fill="none" />
            <path d="M118 66 q6 -3 14 0" stroke={HAIR} strokeWidth="2.6" strokeLinecap="round" fill="none" />
          </motion.g>

          {/* nose */}
          <path d="M112 82 q2 6 -2 9" stroke={SKIN_SH} strokeWidth="2" strokeLinecap="round" fill="none" />

          {/* mouth (expression by state) */}
          {state === 'idle'
            ? <path d="M102 95 q10 8 20 0" stroke="#7a4a35" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            : replying
              ? <path d="M104 96 q8 1 16 0" stroke="#7a4a35" strokeWidth="2.4" strokeLinecap="round" fill="none" />
              : <path d="M104 96 h16" stroke="#7a4a35" strokeWidth="2.4" strokeLinecap="round" fill="none" />}

          {/* cheeks */}
          <circle cx="90" cy="90" r="4" fill="#e58aa0" opacity="0.4" />
          <circle cx="134" cy="90" r="4" fill="#e58aa0" opacity="0.4" />
        </motion.g>
      </motion.g>
    </motion.svg>
  )
}

export default MerajCharacter
