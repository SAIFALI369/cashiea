import { ReactNode } from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  type?: string
}

export default function Input(props: InputProps) {
  const { type = 'text', className, ...rest } = props
  return <input type={type} className={`appearance-none rounded-md border border-line bg-paper text-fg placeholder:text-fg-subtle shadow-sm focus:border-accent focus:bg-white focus:text-fg transition-colors w-full py-2.5`} {...rest} />
}