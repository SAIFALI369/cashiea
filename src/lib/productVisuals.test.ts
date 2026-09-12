import { describe, it, expect } from 'vitest'
import { productVisual, prettyCategory, productImageUrl } from './productVisuals'

describe('productVisual', () => {
  it('gives different categories different colours', () => {
    const grocery = productVisual({ name: 'Aashirvaad Atta', category: 'grocery' })
    const drinks = productVisual({ name: 'Coca Cola', category: 'drinks' })
    expect(grocery.tile).not.toBe(drinks.tile)
  })

  it('gives the same product the same visual every time', () => {
    const a = productVisual({ name: 'Mystery Widget', category: 'zzz' })
    const b = productVisual({ name: 'Mystery Widget', category: 'zzz' })
    expect(a.tile).toBe(b.tile)
    expect(a.icon).toBe(b.icon)
  })

  it('matches on the product name when the category is unhelpful', () => {
    const v = productVisual({ name: 'Fresh Milk 1L', category: '' })
    const fallback = productVisual({ name: 'Qqzz', category: '' })
    expect(v.icon).not.toBe(fallback.icon)
  })

  it('always returns a usable visual, even for empty input', () => {
    const v = productVisual({ name: '', category: '' })
    expect(v.icon).toBeTruthy()
    expect(v.tile).toMatch(/^bg-/)
    expect(v.fg).toMatch(/^text-/)
  })

  it('handles null fields without throwing', () => {
    expect(() => productVisual({ name: null, category: null })).not.toThrow()
  })

  it('spreads unknown products across the palette rather than using one hue', () => {
    const names = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']
    const tiles = new Set(names.map((n) => productVisual({ name: n, category: 'zzunknown' }).tile))
    expect(tiles.size).toBeGreaterThan(1)
  })
})

describe('prettyCategory', () => {
  it('fixes the keyboard-mash category from the report', () => {
    expect(prettyCategory('fffgeneral')).toBe('General')
  })

  it('title-cases ordinary categories', () => {
    expect(prettyCategory('grocery')).toBe('Grocery')
    expect(prettyCategory('  drinks ')).toBe('Drinks')
  })

  it('keeps "All" as the tab label', () => {
    expect(prettyCategory('all')).toBe('All')
  })

  it('falls back to General for an empty value', () => {
    expect(prettyCategory('')).toBe('General')
    expect(prettyCategory('   ')).toBe('General')
  })

  it('does not mangle legitimate repeated letters', () => {
    // "aaa" style prefixes only get stripped when a real word follows;
    // short or genuine names must survive intact.
    expect(prettyCategory('aaa')).toBe('Aaa')
    expect(prettyCategory('books')).toBe('Books')
  })

  it('collapses internal whitespace', () => {
    expect(prettyCategory('home   care')).toBe('Home care')
  })
})

describe('productImageUrl', () => {
  it('returns null for rows with no image (today\'s schema)', () => {
    expect(productImageUrl({ name: 'Atta', category: 'grocery' })).toBeNull()
  })
  it('picks up a URL if a future migration adds one', () => {
    expect(productImageUrl({ image_url: 'https://cdn.example/a.jpg' })).toBe('https://cdn.example/a.jpg')
  })
  it('rejects non-http values', () => {
    expect(productImageUrl({ image_url: 'javascript:alert(1)' })).toBeNull()
    expect(productImageUrl({ image_url: 42 })).toBeNull()
  })
  it('survives null input', () => {
    expect(productImageUrl(null)).toBeNull()
  })
})
