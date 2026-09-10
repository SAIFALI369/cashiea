import { Link } from 'react-router-dom'
import { ArrowRight, Clock } from 'lucide-react'
import PublicPageShell, { SectionEyebrow, Mono } from '../../components/PublicPageShell'
import { BLOG_POSTS } from '../../lib/blogPosts'

// ────────────────────────────────────────────────────────────────
// Blog index. Posts live in src/lib/blogPosts.ts — practical,
// India-relevant notes that stay factually accurate.
// ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Blog() {
  const [latest, ...rest] = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <PublicPageShell>
      <section className="px-4 pt-14 pb-10 sm:pt-20 text-center">
        <div className="max-w-2xl mx-auto">
          <SectionEyebrow>BLOG</SectionEyebrow>
          <h1 className="mt-3 text-3xl sm:text-5xl font-bold leading-tight text-fg">Notes from the counter.</h1>
          <p className="mt-4 text-sm sm:text-base text-fg-muted max-w-lg mx-auto leading-relaxed">
            Short, practical reads on GST, stock and running a small Indian shop — written for shopkeepers, not search engines.
          </p>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="max-w-3xl mx-auto space-y-4">
          {latest && (
            <Link to={`/blog/${latest.slug}`} className="card card-hover p-6 block">
              <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
                <Mono className="text-accent-strong">{latest.tag}</Mono>
                <span>·</span><span>{formatDate(latest.date)}</span>
                <span>·</span><span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{latest.readMinutes} min</span>
              </div>
              <h2 className="mt-2 text-xl sm:text-2xl font-bold text-fg leading-snug">{latest.title}</h2>
              <p className="mt-2 text-sm text-fg-muted leading-relaxed">{latest.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-accent-strong">Read article <ArrowRight className="w-3.5 h-3.5" /></span>
            </Link>
          )}

          {rest.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} className="card card-hover p-5 flex items-start justify-between gap-4 block">
              <div>
                <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
                  <Mono className="text-accent-strong">{p.tag}</Mono>
                  <span>·</span><span>{formatDate(p.date)}</span>
                  <span>·</span><span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{p.readMinutes} min</span>
                </div>
                <h3 className="mt-1.5 text-base font-bold text-fg leading-snug">{p.title}</h3>
                <p className="mt-1 text-xs text-fg-muted leading-relaxed">{p.summary}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-fg-subtle flex-shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      </section>
    </PublicPageShell>
  )
}
