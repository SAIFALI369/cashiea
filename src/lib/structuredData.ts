// ────────────────────────────────────────────────────────────────
// structuredData — Schema.org / JSON-LD graph builders.
//
// One source of truth for the machine-readable description of
// Cashiea used by Google (rich results, AI Overviews), Bing/Copilot
// and LLM answer engines. Consumed twice:
//
//   1. scripts/prerender.mjs  → baked into the static HTML <head>
//      of every public route, so crawlers that never run JavaScript
//      still see it.
//   2. src/components/StructuredData.tsx → kept in sync client-side
//      as the SPA navigates between routes.
//
// Everything asserted here must be true of the shipped product. No
// invented ratings, awards, counts or certifications — fabricated
// review markup is a manual-action risk and poisons AI answers.
// ────────────────────────────────────────────────────────────────

import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION, SUPPORT_EMAIL, OG_IMAGE_PATH } from './site'

export const ORGANIZATION_ID = `${SITE_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`
export const SOFTWARE_ID = `${SITE_URL}/#software`

const LOGO_URL = `${SITE_URL}/icon-512.png`
const OG_URL = `${SITE_URL}${OG_IMAGE_PATH}`

/** The publisher behind the product. */
export function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    alternateName: 'Cashiea — AI Shop Manager',
    url: `${SITE_URL}/`,
    logo: { '@type': 'ImageObject', url: LOGO_URL, width: 512, height: 512 },
    image: OG_URL,
    description:
      'Cashiea builds AI-powered POS, GST billing and shop-management software for small and medium retail businesses in India.',
    email: SUPPORT_EMAIL,
    foundingLocation: { '@type': 'Country', name: 'India' },
    areaServed: { '@type': 'Country', name: 'India' },
    knowsAbout: [
      'Point of sale software',
      'GST invoicing',
      'Retail inventory management',
      'Khata and udhaar credit tracking',
      'WhatsApp business automation',
      'Small business accounting in India',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: SUPPORT_EMAIL,
        availableLanguage: ['en', 'hi'],
        areaServed: 'IN',
      },
    ],
  }
}

/** The site itself, with the internal help search exposed to Google. */
export function webSiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    inLanguage: 'en-IN',
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/help?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export const FEATURE_LIST = [
  'Counter POS with split payments, barcode scanning and UPI QR',
  'Rule-46 GST tax invoices with HSN codes and CGST/SGST/IGST split',
  'Khata (udhaar) credit tracking with WhatsApp payment reminders',
  'Stock management with low-stock alerts, CSV import and auto-reorder',
  'Customer CRM with purchase history, segments and dormant-regular detection',
  'Daily WhatsApp sales reports and receipts',
  'Meraj AI shop manager with voice in 10 Indian languages',
  'Offline billing with automatic sync',
  'AI business reports with PDF and Excel export',
  'End-of-day cash reconciliation with variance flagging',
  'Recurring invoices for rent and retainers',
  'Team accounts with roles, permissions and activity logs',
]

/** The product. AI answer engines lean on this node heavily. */
export function softwareApplicationSchema() {
  return {
    '@type': ['SoftwareApplication', 'WebApplication'],
    '@id': SOFTWARE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Point of Sale / GST Billing & Retail Management',
    operatingSystem: 'Web, Android, iOS (progressive web app)',
    browserRequirements: 'Requires JavaScript. Works in any modern browser.',
    softwareVersion: '1.0',
    description: DEFAULT_DESCRIPTION,
    image: OG_URL,
    screenshot: OG_URL,
    inLanguage: ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa'],
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
    audience: {
      '@type': 'BusinessAudience',
      audienceType:
        'Small and medium retail shop owners in India — kirana, hardware, medical, garments, electronics and other counter-based businesses',
      geographicArea: { '@type': 'Country', name: 'India' },
    },
    featureList: FEATURE_LIST,
    offers: [
      {
        '@type': 'Offer',
        name: 'Free Trial',
        price: '0',
        priceCurrency: 'INR',
        category: 'free trial',
        description: '14-day free trial with 50 AI actions. No card required.',
        url: `${SITE_URL}/signup`,
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Premium',
        price: '8000',
        priceCurrency: 'INR',
        category: 'subscription',
        description:
          'Monthly plan: unlimited billing, 10,000 AI actions, WhatsApp reports, payment reminders and team accounts. Cancel anytime.',
        url: `${SITE_URL}/pricing`,
        availability: 'https://schema.org/InStock',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '8000',
          priceCurrency: 'INR',
          billingDuration: 1,
          billingIncrement: 1,
          unitCode: 'MON',
        },
      },
    ],
  }
}

export interface Crumb {
  name: string
  path: string
}

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path}`,
    })),
  }
}

export function faqSchema(faqs: { q: string; a: string }[], pageUrl: string) {
  return {
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

export function webPageSchema(opts: {
  path: string
  title: string
  description: string
  type?: string
  crumbs?: Crumb[]
}) {
  const url = `${SITE_URL}${opts.path === '/' ? '/' : opts.path}`
  return {
    '@type': opts.type || 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: opts.title,
    description: opts.description,
    inLanguage: 'en-IN',
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': SOFTWARE_ID },
    publisher: { '@id': ORGANIZATION_ID },
    primaryImageOfPage: { '@type': 'ImageObject', url: OG_URL },
    ...(opts.crumbs?.length ? { breadcrumb: breadcrumbSchema(opts.crumbs) } : {}),
  }
}

export function articleSchema(opts: {
  path: string
  headline: string
  description: string
  datePublished?: string
  dateModified?: string
  section?: string
  type?: 'Article' | 'BlogPosting' | 'TechArticle'
}) {
  const url = `${SITE_URL}${opts.path}`
  return {
    '@type': opts.type || 'Article',
    '@id': `${url}#article`,
    headline: opts.headline,
    description: opts.description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${url}#webpage` },
    inLanguage: 'en-IN',
    image: OG_URL,
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
    ...(opts.section ? { articleSection: opts.section } : {}),
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    ...(opts.dateModified || opts.datePublished
      ? { dateModified: opts.dateModified || opts.datePublished }
      : {}),
  }
}

/** Wraps nodes in a single @graph document — the shape Google prefers. */
export function graph(nodes: unknown[]) {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) }
}
