import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, BookOpen, LifeBuoy, ArrowRight, Sparkles } from 'lucide-react'
import PublicPageShell, { SectionEyebrow, Mono } from '../../components/PublicPageShell'
import { HELP_ARTICLES, HELP_CATEGORIES, helpByCategory } from '../../lib/helpArticles'

// ────────────────────────────────────────────────────────────────
// Help center hub — searchable index over the article library in
// src/lib/helpArticles.ts. Documents shipped behaviour only.
// ────────────────────────────────────────────────────────────────

export default function Help() {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return null
    return HELP_ARTICLES.filter((a) =>
      [a.title, a.summary, a.category, a.body].some((f) => f.toLowerCase().includes(needle)),
    )
  }, [q])

  return (
    <PublicPageShell>
      <section className="px-4 pt-14 pb-10 sm:pt-20 text-center">
        <div className="max-w-2xl mx-auto">
          <SectionEyebrow>HELP CENTER</SectionEyebrow>
          <h1 className="mt-3 text-3xl sm:text-5xl font-bold leading-tight text-fg">
            Answers, the way Meraj gives them.
          </h1>
          <p className="mt-4 text-sm sm:text-base text-fg-muted max-w-lg mx-auto leading-relaxed">
            Short, practical guides for the real Cashiea — billing, GST invoices, stock, khata, WhatsApp reports and more.
          </p>
          <div className="relative max-w-md mx-auto mt-7">
            <Search className="w-4 h-4 text-fg-subtle absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input-field pl-11 rounded-full py-3"
              placeholder="Search guides — “invoice”, “offline”, “khata”…"
              aria-label="Search help articles"
            />
          </div>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto">
          {filtered ? (
            <div>
              <Mono className="text-fg-subtle">{filtered.length} {filtered.length === 1 ? 'guide' : 'guides'} found</Mono>
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                {filtered.map((a) => (
                  <Link key={a.slug} to={`/help/${a.slug}`} className="card card-hover p-5 block">
                    <Mono className="text-accent-strong">{a.category}</Mono>
                    <p className="mt-1.5 text-sm font-bold text-fg">{a.title}</p>
                    <p className="mt-1 text-xs text-fg-muted leading-relaxed">{a.summary}</p>
                  </Link>
                ))}
              </div>
              {filtered.length === 0 && (
                <div className="card p-8 text-center">
                  <BookOpen className="w-6 h-6 text-fg-subtle mx-auto mb-3" />
                  <p className="text-sm font-semibold text-fg">Nothing matched “{q}”.</p>
                  <p className="mt-1 text-xs text-fg-muted">Try a simpler word like “invoice” or “stock” — or ask us directly from the contact page.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-10">
              {HELP_CATEGORIES.map((cat) => {
                const arts = helpByCategory(cat)
                if (arts.length === 0) return null
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                      <h2 className="text-sm font-bold text-fg">{cat}</h2>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {arts.map((a) => (
                        <Link key={a.slug} to={`/help/${a.slug}`} className="card card-hover p-4 block h-full">
                          <p className="text-sm font-bold text-fg">{a.title}</p>
                          <p className="mt-1 text-xs text-fg-muted leading-relaxed">{a.summary}</p>
                          <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-accent-strong">Read <ArrowRight className="w-3 h-3" /></span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-12 rounded-3xl p-6 sm:p-8" style={{ background: 'rgb(var(--accent-strong))' }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}><Sparkles className="w-4 h-4 text-white" /></span>
                <div>
                  <p className="text-sm font-bold text-white">Still stuck? A human is one message away.</p>
                  <p className="mt-1 text-xs text-white/80 leading-relaxed">Signed-in customers get the in-app support desk; everyone can email us. We typically reply within 24 hours, Monday–Friday.</p>
                </div>
              </div>
              <Link to="/contact" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-sm font-bold flex-shrink-0" style={{ color: 'rgb(var(--accent-strong))' }}>
                <LifeBuoy className="w-4 h-4" /> Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicPageShell>
  )
}
