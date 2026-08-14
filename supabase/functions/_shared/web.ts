// ════════════════════════════════════════════════════════════════
// WEB TOOLS for Meraj — live news (GNews) + web photos/videos (Pexels).
// Keys are server-side secrets: PEXELS_API_KEY, GNEWS_API_KEY.
// All calls are best-effort (never break the chat on a fetch failure).
// ════════════════════════════════════════════════════════════════

export interface NewsItem {
  title: string
  source: string
  url: string
  published: string
}
export interface MediaItem {
  type: 'photo' | 'video'
  thumb: string
  url: string
  alt: string
  link: string
}

export function wantsNews(message: string): boolean {
  return /\b(news|headline|headlines|today['’]?s (news|updates|headlines)|current events?|what(?:'’| i)s happening|latest updates?)\b/i.test(message || '')
}

export function wantsMedia(message: string): boolean {
  return /\b(photo|photos|image|images|picture|pictures|video|videos|wallpaper)\b/i.test(message || '')
}

export function extractNewsTopic(message: string): string {
  const m = message.match(/\bnews (?:about|on|for|in)\s+(.+)$/i) || message.match(/(.+?)\s+news\b/i)
  return m ? m[1].replace(/[?.!]/g, '').trim().slice(0, 60) : ''
}

export function extractMediaSubject(message: string): string {
  let m = message.match(/\b(?:show|find|get)\s+me\s+(?:a\s+|some\s+|the\s+)?(.+)$/i)
  if (!m) m = message.match(/\b(?:photo|image|picture|video)s?\s+(?:of|with|for)\s+(.+)$/i)
  return m ? m[1].replace(/[?.!]/g, '').trim().slice(0, 60) : message.replace(/[?.!]/g, '').trim().slice(0, 60)
}

/** Live news via GNews. Empty topic → India top headlines. */
export async function fetchNews(topic: string, key: string): Promise<NewsItem[]> {
  if (!key) return []
  try {
    const t = topic.trim()
    const base = 'https://gnews.io/api/v4'
    const url = t
      ? `${base}/search?q=${encodeURIComponent(t)}&lang=en&max=6&apikey=${key}`
      : `${base}/top-headlines?country=in&max=6&apikey=${key}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data.articles || []).slice(0, 6).map((a: any): NewsItem => ({
      title: a.title || '',
      source: a.source?.name || '',
      url: a.url || '',
      published: a.publishedAt || '',
    }))
  } catch {
    return []
  }
}

/** Web photos via Pexels (square-ish thumbnails for chat grids). */
export async function fetchMedia(subject: string, key: string): Promise<MediaItem[]> {
  if (!key || !subject.trim()) return []
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(subject)}&per_page=6&orientation=square`,
      { headers: { Authorization: key } },
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.photos || []).slice(0, 6).map((p: any): MediaItem => ({
      type: 'photo',
      thumb: p.src?.medium || p.src?.small || '',
      url: p.src?.large || '',
      alt: p.alt || subject,
      link: p.url || '',
    }))
  } catch {
    return []
  }
}
