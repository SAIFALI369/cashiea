import { ReactNode } from 'react'

export interface SelectContentProps {
  className?: string
  children: ReactNode
}

export default function SelectContent({ className, children, ...rest }: SelectContentProps) {
  return (
    <div
      className={`absolute z-10 rounded-md border border-line bg-paper shadow-lg py-1 w-64 max-h-96 overflow-auto text-sm outline-none ${className || ''}`}
      {...rest}
    >
      {children}
    </div>
  )
}