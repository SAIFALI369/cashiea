import { ReactNode } from 'react'

export interface LoaderProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  children?: ReactNode
}

export default function Loader({ size = 'md', className, children, ...rest }: LoaderProps) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' }
  return (
    <svg
      className={`${sizeMap[size]} animate-spin text-current`}
      viewBox="0 0 24 24"
      {...rest}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v.91m4 5.3a2 2 0 012.6 0m-4-2.3a2 2 0 012.6 0M16 12a8 8 0 01-8 8v.91m-4 5.3a2 2 0 01-2.6 0m4-5.3a2 2 0 012.6 0"
      />
    </svg>
  )
}