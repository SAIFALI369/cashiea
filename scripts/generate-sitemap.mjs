// ────────────────────────────────────────────────────────────────
// generate-sitemap — regenerates public/sitemap.xml from the real
// public route list (App.tsx statics + help/blog article slugs).
// Run:  node scripts/generate-sitemap.mjs
// Re-run whenever a public route or article is added.
// ────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ORIGIN = 'https://cashiea.vercel.app'
const today = new Date().toISOString().slice(0, 10)

// Static public routes (kept in sync with src/App.tsx public routes).
const STATIC_ROUTES = [
  '/', '/pricing', '/features', '/about', '/contact', '/security',
  '/help', '/blog', '/privacy', '/terms', '/case-study', '/login', '/signup',
]

function slugsFrom(file, key) {
  const src = readFileSync(path.join(root, file), 'utf8')
  const re = new RegExp(`${key}:\\s*'([^']+)'`, 'g')
  const out = []
  for (const m of src.matchAll(re)) out.push(m[1])
  return out
}

const helpSlugs = slugsFrom('src/lib/helpArticles.ts', 'slug')
const blogSlugs = slugsFrom('src/lib/blogPosts.ts', 'slug')

const urls = [
  ...STATIC_ROUTES.map((r) => ({ loc: r, priority: r === '/' ? '1.0' : '0.8' })),
  ...helpSlugs.map((s) => ({ loc: `/help/${s}`, priority: '0.6' })),
  ...blogSlugs.map((s) => ({ loc: `/blog/${s}`, priority: '0.5' })),
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${ORIGIN}${u.loc === '/' ? '/' : u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.loc === '/' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`

writeFileSync(path.join(root, 'public/sitemap.xml'), xml)
console.log(`sitemap.xml written with ${urls.length} URLs (${helpSlugs.length} help, ${blogSlugs.length} blog).`)
