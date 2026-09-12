// ────────────────────────────────────────────────────────────────
// prerender — turns the SPA build into per-route static HTML.
//
// Why: Cashiea is a client-rendered React app. Googlebot can run JS,
// but AI crawlers (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot,
// Google-Extended), social unfurlers and most classic bots read the
// raw HTML response only. Before this step every public URL returned
// the same empty `<div id="root">` with one generic title — nothing
// to index, nothing to quote.
//
// What it does, for every public route:
//   • writes a real <title>, description, canonical, OG/Twitter tags
//   • bakes the route's Schema.org JSON-LD graph into <head>
//   • renders a static, human-readable HTML snapshot of the page's
//     content into #root — headings, paragraphs, feature lists, FAQ
//     answers, full help/blog article text
//
// React replaces that snapshot on hydration, so users see exactly
// the app they saw before; only bots keep the static copy.
//
// Run: node scripts/prerender.mjs   (wired into `npm run build`)
// ────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'esbuild'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dist = path.join(root, 'dist')

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('prerender: dist/index.html not found — run `vite build` first.')
  process.exit(1)
}

// ── Load the TS content modules by bundling them to a temp ESM file ──
const tmp = path.join(root, 'node_modules', '.cache', 'prerender-data.mjs')
mkdirSync(path.dirname(tmp), { recursive: true })
await build({
  entryPoints: [path.join(root, 'scripts/prerender-entry.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: tmp,
  logLevel: 'silent',
})
const data = await import(path.toNamespacedPath(tmp) + `?t=${Date.now()}`)

const {
  SITE_URL,
  SITE_NAME,
  DEFAULT_DESCRIPTION,
  ROUTE_META,
  OG_IMAGE_PATH,
  SUPPORT_EMAIL,
  HELP_ARTICLES,
  HELP_CATEGORIES,
  BLOG_POSTS,
  LANDING_FAQS,
  PRICING_FAQS,
  FEATURE_LIST,
  PLANS,
  schemaForPath,
} = data

// ── tiny HTML helpers ────────────────────────────────────────────
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Minimal markdown → HTML for article bodies (headings, lists,
 *  bold/italic, links, paragraphs). Content is ours, but everything
 *  is escaped first so the output can never inject markup. */
function mdToHtml(md) {
  const blocks = String(md).trim().split(/\n{2,}/)
  const out = []
  for (const raw of blocks) {
    const block = raw.trim()
    if (!block) continue
    const inline = (t) =>
      esc(t)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => `<a href="${esc(href)}">${label}</a>`)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')

    const heading = block.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = Math.min(heading[1].length + 1, 6)
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }
    if (/^([-*])\s+/m.test(block) && block.split('\n').every((l) => /^([-*])\s+/.test(l.trim()))) {
      out.push(`<ul>${block.split('\n').map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`)
      continue
    }
    if (/^\d+\.\s+/.test(block) && block.split('\n').every((l) => /^\d+\.\s+/.test(l.trim()))) {
      out.push(`<ol>${block.split('\n').map((l) => `<li>${inline(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('')}</ol>`)
      continue
    }
    if (block.startsWith('|')) {
      // Tables are rare in our content; flatten to paragraphs.
      out.push(`<p>${inline(block.replace(/\|/g, ' '))}</p>`)
      continue
    }
    out.push(`<p>${inline(block.replace(/\n/g, ' '))}</p>`)
  }
  return out.join('\n')
}

const faqHtml = (faqs) =>
  `<section><h2>Frequently asked questions</h2><dl>${faqs
    .map((f) => `<dt><strong>${esc(f.q)}</strong></dt><dd>${esc(f.a)}</dd>`)
    .join('')}</dl></section>`

const listHtml = (items) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`

const linkList = (links) =>
  `<ul>${links.map((l) => `<li><a href="${esc(l.href)}">${esc(l.text)}</a></li>`).join('')}</ul>`

/** Nav + footer links repeated on every prerendered page so crawlers
 *  can walk the whole public site from any entry point. */
const SITE_NAV = linkList([
  { href: '/', text: 'Home' },
  { href: '/features', text: 'Features' },
  { href: '/pricing', text: 'Pricing' },
  { href: '/about', text: 'About Cashiea' },
  { href: '/help', text: 'Help Center' },
  { href: '/blog', text: 'Blog' },
  { href: '/security', text: 'Security' },
  { href: '/contact', text: 'Contact' },
  { href: '/case-study', text: 'Case study' },
  { href: '/signup', text: 'Start free 14-day trial' },
  { href: '/login', text: 'Login' },
  { href: '/privacy', text: 'Privacy Policy' },
  { href: '/terms', text: 'Terms of Use' },
])

const PLAN_SUMMARY = `<section><h2>Pricing</h2><ul>${Object.values(PLANS)
  .map(
    (p) =>
      `<li><strong>${esc(p.name)}</strong> — ${p.price === 0 ? '₹0' : '₹' + p.price.toLocaleString('en-IN')}${
        p.price === 0 ? ' (14-day free trial, no card required)' : ' per month'
      }: ${esc(p.features.join(', '))}.</li>`,
  )
  .join('')}</ul></section>`

// ── Per-route static body content ────────────────────────────────
function bodyFor(pathname) {
  const meta = ROUTE_META[pathname]

  if (pathname === '/') {
    return `
<h1>Cashiea — your retail business, automated</h1>
<p>${esc(DEFAULT_DESCRIPTION)}</p>
<p>Cashiea is an AI-powered point-of-sale, GST billing and shop-management app built for small and medium retail businesses in India — kirana and general stores, hardware, medical and pharmacy, garments, electronics and other counter-based shops. It bills at the counter, remembers every rupee of udhaar, watches your stock, and sends a WhatsApp summary of the day. Meraj, the built-in AI shop manager, works by chat or voice in 10 Indian languages.</p>
<section><h2>What Cashiea does</h2>${listHtml(FEATURE_LIST)}</section>
${PLAN_SUMMARY}
<section><h2>Who Cashiea is for</h2><p>Shop owners in Tier 2 and Tier 3 Indian cities who want billing on a phone or an inexpensive laptop, in their own language, with GST-compliant invoices and a real record of credit — without hiring an accountant.</p></section>
${faqHtml(LANDING_FAQS)}
<section><h2>Explore Cashiea</h2>${SITE_NAV}</section>`
  }

  if (pathname === '/features') {
    return `
<h1>Cashiea features</h1>
<p>${esc(meta.description)}</p>
<section><h2>Everything included</h2>${listHtml(FEATURE_LIST)}</section>
<section><h2>Meraj, your AI shop manager</h2><p>Meraj drafts your daily report, chases pending payments, watches stock levels, flags unusual numbers and prepares reconciliations — and always asks before anything is sent. Talk to it by voice or text in Hindi/Hinglish, English, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam or Punjabi.</p></section>
${PLAN_SUMMARY}
<section>${SITE_NAV}</section>`
  }

  if (pathname === '/pricing') {
    return `
<h1>Cashiea pricing</h1>
<p>${esc(meta.description)}</p>
${PLAN_SUMMARY}
<p>No setup fee, no lock-in contract, cancel from your dashboard at any time. GST as applicable.</p>
${faqHtml(PRICING_FAQS)}
<section>${SITE_NAV}</section>`
  }

  if (pathname === '/help') {
    const byCat = HELP_CATEGORIES.map((cat) => {
      const items = HELP_ARTICLES.filter((a) => a.category === cat)
      if (!items.length) return ''
      return `<section><h2>${esc(cat)}</h2>${linkList(
        items.map((a) => ({ href: `/help/${a.slug}`, text: a.title })),
      )}</section>`
    }).join('')
    return `
<h1>Cashiea Help Center</h1>
<p>${esc(meta.description)}</p>
${byCat}
<section>${SITE_NAV}</section>`
  }

  if (pathname === '/blog') {
    return `
<h1>Cashiea Blog</h1>
<p>${esc(meta.description)}</p>
${BLOG_POSTS.map(
  (p) =>
    `<article><h2><a href="/blog/${esc(p.slug)}">${esc(p.title)}</a></h2><p><time datetime="${esc(
      p.date,
    )}">${esc(p.date)}</time> · ${esc(p.tag)} · ${p.readMinutes} min read</p><p>${esc(p.summary)}</p></article>`,
).join('')}
<section>${SITE_NAV}</section>`
  }

  if (pathname === '/about') {
    return `
<h1>About Cashiea</h1>
<p>${esc(meta.description)}</p>
<p>Cashiea exists to give every small Indian shop the back office a large store takes for granted: billing that is fast and GST-correct, stock that is counted, customers that are remembered, dues that are followed up, and a manager who never sleeps. It is built for the way shops in Tier 2 and Tier 3 cities actually work — on a phone, in mixed languages, often with the internet down.</p>
<section><h2>Contact</h2><p>Email <a href="mailto:${esc(SUPPORT_EMAIL)}">${esc(SUPPORT_EMAIL)}</a>.</p></section>
<section>${SITE_NAV}</section>`
  }

  if (pathname === '/contact') {
    return `
<h1>Contact Cashiea</h1>
<p>${esc(meta.description)}</p>
<p>Email: <a href="mailto:${esc(SUPPORT_EMAIL)}">${esc(SUPPORT_EMAIL)}</a>. Existing customers can also reach us from the in-app support desk. We typically reply within 24 hours, Monday to Friday.</p>
<section>${SITE_NAV}</section>`
  }

  if (pathname === '/security') {
    return `
<h1>Security at Cashiea</h1>
<p>${esc(meta.description)}</p>
<ul>
<li>All traffic is encrypted in transit over HTTPS.</li>
<li>Business data is hosted in India.</li>
<li>Row-level security isolates every shop's records — one business can never read another's.</li>
<li>Privacy practices are aligned with India's DPDP Act 2023. We never sell your data.</li>
<li>Staff accounts have roles and permissions, and sensitive actions are recorded in activity logs.</li>
</ul>
<section>${SITE_NAV}</section>`
  }

  if (pathname === '/login') {
    return `
<h1>Log in to Cashiea</h1>
<p>Sign in to your Cashiea dashboard to bill at the counter, check khata dues, review stock and read today's report. Don't have an account yet? <a href="/signup">Start a free 14-day trial</a> — no card required.</p>
<p>Cashiea is an AI-powered POS, GST billing and shop-management app for small Indian businesses. <a href="/">Learn what Cashiea does</a> or read the <a href="/help">Help Center</a>.</p>
<section>${SITE_NAV}</section>`
  }

  if (pathname === '/signup') {
    return `
<h1>Start your free 14-day Cashiea trial</h1>
<p>Create your Cashiea account and start billing in about five minutes. The trial includes the full product and 50 AI actions — no card required, cancel anytime. Already have an account? <a href="/login">Log in</a>.</p>
<section><h2>What you get on day one</h2>${listHtml(FEATURE_LIST)}</section>
${PLAN_SUMMARY}
<section>${SITE_NAV}</section>`
  }

  if (pathname === '/case-study') {
    return `
<h1>Case study — from paper receipts to Cashiea</h1>
<p>${esc(meta.description)}</p>
<p>How a counter-based Indian shop moved off a paper register: billing on a phone, udhaar recorded per customer, low-stock alerts before the weekend rush, GST invoices printed at the counter and a WhatsApp summary every evening.</p>
<section>${SITE_NAV}</section>`
  }

  if (pathname === '/privacy' || pathname === '/terms') {
    const title = pathname === '/privacy' ? 'Privacy Policy' : 'Terms of Use'
    return `
<h1>Cashiea ${esc(title)}</h1>
<p>${esc(meta.description)}</p>
<p>The full ${esc(title.toLowerCase())} is rendered in the application. For any question about your data, email <a href="mailto:${esc(
      SUPPORT_EMAIL,
    )}">${esc(SUPPORT_EMAIL)}</a>.</p>
<section>${SITE_NAV}</section>`
  }

  return `<h1>${esc(meta.title)}</h1><p>${esc(meta.description)}</p><section>${SITE_NAV}</section>`
}

function articleBody(kind, a) {
  const crumb =
    kind === 'help'
      ? `<nav><a href="/">Home</a> › <a href="/help">Help Center</a> › ${esc(a.title)}</nav>`
      : `<nav><a href="/">Home</a> › <a href="/blog">Blog</a> › ${esc(a.title)}</nav>`
  const byline =
    kind === 'blog'
      ? `<p><time datetime="${esc(a.date)}">${esc(a.date)}</time> · ${esc(a.tag)} · ${a.readMinutes} min read</p>`
      : `<p>Category: ${esc(a.category)}</p>`
  return `
${crumb}
<article>
<h1>${esc(a.title)}</h1>
${byline}
<p>${esc(a.summary)}</p>
${mdToHtml(a.body)}
</article>
<section><h2>More from Cashiea</h2>${SITE_NAV}</section>`
}

// ── Route list ───────────────────────────────────────────────────
const routes = [
  ...Object.keys(ROUTE_META).map((p) => ({ path: p, body: bodyFor(p), meta: ROUTE_META[p] })),
  ...HELP_ARTICLES.map((a) => ({
    path: `/help/${a.slug}`,
    body: articleBody('help', a),
    meta: { title: `${a.title} — Cashiea Help`, description: a.summary },
  })),
  ...BLOG_POSTS.map((p) => ({
    path: `/blog/${p.slug}`,
    body: articleBody('blog', p),
    meta: { title: `${p.title} — Cashiea Blog`, description: p.summary },
  })),
]

// ── Head rewriting ───────────────────────────────────────────────
const template = readFileSync(path.join(dist, 'index.html'), 'utf8')

function headFor({ path: pathname, meta }) {
  const canonical = `${SITE_URL}${pathname === '/' ? '/' : pathname}`
  const schema = schemaForPath(pathname)
  const isAuthPage = pathname === '/login' || pathname === '/signup'
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    // Login/signup are crawlable (they describe the product and carry the
    // brand) but must not compete with the marketing pages in results.
    isAuthPage
      ? `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />`
      : `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`,
    `<meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:type" content="${pathname.startsWith('/blog/') ? 'article' : 'website'}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:image" content="${esc(SITE_URL + OG_IMAGE_PATH)}" />`,
    `<meta property="og:image:alt" content="Cashiea — AI-powered POS, GST billing and shop management for Indian shops" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(SITE_URL + OG_IMAGE_PATH)}" />`,
    schema
      ? `<script type="application/ld+json" id="cashiea-schema">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`
      : '',
    // The static snapshot must not flash before React mounts. It stays in
    // the DOM (crawlers read the markup, not the pixels) but is visually
    // hidden the way a screen-reader-only element is — and made visible
    // again inside <noscript>, so a JS-less visitor still gets the page.
    // Inline <style> is CSP-safe here: style-src allows 'unsafe-inline'.
    `<style>[data-prerender]{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}</style>`,
    `<noscript><style>[data-prerender]{position:static;width:auto;height:auto;margin:0;overflow:visible;clip:auto;white-space:normal}</style></noscript>`,
  ]
    .filter(Boolean)
    .join('\n    ')
}

