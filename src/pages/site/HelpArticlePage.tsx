import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, LifeBuoy } from 'lucide-react'
import PublicPageShell, { Mono } from '../../components/PublicPageShell'
import { helpArticle, helpByCategory } from '../../lib/helpArticles'
import { renderMd } from '../../lib/markdown'
import { useArticleMeta } from '../../lib/useArticleMeta'
import NotFound from '../NotFound'

export default function HelpArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const article = slug ? helpArticle(slug) : undefined

  useArticleMeta(
    article ? `${article.title} — Cashiea Help` : 'Help — Cashiea',
    article ? article.summary : null,
    `/help/${slug ?? ''}`,
  )

  if (!article) return <NotFound />

  const related = helpByCategory(article.category).filter((a) => a.slug !== article.slug).slice(0, 3)

  return (
    <PublicPageShell>
      <article className="px-4 py-10 sm:py-14">
        <div className="max-w-2xl mx-auto">
          <Link to="/help" className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted hover:text-fg transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Help center
          </Link>

          <div className="mt-5">
            <Mono className="text-accent-strong">{article.category}</Mono>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight text-fg">{article.title}</h1>
            <p className="mt-2 text-sm text-fg-muted leading-relaxed">{article.summary}</p>
          </div>

          <div
            className="prose-content mt-6 space-y-3 text-sm text-fg-muted leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMd(article.body) }}
          />

          <div className="mt-10 card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-fg">Need a hand with this?</p>
              <p className="text-xs text-fg-muted mt-0.5">The support desk replies within 24 hours, Monday–Friday.</p>
            </div>
            <Link to="/contact" className="btn-secondary text-xs flex-shrink-0"><LifeBuoy className="w-3.5 h-3.5" /> Contact support</Link>
          </div>

          {related.length > 0 && (
            <div className="mt-10">
              <Mono className="text-fg-subtle">MORE IN {article.category}</Mono>
              <div className="mt-3 space-y-2">
                {related.map((r) => (
                  <Link key={r.slug} to={`/help/${r.slug}`} className="card card-hover p-4 flex items-center justify-between gap-3 block">
                    <div>
                      <p className="text-sm font-bold text-fg">{r.title}</p>
                      <p className="text-xs text-fg-muted mt-0.5">{r.summary}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-fg-subtle flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
    </PublicPageShell>
  )
}
