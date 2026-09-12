import { describe, it, expect } from 'vitest'
import { schemaForPath } from './routeSchema'
import { SITE_URL } from './site'
import { HELP_ARTICLES } from './helpArticles'
import { BLOG_POSTS } from './blogPosts'
import { LANDING_FAQS, PRICING_FAQS } from './faqs'

// The JSON-LD graph is what Google and the AI answer engines read to
// decide *what Cashiea is*. These tests pin the contract: valid shape,
// stable @ids, no invented ratings, and nothing emitted for private
// authenticated routes.

type Graph = { '@context': string; '@graph': Array<Record<string, unknown>> }

const g = (path: string) => schemaForPath(path) as Graph | null

const typesOf = (graph: Graph) =>
  graph['@graph'].flatMap((n) => (Array.isArray(n['@type']) ? n['@type'] : [n['@type']]))

describe('schemaForPath', () => {
  it('emits a valid schema.org @graph for the home page', () => {
    const home = g('/')!
    expect(home['@context']).toBe('https://schema.org')
    expect(Array.isArray(home['@graph'])).toBe(true)
    const types = typesOf(home)
    expect(types).toContain('Organization')
    expect(types).toContain('WebSite')
    expect(types).toContain('SoftwareApplication')
    expect(types).toContain('FAQPage')
  })

  it('describes the product with both pricing offers', () => {
    const software = g('/')!['@graph'].find((n) =>
      (Array.isArray(n['@type']) ? n['@type'] : [n['@type']]).includes('SoftwareApplication'),
    ) as Record<string, any>
    expect(software.applicationCategory).toBe('BusinessApplication')
    const prices = software.offers.map((o: any) => `${o.priceCurrency}${o.price}`)
    expect(prices).toEqual(['INR0', 'INR8000'])
  })

  it('never fabricates ratings or review counts', () => {
    const json = JSON.stringify(g('/'))
    expect(json).not.toContain('aggregateRating')
    expect(json).not.toContain('reviewCount')
    expect(json).not.toContain('ratingValue')
  })

  it('publishes every landing FAQ as a Question node', () => {
    const faq = g('/')!['@graph'].find((n) => n['@type'] === 'FAQPage') as Record<string, any>
    expect(faq.mainEntity).toHaveLength(LANDING_FAQS.length)
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe(LANDING_FAQS[0].a)
  })

  it('adds the pricing FAQ and product node on /pricing', () => {
    const types = typesOf(g('/pricing')!)
    expect(types).toContain('FAQPage')
    expect(types).toContain('SoftwareApplication')
    const faq = g('/pricing')!['@graph'].find((n) => n['@type'] === 'FAQPage') as Record<string, any>
    expect(faq.mainEntity).toHaveLength(PRICING_FAQS.length)
  })

  it('marks help articles as TechArticle with breadcrumbs', () => {
    const path = `/help/${HELP_ARTICLES[0].slug}`
    const graph = g(path)!
    expect(typesOf(graph)).toContain('TechArticle')
    const page = graph['@graph'].find((n) => n['@type'] === 'WebPage') as Record<string, any>
    expect(page.breadcrumb.itemListElement).toHaveLength(3)
    expect(page.url).toBe(`${SITE_URL}${path}`)
  })

  it('marks blog posts as BlogPosting with a publish date', () => {
    const post = BLOG_POSTS[0]
    const article = g(`/blog/${post.slug}`)!['@graph'].find(
      (n) => n['@type'] === 'BlogPosting',
    ) as Record<string, any>
    expect(article.headline).toBe(post.title)
    expect(article.datePublished).toBe(post.date)
  })

  it('lists every help article on the help index', () => {
    const list = g('/help')!['@graph'].find((n) => n['@type'] === 'ItemList') as Record<string, any>
    expect(list.itemListElement).toHaveLength(HELP_ARTICLES.length)
  })

  it('returns null for private app routes and unknown paths', () => {
    expect(schemaForPath('/app')).toBeNull()
    expect(schemaForPath('/app/dashboard')).toBeNull()
    expect(schemaForPath('/help/does-not-exist')).toBeNull()
    expect(schemaForPath('/nope')).toBeNull()
  })

  it('uses absolute canonical URLs everywhere', () => {
    for (const path of ['/', '/pricing', '/features', '/help', '/blog', '/login', '/signup']) {
      const json = JSON.stringify(g(path))
      expect(json).not.toMatch(/"url":"\//)
      expect(json).toContain(SITE_URL)
    }
  })
})
