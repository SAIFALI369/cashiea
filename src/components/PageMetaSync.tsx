import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { metaForPath, SITE_URL, OG_IMAGE_PATH } from '../lib/site'

// ════════════════════════════════════════════════════════════════
// PageMetaSync — keeps document metadata coherent per route in the
// SPA: title, description, canonical and Open Graph / Twitter tags.
// Purely additive; renders nothing and never touches app logic.
//
// Dynamic article routes (/help/:slug, /blog/:slug) publish their own
// richer tags via useArticleMeta and are skipped here.
// ════════════════════════════════════════════════════════════════

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

export default function PageMetaSync() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Article pages own their metadata.
    if (pathname.startsWith('/help/') || pathname.startsWith('/blog/')) return

    const meta = metaForPath(pathname)
    if (!meta) {
      document.title = 'Page not found — Cashiea'
      return
    }

    const canonical = pathname.startsWith('/app') ? null : `${SITE_URL}${pathname === '/' ? '/' : pathname}`

    document.title = meta.title
    upsertMeta('name', 'description', meta.description)
    upsertMeta('property', 'og:title', meta.title)
    upsertMeta('property', 'og:description', meta.description)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:image', `${SITE_URL}${OG_IMAGE_PATH}`)
    upsertMeta('name', 'twitter:title', meta.title)
    upsertMeta('name', 'twitter:description', meta.description)
    if (canonical) {
      upsertCanonical(canonical)
      upsertMeta('property', 'og:url', canonical)
    }

    // SPA pageview for cookieless analytics (no-op unless configured).
    try {
      window.plausible?.('pageview', { u: `${location.origin}${pathname}` })
    } catch {
      /* analytics must never throw */
    }
  }, [pathname])

  return null
}
