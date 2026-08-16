/**
 * Indian-format currency — ₹ prefix + Indian digit grouping.
 * formatINR(4941674, 0) → "₹49,41,674"
 * formatINR(2553)      → "₹2,553.00"
 */
export function formatINR(amount: number | null | undefined, decimals = 2): string {
  const n = Number(amount) || 0
  return (
    '₹' +
    n.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  )
}
