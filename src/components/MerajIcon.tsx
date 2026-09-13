import clsx from 'clsx'

/**
 * MerajIcon — "Meraj Premium": a Tier-1 smart-display mark, pure SVG.
 *
 * Full variant (nav / hero, 24px → 120px):
 *   · squircle casing — soft-touch matte gradient mint #A7F3D0 → deep emerald #047857
 *     with a top-edge light kiss
 *   · dark obsidian screen (#111827) at ~80% of the face, glossy diagonal reflection
 *   · the face is LIGHT, not ink: two glowing crescent eyes + a smooth glowing
 *     smile (soft white-cyan, LED bloom)
 *   · emerald aura behind + diffused shadow beneath → the 3D float
 *
 * Face variant (favicon / logo / chat badges): just the powered screen.
 * Pulse: a gentle opacity keyframe on the face group — it feels alive.
 */
export default function MerajIcon({
  size = 24,
  variant = 'full',
  pulse = false,
  className,
}: {
  size?: number
  variant?: 'full' | 'face'
  pulse?: boolean
  className?: string
}) {
  const id = `mi${size}${variant}` // stable ids per instance size
  const face = (f: string) => (
    <g filter={`url(#${id}-glow)`} className={pulse ? 'meraj-icon-pulse' : undefined}>
      {/* eyes: two glowing crescents ^ ^ */}
      <path d="M 30 52 q 8 -10 16 0" fill="none" stroke={f} strokeWidth="6" strokeLinecap="round" />
      <path d="M 74 52 q 8 -10 16 0" fill="none" stroke={f} strokeWidth="6" strokeLinecap="round" />
      {/* smile: a smooth glowing curve */}
      <path d="M 44 70 q 16 12 32 0" fill="none" stroke={f} strokeWidth="6" strokeLinecap="round" />
    </g>
  )

  if (variant === 'face') {
    return (
      <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-screen`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1F2937" />
            <stop offset="1" stopColor="#111827" />
          </linearGradient>
          <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x="6" y="6" width="108" height="108" rx="30" fill={`url(#${id}-screen)`} />
        <polygon points="6,36 42,6 66,6 6,66" fill="#ffffff" opacity="0.10" />
        {face('#E6FFFB')}
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={clsx('meraj-icon-float', className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-case`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#A7F3D0" />
          <stop offset="0.45" stopColor="#34D399" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id={`${id}-screen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1F2937" />
          <stop offset="1" stopColor="#111827" />
        </linearGradient>
        <radialGradient id={`${id}-aura`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor="#10B981" stopOpacity="0.34" />
          <stop offset="1" stopColor="#10B981" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* aura — powered on */}
      <circle cx="60" cy="60" r="58" fill={`url(#${id}-aura)`} />
      {/* float shadow */}
      <ellipse cx="60" cy="112" rx="30" ry="5" fill="#111827" opacity="0.18" filter={`url(#${id}-soft)`} />

      {/* squircle casing — soft-touch matte with a top-edge highlight */}
      <rect x="10" y="8" width="100" height="100" rx="28" fill={`url(#${id}-case)`} />
      <rect x="10" y="8" width="100" height="100" rx="28" fill="none" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="1.4" />
      <ellipse cx="60" cy="16.5" rx="40" ry="5.5" fill="#FFFFFF" opacity="0.22" />

      {/* obsidian screen — 80% of the face */}
      <rect x="19" y="18" width="82" height="80" rx="20" fill={`url(#${id}-screen)`} />
      {/* glossy diagonal reflection */}
      <clipPath id={`${id}-clip`}>
        <rect x="19" y="18" width="82" height="80" rx="20" />
      </clipPath>
      <g clipPath={`url(#${id}-clip)`}>
        <polygon points="19,52 55,18 80,18 19,79" fill="#FFFFFF" opacity="0.12" />
        <polygon points="30,98 101,27 101,60 62,98" fill="#FFFFFF" opacity="0.04" />
      </g>

      {/* the living interface */}
      {face('#E6FFFB')}
    </svg>
  )
}
