import { ReactNode } from 'react'

export interface SelectProps extends React.HTMLAttributes<HTMLSelectElement> {
  className?: string
}

export default function Select({ className, children, ...rest }: SelectProps) {
  return (
    <select
      className={`
        appearance-none rounded-md border border-line bg-paper text-fg placeholder:text-fg-subtle shadow-sm focus:border-accent focus:bg-white focus:text-fg transition-colors py-2.5 pr-8`
        || className
      }
      {...rest}
    >
      {children}
    </select>
  )
}