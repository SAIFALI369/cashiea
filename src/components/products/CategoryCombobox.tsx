import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus, Search } from 'lucide-react'

/**
 * CategoryCombobox — searchable category dropdown for the product
 * form. Filters existing categories as you type, always allows a
 * brand-new category, and commits the normalized value on blur so
 * "Electronics" and "electronics" are the same category.
 */
export function CategoryCombobox({
  value, onChange, categories, placeholder = 'e.g. grocery',
}: {
  value: string
  onChange: (v: string) => void
  categories: string[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...categories].sort((a, b) => a.localeCompare(b))
    if (!q) return sorted.slice(0, 12)
    return sorted.filter((c) => c.toLowerCase().includes(q)).slice(0, 12)
  }, [categories, query])

  const exactExists = categories.some((c) => c.toLowerCase() === query.trim().toLowerCase())

  const pick = (cat: string) => {
    onChange(cat)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div className="relative" ref={rootRef}>
      <div className="relative">
        <input
          ref={inputRef}
          value={open ? query : value}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(value); setOpen(true) }}
          onBlur={() => {
            // Commit what was typed (normalized by the parent on save).
            if (query.trim() && query.trim() !== value) onChange(query.trim())
            setOpen(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const match = suggestions.find((c) => c.toLowerCase() === query.trim().toLowerCase())
              pick(match ?? query.trim())
            } else if (e.key === 'Escape') {
              setOpen(false)
              inputRef.current?.blur()
            }
          }}
          className="input-field pr-9"
          placeholder={placeholder}
          aria-label="Product category"
          role="combobox"
          aria-expanded={open}
        />
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); inputRef.current?.focus() }}
          aria-label="Choose category"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-fg-subtle hover:text-fg"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute z-40 left-0 right-0 top-full mt-1 card p-1.5 shadow-float bg-surface max-h-56 overflow-y-auto scroll-area">
          {suggestions.length === 0 && !query.trim() && (
            <p className="text-xs text-fg-subtle px-3 py-3 flex items-center gap-2">
              <Search className="w-3.5 h-3.5" /> Type to create your first category
            </p>
          )}
          {suggestions.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(c)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-fg hover:bg-surface-2 capitalize flex items-center justify-between"
              role="option"
              aria-selected={c === value}
            >
              <span>{c}</span>
              {c === value && <span className="text-[10px] font-bold text-accent">CURRENT</span>}
            </button>
          ))}
          {query.trim() && !exactExists && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(query.trim())}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-accent hover:bg-accent-soft flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create "{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}
