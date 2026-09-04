/** Lightweight loading skeleton — soft, calm shimmer (no spinners).
 *  The sweep highlight comes from .skeleton-bone in index.css. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-bone rounded-xl ${className}`} aria-hidden="true" />
}

export default Skeleton
