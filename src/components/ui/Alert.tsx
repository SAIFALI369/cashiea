import { ReactNode } from 'react'

export interface AlertProps {
  className?: string
  children: ReactNode
}

export default function Alert({ className, children, ...rest }: AlertProps) {
  return (
    <div
      className={`
        rounded-sm bg-red-50 p-3 text-sm text-red-800
        flex items-start gap-2
        ${className || ''}
      `}
      {...rest}
    >
      {children}
    </div>
  )
}