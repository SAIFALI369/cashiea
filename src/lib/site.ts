// ────────────────────────────────────────────────────────────────
// Site-level constants — the canonical origin and per-route metadata.
// Used by PageMetaSync (titles/canonical/OG), robots.txt and the
// sitemap keep their own copies of the public route list.
// ────────────────────────────────────────────────────────────────

/** The live production origin. Until a custom domain is verified, the
 *  Vercel deployment URL is the canonical origin (see README). */
export const SITE_URL = 'https://cashiea.vercel.app'

export const SITE_NAME = 'Cashiea'

export const DEFAULT_TITLE = 'Cashiea — Your Retail Business, Automated'

export const DEFAULT_DESCRIPTION =
  "Cashiea — POS billing, customer tracking & AI automation for India's small shops. Voice invoicing, WhatsApp reports, daily closing summaries. Built for Tier 2/3 cities."

/** Real, monitored support mailbox used across the product (Support page,
 *  Privacy and Terms). Never replace with an address that cannot receive mail. */
export const SUPPORT_EMAIL = 'supportcashiea@gmail.com'

export const OG_IMAGE_PATH = '/og-image.png'

export interface RouteMeta {
  title: string
  description: string
}

/** Static metadata for public routes. Dynamic routes (help/blog articles)
 *  set their own title from the article data after mount. */
export const ROUTE_META: Record<string, RouteMeta> = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  '/pricing': {
    title: 'Pricing — Cashiea',
    description:
      'Premium at ₹8,000/month — that’s ₹267 a day for a manager who never sleeps. Start with the free 14-day trial (50 AI actions), no card required, cancel anytime.',
  },
  '/features': {
    title: 'Features — Cashiea',
    description:
      'Counter POS with split payments, Rule-46 GST invoices, khata, stock alerts, WhatsApp reports and Meraj, your AI shop manager — everything an Indian shop needs.',
  },
  '/about': {
    title: 'About — Cashiea',
    description:
      'Why Cashiea exists: to give every small Indian shop the back office a big store has — billing, stock, customers and a manager who never sleeps.',
  },
  '/contact': {
    title: 'Contact & Support — Cashiea',
    description:
      'Reach the Cashiea team by email or through the in-app support desk. We typically reply within 24 hours, Monday–Friday.',
  },
  '/help': {
    title: 'Help Center — Cashiea',
    description:
      'Guides for billing, GST invoices, stock, khata, WhatsApp reports, Meraj and more — written for the actual Cashiea product.',
  },
  '/blog': {
    title: 'Blog — Cashiea',
    description:
      'Practical notes on GST billing, stock and daily shop management for Indian retailers.',
  },
  '/security': {
    title: 'Security — Cashiea',
    description:
      'How Cashiea protects your business data: encryption in transit, row-level security, India hosting and DPDP-aligned privacy practices.',
  },
  '/privacy': {
    title: 'Privacy Policy — Cashiea',
    description:
      'How Cashiea collects, uses and protects personal data under the DPDP Act 2023.',
  },
  '/terms': {
    title: 'Terms of Use — Cashiea',
    description: 'The terms on which the Cashiea service is provided.',
  },
  '/case-study': {
    title: 'Case Study — Cashiea',
    description: 'How a shop moved from paper receipts to Cashiea.',
  },
  '/login': {
    title: 'Login — Cashiea',
    description: 'Sign in to your Cashiea dashboard.',
  },
  '/signup': {
    title: 'Start your 14-day free trial — Cashiea',
    description:
      'Create your Cashiea account — POS billing, khata, stock and Meraj AI. No card required.',
  },
}

/** Metadata fallback for authenticated /app routes. */
export const APP_META: RouteMeta = {
  title: 'Cashiea',
  description: DEFAULT_DESCRIPTION,
}

export function metaForPath(pathname: string): RouteMeta | null {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname]
  if (pathname.startsWith('/app')) return APP_META
  return null
}
