/**
 * MerajMark — the fox-face brand mark for Cashiea's AI assistant.
 * A minimal fox silhouette with a cyan chevron spark (intelligence + momentum).
 * Uses currentColor so it adopts the surrounding accent in any theme.
 */
export function MerajMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="Meraj"
    >
      {/* Fox head silhouette */}
      <path
        d="M16 3 L10 8 L6 6 L7 13 Q4 18 8 24 Q12 29 16 29 Q20 29 24 24 Q28 18 25 13 L26 6 L22 8 Z"
        fill="currentColor"
        fillOpacity="0.9"
      />
      {/* Inner ears (lighter) */}
      <path d="M10 8 L7 6 L8 12 Z M22 8 L25 6 L24 12 Z" fill="currentColor" fillOpacity="0.4" />
      {/* Cyan chevron spark */}
      <path
        d="M13 17 L16 13 L19 17"
        stroke="#2FD6FF"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Catchlight dot */}
      <circle cx="16" cy="13" r="1.2" fill="#2FD6FF" />
    </svg>
  )
}

export default MerajMark
