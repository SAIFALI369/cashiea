/** Official Cashiea brand mark, shared by every app and public surface. */
export function CashieaLogo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/cashiea-logo.png"
      width={size}
      height={size}
      className={`block rounded-[18%] object-cover ${className}`}
      alt="Cashiea"
      draggable={false}
    />
  )
}

export default CashieaLogo
