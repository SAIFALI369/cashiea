import { motion } from 'framer-motion'

export type MerajCharState = 'idle' | 'userTyping' | 'replying' | 'listening' | 'speaking'

/**
 * Meraj — 3D-styled chibi fox mascot (Anthropic/Pixar aesthetic).
 * Rust-orange fur, cream muzzle/belly, ice-blue eyes, tech goggles pushed up,
 * black hoodie with glowing cyan piping + chevron logo, fluffy white-tipped tail.
 *
 * States:
 *   idle        → calm breathing, gentle blink, tail sway
 *   userTyping  → head tilts, curious
 *   replying    → typing on laptop, focused
 *   listening   → ears perk UP, alert, sound-wave glow
 *   speaking    → mouth animates, eyebrows move, head bobs
 *
 * SVG with 3D-like gradients, drop shadows, and depth layering.
 * All motion is transform-based (GPU) for mobile smoothness.
 */

// ── Reusable gradient/shadow defs ──
function Defs() {
  return (
    <defs>
      {/* Rust-orange body fur */}
      <radialGradient id="meraj-fur" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#F08A4A" />
        <stop offset="60%" stopColor="#E8793F" />
        <stop offset="100%" stopColor="#C96532" />
      </radialGradient>
      {/* Cream belly/muzzle */}
      <radialGradient id="meraj-cream" cx="45%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#FFF8EE" />
        <stop offset="100%" stopColor="#F0E4D0" />
      </radialGradient>
      {/* Hoodie navy */}
      <linearGradient id="meraj-hoodie" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1A1D2E" />
        <stop offset="100%" stopColor="#12141F" />
      </linearGradient>
      {/* Goggle lens blue */}
      <radialGradient id="meraj-goggle" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#7FD0FF" />
        <stop offset="100%" stopColor="#2FA8E8" />
      </radialGradient>
      {/* Eye ice-blue */}
      <radialGradient id="meraj-eye" cx="40%" cy="35%" r="60%">
        <stop offset="0%" stopColor="#8FD0F0" />
        <stop offset="70%" stopColor="#5FB8E8" />
        <stop offset="100%" stopColor="#3A9ED0" />
      </radialGradient>
      {/* Glow for cyan elements */}
      <filter id="meraj-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      {/* Drop shadow for depth */}
      <filter id="meraj-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#12141F" floodOpacity="0.35" />
      </filter>
    </defs>
  )
}

