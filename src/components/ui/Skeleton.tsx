/** Lightweight loading skeleton — soft, calm shimmer (no spinners). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`rounded-md bg-surface-2 animate-pulse ${className}`} aria-hidden="true" />
}

export default Skeleton
