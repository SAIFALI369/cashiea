import { useEffect, useState } from 'react'

/**
 * useDebounce — delays updating a value until the user stops typing.
 * Prevents re-renders on every keystroke (especially important on low-end phones).
 *
 * Usage:
 *   const [search, setSearch] = useState('')
 *   const debouncedSearch = useDebounce(search, 300)
 *   // use debouncedSearch in the filter/effect, search in the input
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
