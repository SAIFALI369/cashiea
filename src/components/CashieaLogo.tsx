import { useId } from 'react'

/**
 * CashieaLogo — the official Cashiea "C" brand mark (rounded-square gradient
 * tile + C-arc + crosshair). Used in the sidebar/quickbar header and anywhere
 * the brand mark is needed. Replaces the generic Sparkles icon.
 */
export function CashieaLogo({ size = 36, className = '' }: { size?: number; className?: string }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className} role="img" aria-label="Cashiea">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(var(--accent))" />
          <stop offset="100%" stopColor="rgb(var(--accent-strong))" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill={`url(#${id})`} />
      <path d="M62 28 A26 26 0 1 0 62 72" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" />
      <circle cx="55" cy="50" r="5" fill="white" />
      <path d="M55 30L55 42M55 58L55 70M35 50L47 50M63 50L75 50" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}

export default CashieaLogo
