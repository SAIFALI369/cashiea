// ────────────────────────────────────────────────────────────────
// routeSchema — builds the JSON-LD @graph for any public route.
//
// Shared by the build-time prerenderer (scripts/prerender.mjs, via
// esbuild) and the runtime <StructuredData /> component, so the
// markup a crawler reads in the static HTML is byte-identical to
// what the SPA maintains after hydration.
// ────────────────────────────────────────────────────────────────

import { SITE_URL, metaForPath, DEFAULT_TITLE, DEFAULT_DESCRIPTION } from './site'
import { LANDING_FAQS, PRICING_FAQS } from './faqs'
import { HELP_ARTICLES } from './helpArticles'
import { BLOG_POSTS } from './blogPosts'
import {
  graph,
  organizationSchema,
  webSiteSchema,
  softwareApplicationSchema,
  webPageSchema,
  faqSchema,
  articleSchema,
  breadcrumbSchema,
  type Crumb,
} from './structuredData'

const HOME: Crumb = { name: 'Home', path: '/' }

/** Human-readable breadcrumb label for the static public routes. */
const CRUMB_LABEL: Record<string, string> = {
  '/pricing': 'Pricing',
  '/features': 'Features',
  '/about': 'About',
  '/contact': 'Contact',
  '/security': 'Security',
  '/help': 'Help Center',
  '/blog': 'Blog',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Use',
  '/case-study': 'Case Study',
  '/login': 'Login',
  '/signup': 'Sign up',
}

/** Pages that are collections rather than plain content pages. */
const PAGE_TYPE: Record<string, string> = {
  '/help': 'CollectionPage',
  '/blog': 'CollectionPage',
  '/contact': 'ContactPage',
  '/about': 'AboutPage',
  '/pricing': 'WebPage',
}

export function schemaForPath(pathname: string): object | null {
  // ── Help article ──────────────────────────────────────────────
  if (pathname.startsWith('/help/')) {
    const slug = pathname.slice('/help/'.length)
    const article = HELP_ARTICLES.find((a) => a.slug === slug)
    if (!article) return null
    return graph([
      organizationSchema(),
      webSiteSchema(),
      webPageSchema({
        path: pathname,
        title: `${article.title} — Cashiea Help`,
        description: article.summary,
        crumbs: [HOME, { name: 'Help Center', path: '/help' }, { name: article.title, path: pathname }],
      }),
      articleSchema({
        path: pathname,
        headline: article.title,
        description: article.summary,
        section: article.category,
        type: 'TechArticle',
      }),
    ])
  }

  // ── Blog post ─────────────────────────────────────────────────
  if (pathname.startsWith('/blog/')) {
    const slug = pathname.slice('/blog/'.length)
    const post = BLOG_POSTS.find((p) => p.slug === slug)
    if (!post) return null
    return graph([
      organizationSchema(),
      webSiteSchema(),
      webPageSchema({
        path: pathname,
        title: `${post.title} — Cashiea Blog`,
        description: post.summary,
        crumbs: [HOME, { name: 'Blog', path: '/blog' }, { name: post.title, path: pathname }],
      }),
      articleSchema({
        path: pathname,
        headline: post.title,
        description: post.summary,
        datePublished: post.date,
        section: post.tag,
        type: 'BlogPosting',
      }),
    ])
  }

  // Authenticated app routes are noindex — no structured data.
  if (pathname.startsWith('/app')) return null

  const meta = metaForPath(pathname)
  if (!meta) return null

  // ── Home ──────────────────────────────────────────────────────
  if (pathname === '/') {
    return graph([
      organizationSchema(),
      webSiteSchema(),
      softwareApplicationSchema(),
      webPageSchema({ path: '/', title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION }),
      faqSchema(LANDING_FAQS, `${SITE_URL}/`),
    ])
  }

  const crumbs: Crumb[] = [HOME]
  if (CRUMB_LABEL[pathname]) crumbs.push({ name: CRUMB_LABEL[pathname], path: pathname })

  const nodes: unknown[] = [
    organizationSchema(),
    webSiteSchema(),
    webPageSchema({
      path: pathname,
      title: meta.title,
      description: meta.description,
      type: PAGE_TYPE[pathname],
      crumbs,
    }),
    breadcrumbSchema(crumbs),
  ]

  // Product-describing pages carry the SoftwareApplication node too.
  if (pathname === '/pricing' || pathname === '/features') nodes.push(softwareApplicationSchema())
  if (pathname === '/pricing') nodes.push(faqSchema(PRICING_FAQS, `${SITE_URL}/pricing`))

  // Collection pages list their members so crawlers discover every article.
  if (pathname === '/help') {
    nodes.push({
      '@type': 'ItemList',
      name: 'Cashiea Help Center articles',
      itemListElement: HELP_ARTICLES.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: a.title,
        url: `${SITE_URL}/help/${a.slug}`,
      })),
    })
  }
  if (pathname === '/blog') {
    nodes.push({
      '@type': 'Blog',
      '@id': `${SITE_URL}/blog#blog`,
      name: 'Cashiea Blog',
      description: 'Practical notes on GST billing, stock and daily shop management for Indian retailers.',
      url: `${SITE_URL}/blog`,
      publisher: { '@id': `${SITE_URL}/#organization` },
      blogPost: BLOG_POSTS.map((p) => ({
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.summary,
        datePublished: p.date,
        url: `${SITE_URL}/blog/${p.slug}`,
      })),
    })
  }

  return graph(nodes)
}
