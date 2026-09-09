import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react'
import PublicPageShell, { Mono } from '../../components/PublicPageShell'
import { BLOG_POSTS, blogPost } from '../../lib/blogPosts'
import { renderMd } from '../../lib/markdown'
import { useArticleMeta } from '../../lib/useArticleMeta'
import NotFound from '../NotFound'

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? blogPost(slug) : undefined

  useArticleMeta(
    post ? `${post.title} — Cashiea Blog` : 'Blog — Cashiea',
    post ? post.summary : null,
    `/blog/${slug ?? ''}`,
  )

  if (!post) return <NotFound />

  const others = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2)

  return (
    <PublicPageShell>
      <article className="px-4 py-10 sm:py-14">
        <div className="max-w-2xl mx-auto">
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted hover:text-fg transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> All posts
          </Link>

          <div className="mt-5">
            <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
              <Mono className="text-accent-strong">{post.tag}</Mono>
              <span>·</span><span>{formatDate(post.date)}</span>
              <span>·</span><span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{post.readMinutes} min read</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight text-fg">{post.title}</h1>
            <p className="mt-2 text-sm text-fg-muted leading-relaxed">{post.summary}</p>
          </div>

          <div
            className="prose-content mt-6 space-y-3 text-sm text-fg-muted leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMd(post.body) }}
          />

          <div className="mt-10 card p-5">
            <p className="text-sm font-bold text-fg">Cashiea does this with you.</p>
            <p className="text-xs text-fg-muted mt-1 leading-relaxed">POS, GST invoices, khata, stock alerts and Meraj — 14-day free trial, no card required.</p>
            <div className="mt-3 flex gap-2">
              <Link to="/signup" className="btn-primary text-xs">Start free trial</Link>
              <Link to="/features" className="btn-secondary text-xs">See features</Link>
            </div>
          </div>

          {others.length > 0 && (
            <div className="mt-10">
              <Mono className="text-fg-subtle">KEEP READING</Mono>
              <div className="mt-3 space-y-2">
                {others.map((p) => (
                  <Link key={p.slug} to={`/blog/${p.slug}`} className="card card-hover p-4 flex items-center justify-between gap-3 block">
                    <div>
                      <p className="text-sm font-bold text-fg">{p.title}</p>
                      <p className="text-xs text-fg-muted mt-0.5">{p.summary}</p>
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
