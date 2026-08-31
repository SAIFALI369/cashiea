import { ReactNode } from 'react'

export default function Card({ className, children, ...rest }: { className?: string; children: ReactNode; [key: string]: any }) {
  return (
    <div className={`rounded-lg border p-6 bg-white shadow-sm ${className || ''}`} {...rest}>
      {children}
    </div>
  )
}