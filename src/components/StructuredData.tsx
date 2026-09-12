import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { schemaForPath } from '../lib/routeSchema'

// ════════════════════════════════════════════════════════════════
// StructuredData — keeps the Schema.org JSON-LD in <head> matched to
// the current route as the SPA navigates.
//
// The prerenderer already bakes the correct graph into each route's
// static HTML (that is what non-JS crawlers read). This component
// owns the same <script id="cashiea-schema"> node afterwards so a
// client-side navigation never leaves stale markup behind, and it
// removes the node entirely on private /app routes.
//
// Renders nothing; never touches app logic.
// ════════════════════════════════════════════════════════════════

const SCRIPT_ID = 'cashiea-schema'

export default function StructuredData() {
  const { pathname } = useLocation()

  useEffect(() => {
    const existing = document.getElementById(SCRIPT_ID)
    const data = schemaForPath(pathname)

    if (!data) {
      existing?.remove()
      return
    }

    const json = JSON.stringify(data)
    if (existing) {
      if (existing.textContent !== json) existing.textContent = json
      return
    }

    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = SCRIPT_ID
    el.textContent = json
    document.head.appendChild(el)
  }, [pathname])

  return null
}
