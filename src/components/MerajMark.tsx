/**
 * MerajMark — abstract, minimal brand mark for the AI assistant.
 * A rising growth-arc with a spark at the apex (intelligence + momentum).
 * Uses currentColor so it adopts the surrounding accent in any theme.
 * No mascot/bot imagery.
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
      <circle cx="16" cy="16" r="13.25" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
      <path
        d="M8.5 20.5C10.8 14.4 14.6 11.2 20.8 10.6"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="21.4" cy="10.2" r="2.7" fill="currentColor" />
      <path d="M9 23.5h5.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeOpacity="0.45" />
    </svg>
  )
}

export default MerajMark