/** Strip the template's generic head tags so ours are the only ones. */
function cleanHead(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/\s*<meta name="description"[^>]*>/gi, '')
    .replace(/\s*<link rel="canonical"[^>]*>/gi, '')
    .replace(/\s*<meta property="og:[^"]*"[^>]*>/gi, '')
    .replace(/\s*<meta name="twitter:[^"]*"[^>]*>/gi, '')
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '')
}

const ROOT_RE = /<div id="root"><\/div>/

let written = 0
for (const route of routes) {
  let html = cleanHead(template)
  html = html.replace('</head>', `  ${headFor(route)}\n  </head>`)

  // The static snapshot lives inside #root and is replaced the moment
  // React hydrates, so it never affects what a real user sees.
  const snapshot = `<div id="root"><div data-prerender="static" style="max-width:52rem;margin:0 auto;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;color:#1f2937">${route.body}</div></div>`
  if (!ROOT_RE.test(html)) {
    console.error('prerender: could not find <div id="root"></div> in the build output.')
    process.exit(1)
  }
  html = html.replace(ROOT_RE, snapshot)

  // Output path: /pricing → dist/pricing.html (Vercel `cleanUrls`),
  // nested routes keep their folder. Home stays dist/index.html.
  const out =
    route.path === '/' ? path.join(dist, 'index.html') : path.join(dist, `${route.path.slice(1)}.html`)
  mkdirSync(path.dirname(out), { recursive: true })
  writeFileSync(out, html)
  written++
}

rmSync(tmp, { force: true })
console.log(`prerender: wrote ${written} static HTML pages (${HELP_ARTICLES.length} help, ${BLOG_POSTS.length} blog).`)
