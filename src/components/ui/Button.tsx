import { ReactNode } from 'react'

export interface ButtonProps {
  className?: string
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  children: ReactNode
  type?: 'button' | 'submit'
}

export default function Button({ variant = 'primary', size = 'md', disabled = false, children, className, type = 'button', ...rest }: ButtonProps) {
  const variantClasses = {
    primary: 'bg-accent text-accent-fg hover:bg-accent/90',
    secondary: 'bg-surface-2 text-fg-muted hover:bg-surface-3',
    outline: 'bg-transparent border border-accent text-accent hover:bg-accent/10'
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  return (
    <button
      type={type}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className || ''}
      `}
      {...rest}
    >
      {children}
    </button>
  )
}