export function MerajCharacter({ state = 'idle', width = 76 }: { state?: MerajCharState; width?: number }) {
  const s = state
  const replying = s === 'replying'
  const userTyping = s === 'userTyping'
  const listening = s === 'listening'
  const speaking = s === 'speaking'

  // Head motion
  const headRotate = userTyping ? 6 : replying ? -5 : speaking ? [0, -3, 0, 2, 0] : 0
  const headRotDur = speaking ? 0.7 : 0.45
  // Body breathing
  const breatheY = replying ? [0, -0.6, 0] : speaking ? [0, -0.8, 0] : [0, -1.2, 0]
  const breatheDur = replying ? 0.8 : speaking ? 0.5 : 3.0
  // Ear perk (listening = tall, speaking = slight bounce)
  const earScale = listening ? [1, 1.15, 1] : speaking ? [1, 1.05, 1] : 1
  const earDur = listening ? 0.7 : 0.4
  // Tail sway
  const tailRotate = listening ? [-3, 3, -3] : [0, 4, 0]
  const tailDur = listening ? 0.6 : 4.0
  // Pupils
  const pupilY = userTyping ? 1.5 : listening ? -0.8 : 0
  const pupilR = listening ? 2.6 : 2.0
  // Blink
  const blinkDur = speaking ? 1.5 : listening ? 5 : 3.5
  // Glow visibility
  const showGlow = listening || speaking
  const cyanGlowOpacity = listening ? [0.2, 0.5, 0.2] : speaking ? [0.15, 0.35, 0.15] : 0.15

  return (
    <motion.svg width={width} height={width * 0.72} viewBox="0 0 150 108" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <Defs />

      {/* Ambient glow (listening/speaking) */}
      {showGlow && (
        <motion.circle cx="75" cy="48" r="52" fill="#2FD6FF"
          animate={{ opacity: cyanGlowOpacity as any, scale: [0.9, 1.08, 0.9] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '75px 48px' }}
        />
      )}

      <motion.g animate={{ y: breatheY }} transition={{ duration: breatheDur, repeat: Infinity, ease: 'easeInOut' }} filter="url(#meraj-shadow)">

        {/* ── TAIL (behind body, fluffy white-tipped) ── */}
        <motion.g animate={{ rotate: tailRotate }} transition={{ duration: tailDur, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '108px 70px' }}>
          <path d="M104 72 Q126 58 130 38 Q132 26 124 22 Q118 20 116 28 Q114 44 104 58 Z" fill="url(#meraj-fur)" />
          <path d="M124 22 Q132 20 134 28 Q132 34 126 34 Q120 32 122 26 Z" fill="#FFF8EE" />
        </motion.g>

        {/* ── BODY / TORSO (hoodie) ── */}
        <path d="M57 52 Q55 62 56 78 L94 78 Q95 62 93 52 Q86 47 75 47 Q64 47 57 52 Z" fill="url(#meraj-hoodie)" stroke="#0E1018" strokeWidth="0.8" />

        {/* Cyan hoodie piping — zip line */}
        <motion.line x1="75" y1="50" x2="75" y2="76" stroke="#2FD6FF" strokeWidth="1.2" filter="url(#meraj-glow)"
          animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }} />
        {/* Collar piping */}
        <path d="M60 52 Q67 49 75 49 Q83 49 90 52" stroke="#2FD6FF" strokeWidth="1" fill="none" filter="url(#meraj-glow)" opacity="0.7" />
        {/* Cuff piping L+R */}
        <line x1="57" y1="66" x2="61" y2="66" stroke="#2FD6FF" strokeWidth="0.8" filter="url(#meraj-glow)" opacity="0.5" />
        <line x1="89" y1="66" x2="93" y2="66" stroke="#2FD6FF" strokeWidth="0.8" filter="url(#meraj-glow)" opacity="0.5" />

        {/* Chevron logo on chest (^ shape, cyan glow) */}
        <motion.path d="M70 62 L75 57 L80 62" stroke="#2FD6FF" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#meraj-glow)"
          animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.5, repeat: Infinity }} />

        {/* ── HANDS (on keyboard when replying, relaxed otherwise) ── */}
        <motion.g animate={{ y: replying ? [0, 1.4, 0] : 0 }} transition={{ duration: 0.22, repeat: replying ? Infinity : 0, ease: 'easeInOut' }}>
          <ellipse cx="60" cy="72" rx="4.5" ry="3.5" fill="url(#meraj-fur)" />
          <ellipse cx="90" cy="72" rx="4.5" ry="3.5" fill="url(#meraj-fur)" />
        </motion.g>

        {/* ── DESK + LAPTOP ── */}
        <rect x="48" y="76" width="54" height="6" rx="3" fill="#1A1D2E" />
        <rect x="48" y="81" width="54" height="12" rx="2" fill="#12141F" opacity="0.5" />
        <rect x="56" y="69" width="38" height="8" rx="2" fill="#1A1D2E" stroke="#0E1018" strokeWidth="0.5" />
        <rect x="59" y="55" width="32" height="15" rx="2" fill="#1A1D2E" stroke="#0E1018" strokeWidth="0.5" />
        {replying
          ? <motion.rect x="62" y="58" width="20" height="2.2" rx="1.1" fill="#2FD6FF" filter="url(#meraj-glow)"
              animate={{ opacity: [0.3, 1, 0.3], width: [12, 26, 12] }} transition={{ duration: 0.6, repeat: Infinity }} />
          : <rect x="62" y="58" width="16" height="2.2" rx="1.1" fill="#2FD6FF" opacity={listening ? 0.6 : 0.3} filter="url(#meraj-glow)" />}

        {/* ── HEAD ── */}
        <motion.g animate={{ rotate: headRotate }} transition={{ duration: headRotDur, repeat: speaking ? Infinity : 0, ease: 'easeInOut' }} style={{ transformOrigin: '75px 32px' }}>

          {/* EARS (fox — triangular, rust outside, cream inside) */}
          <motion.g animate={{ scale: earScale }} transition={{ duration: earDur, repeat: (listening || speaking) ? Infinity : 0, ease: 'easeInOut' }} style={{ transformOrigin: '75px 18px' }}>
            {/* Left ear */}
            <path d="M56 26 L53 8 L66 18 Z" fill="url(#meraj-fur)" stroke="#C96532" strokeWidth="0.6" />
            <path d="M57 24 L56 14 L63 19 Z" fill="#FFF8EE" opacity="0.85" />
            {/* Right ear */}
            <path d="M94 26 L97 8 L84 18 Z" fill="url(#meraj-fur)" stroke="#C96532" strokeWidth="0.6" />
            <path d="M93 24 L94 14 L87 19 Z" fill="#FFF8EE" opacity="0.85" />
          </motion.g>

          {/* Head shape (rounded fox head) */}
          <ellipse cx="75" cy="32" rx="20" ry="18" fill="url(#meraj-fur)" />

          {/* Muzzle (cream) */}
          <ellipse cx="75" cy="38" rx="11" ry="8" fill="url(#meraj-cream)" />

          {/* GOGGLES (pushed up on forehead, dark frame, blue lens, chevron) */}
          <rect x="58" y="19" width="34" height="7" rx="3.5" fill="#1A1D2E" stroke="#0E1018" strokeWidth="0.6" />
          <ellipse cx="66" cy="22.5" rx="5.5" ry="2.8" fill="url(#meraj-goggle)" opacity="0.8" />
          <ellipse cx="84" cy="22.5" rx="5.5" ry="2.8" fill="url(#meraj-goggle)" opacity="0.8" />
          {/* Goggle strap chevron */}
          <path d="M72 22 L75 19.5 L78 22" stroke="#2FD6FF" strokeWidth="1" fill="none" filter="url(#meraj-glow)" strokeLinecap="round" />

          {/* NOSE (small black triangle) */}
          <path d="M73 35 L77 35 L75 37.5 Z" fill="#1A1A1A" />

          {/* EYES (ice-blue, round, catchlight) */}
          <motion.g animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ duration: blinkDur, times: [0, 0.92, 0.96, 1], repeat: Infinity }} style={{ transformOrigin: '75px 31px' }}>
            <circle cx="68" cy="31" r={listening ? 5 : 4.5} fill="url(#meraj-eye)" />
            <circle cx="82" cy="31" r={listening ? 5 : 4.5} fill="url(#meraj-eye)" />
            <motion.g animate={{ y: pupilY }} transition={{ duration: 0.3, ease: 'easeOut' }}>
              <circle cx="68" cy="31.5" r={pupilR} fill="#1A1A1A" />
              <circle cx="82" cy="31.5" r={pupilR} fill="#1A1A1A" />
              <circle cx="69.2" cy="30.2" r="1.2" fill="#FFFFFF" opacity="0.9" />
              <circle cx="83.2" cy="30.2" r="1.2" fill="#FFFFFF" opacity="0.9" />
            </motion.g>
          </motion.g>

          {/* EYEBROWS (subtle, animate when speaking) */}
          <motion.g animate={{ y: speaking ? [0, -1.2, 0] : listening ? -0.8 : 0 }} transition={{ duration: 0.35, repeat: speaking ? Infinity : 0, ease: 'easeInOut' }}>
            <rect x="65" y="25.5" width="6" height="1.4" rx="0.7" fill="#C96532" opacity="0.6" transform="rotate(-8 68 26)" />
            <rect x="79" y="25.5" width="6" height="1.4" rx="0.7" fill="#C96532" opacity="0.6" transform="rotate(8 82 26)" />
          </motion.g>

          {/* MOUTH — smile (idle) or animated talking (speaking) */}
          {speaking ? (
            <motion.ellipse cx="75" cy="40" rx="3.5" fill="#1A1A1A"
              animate={{ ry: [0.6, 2.5, 1, 2, 0.6] }} transition={{ duration: 0.3, repeat: Infinity, ease: 'easeInOut' }} />
          ) : (
            <path d={listening ? 'M71 39 Q75 42 79 39' : 'M72 39.5 Q75 42 78 39.5'} stroke="#8B5A2B" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          )}

          {/* Cheek blush */}
          <circle cx="65" cy="37" r="2.5" fill="#E8793F" opacity="0.25" />
          <circle cx="85" cy="37" r="2.5" fill="#E8793F" opacity="0.25" />
        </motion.g>
      </motion.g>
    </motion.svg>
  )
}

export default MerajCharacter
