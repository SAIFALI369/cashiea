import { useEffect } from 'react'
import { SITE_URL } from './site'

// ────────────────────────────────────────────────────────────────
// useArticleMeta — per-article metadata for dynamic public routes
// (/help/:slug, /blog/:slug). PageMetaSync deliberately skips these
// paths, so the article page publishes its own richer tags here.
// ────────────────────────────────────────────────────────────────

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = attr === 'name' ? `meta[name="${key}"]` : `meta[property="${key}"]`
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function useArticleMeta(title: string | null, description: string | null, path: string) {
  useEffect(() => {
    if (!title) return
    document.title = title
    if (description) {
      upsertMeta('name', 'description', description)
      upsertMeta('property', 'og:description', description)
      upsertMeta('name', 'twitter:description', description)
    }
    upsertMeta('property', 'og:title', title)
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('property', 'og:url', SITE_URL + path)
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', SITE_URL + path)
  }, [title, description, path])
}
