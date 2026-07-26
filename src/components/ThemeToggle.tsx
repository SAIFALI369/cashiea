import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

/**
 * Minimal, premium light/dark toggle.
 * Single icon that morphs; calm 200ms transition; accessible.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 border border-transparent hover:border-line transition-all duration-200 ${className}`}
    >
      {isDark ? <Sun className="w-[18px] h-[18px]" strokeWidth={1.75} /> : <Moon className="w-[18px] h-[18px]" strokeWidth={1.75} />}
    </button>
  )
}
