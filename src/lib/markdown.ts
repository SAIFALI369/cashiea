import DOMPurify from 'dompurify'
import { marked } from 'marked'

/**
 * renderMd — shared markdown → sanitized HTML. Used for AI replies (chat +
 * voice) and AI-generated reports/summaries so raw markdown symbols never
 * show up as literal text ("code showing up").
 */
export function renderMd(md: string): string {
  if (!md) return ''
  return DOMPurify.sanitize(marked.parse(md, { async: false }) as string, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'br', 'code', 'a'],
    ALLOWED_ATTR: ['href'],
  })
}

export default renderMd
