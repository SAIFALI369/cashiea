import { ReactNode } from 'react'

export interface SelectItemProps {
  className?: string
  children: ReactNode
  disabled?: boolean
  value?: string
  onSelect?: (value: string) => void
}

export default function SelectItem({
  className,
  children,
  disabled = false,
  value,
  onSelect,
  ...rest
}: SelectItemProps) {
  return (
    <div
      className={`
        rounded px-2 py-1.5 cursor-pointer select-none transition-colors
        ${disabled ? 'cursor-not-available select-none opacity-50' : ''}
        ${className || ''}
      `}
      onClick={() => onSelect?.(String(value))}
      style={{ userSelect: 'text' }}
    >
      {children}
    </div>
  )
}