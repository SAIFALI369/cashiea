import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * useKeyboardShortcuts — global keyboard shortcuts for power users.
 *
 * Ctrl+K → Command palette (search + navigate)
 * Ctrl+N → New invoice / POS
 * Esc   → Close modals (handled per-component)
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K → Command palette / search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        // Trigger the search/command palette
        window.dispatchEvent(new CustomEvent('cashiea:command-palette'))
      }

      // Ctrl+N → New sale (POS)
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        navigate('/app/pos')
      }

      // Ctrl+B → New bill (invoice)
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        navigate('/app/invoices')
      }

      // Ctrl+M → Talk to Meraj
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault()
        navigate('/app/assistant')
      }

      // Ctrl+D → Dashboard
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        navigate('/app')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
