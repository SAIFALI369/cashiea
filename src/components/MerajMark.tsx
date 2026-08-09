/**
 * MerajMark — the fox-head brand mark for Cashiea's AI assistant.
 * A clean fox silhouette (matching Meraj's proportions) with a glowing cyan
 * chevron spark (intelligence + momentum). Uses currentColor so it adopts the
 * surrounding accent in any theme.
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
      {/* Fox head — ears + rounded face, locked to Meraj's proportions */}
      <path
        d="M16 3.5
           L11 9.5 L6.5 7
           Q6.4 11 7.5 14.5
           Q4.5 18.5 6.8 23.2
           Q9.5 28.4 16 28.8
           Q22.5 28.4 25.2 23.2
           Q27.5 18.5 25.5 14.5
           Q26.6 11 25.5 7
           L21 9.5 Z"
        fill="currentColor"
        fillOpacity={0.92}
      />
      {/* Inner ears (lighter) */}
      <path d="M11 9.5 L8 8 L9.2 13.2 Z" fill="currentColor" fillOpacity={0.42} />
      <path d="M21 9.5 L24 8 L22.8 13.2 Z" fill="currentColor" fillOpacity={0.42} />
      {/* Muzzle hint */}
      <path d="M16 21.5 Q12.5 23 12.8 26 Q16 27.6 19.2 26 Q19.5 23 16 21.5 Z" fill="currentColor" fillOpacity={0.3} />
      {/* Cyan chevron spark */}
      <path
        d="M12.4 17.4 L16 13 L19.6 17.4"
        stroke="#2FD6FF"
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* spark dot */}
      <circle cx="16" cy="13" r="1.25" fill="#2FD6FF" />
    </svg>
  )
}

export default MerajMark
