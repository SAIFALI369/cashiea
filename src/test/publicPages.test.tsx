import { describe, it, expect, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

import SitePricing from '../pages/site/Pricing'
import SiteFeatures from '../pages/site/Features'
import SiteAbout from '../pages/site/About'
import SiteContact from '../pages/site/Contact'
import Security from '../pages/site/Security'
import Help from '../pages/site/Help'
import HelpArticlePage from '../pages/site/HelpArticlePage'
import Blog from '../pages/site/Blog'
import BlogPostPage from '../pages/site/BlogPostPage'
import { HELP_ARTICLES } from '../lib/helpArticles'
import { BLOG_POSTS } from '../lib/blogPosts'

// Smoke tests for the additive public-site layer: every new route
// renders its headline content without crashing. Pure rendering —
// no network, no auth, no business logic involved.

let container: HTMLDivElement | null = null
let root: Root | null = null

function renderAt(path: string) {
  container = document.createElement('div')
  document.body.appendChild(container)
  act(() => {
    root = createRoot(container!)
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<SitePricing />} />
          <Route path="/pricing" element={<SitePricing />} />
          <Route path="/features" element={<SiteFeatures />} />
          <Route path="/about" element={<SiteAbout />} />
          <Route path="/contact" element={<SiteContact />} />
          <Route path="/security" element={<Security />} />
          <Route path="/help" element={<Help />} />
          <Route path="/help/:slug" element={<HelpArticlePage />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="*" element={<div>NOT FOUND</div>} />
        </Routes>
      </MemoryRouter>,
    )
  })
  return container!
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  container = null
  root = null
})

function text(el: HTMLElement) {
  return el.textContent || ''
}

describe('public site pages render', () => {
  it('pricing shows the existing plan untouched', () => {
    const el = renderAt('/pricing')
    expect(text(el)).toContain('₹8,000')
    expect(text(el)).toContain('₹267/day')
    expect(text(el)).toContain('14-day trial')
  })

  it('features documents shipped capabilities', () => {
    const el = renderAt('/features')
    expect(text(el)).toContain('Counter POS')
    expect(text(el)).toContain('GST tax invoices')
    expect(text(el)).toContain('Meraj')
  })

  it('about stays factual', () => {
    const el = renderAt('/about')
    expect(text(el)).toContain('Built for Tier 2/3 India')
    expect(text(el)).toContain('supportcashiea@gmail.com')
  })

  it('contact lists only real channels', () => {
    const el = renderAt('/contact')
    expect(text(el)).toContain('supportcashiea@gmail.com')
    expect(text(el)).toContain('24 hours')
  })

  it('security makes only verified claims', () => {
    const el = renderAt('/security')
    expect(text(el)).toContain('Row-level security')
    expect(text(el)).toContain('What we don’t claim')
  })

  it('help hub lists every article', () => {
    const el = renderAt('/help')
    const t = text(el)
    expect(t).toContain('Answers, the way Meraj gives them.')
    for (const a of HELP_ARTICLES) expect(t).toContain(a.title)
  })

  it.each(HELP_ARTICLES.map((a) => a.slug))('help article renders: %s', (slug) => {
    const el = renderAt(`/help/${slug}`)
    const t = text(el)
    expect(t).not.toContain('NOT FOUND')
    expect(t.length).toBeGreaterThan(200)
  })

  it('blog index lists posts', () => {
    const el = renderAt('/blog')
    const t = text(el)
    for (const p of BLOG_POSTS) expect(t).toContain(p.title)
  })

  it.each(BLOG_POSTS.map((p) => p.slug))('blog post renders: %s', (slug) => {
    const el = renderAt(`/blog/${slug}`)
    const t = text(el)
    expect(t).not.toContain('NOT FOUND')
    expect(t.length).toBeGreaterThan(200)
  })
})
