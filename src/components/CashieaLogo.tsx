/** Official Cashiea brand mark, shared by every app and public surface. */
export function CashieaLogo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.svg"
      width={size}
      height={size}
      className={className}
      alt="Cashiea"
      draggable={false}
    />
  )
}

export default CashieaLogo
