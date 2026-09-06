// ════════════════════════════════════════════════════════════════
// Social / WhatsApp Status drafts — text only, never auto-posted.
// Built from completed sales + the festival calendar we already ship.
// Profit is omitted unless the caller passes it (Snapshot already
// withholds profit without cost coverage).
// ════════════════════════════════════════════════════════════════

import { INDIAN_FESTIVALS, daysUntil } from './smartReminders'

export interface SocialFacts {
  shopName: string
  sales: number
  bills: number
  topItem?: { name: string; qty: number } | null
  profit?: number | null
  today?: Date
}

export interface SocialDraft {
  id: string
  title: string
  caption: string
}

export function buildSocialDrafts(f: SocialFacts): SocialDraft[] {
  const shop = (f.shopName || 'Our shop').trim()
  const today = f.today ?? new Date()
  const rupees = Math.round(f.sales)
  const bills = Math.max(0, Math.round(f.bills))
  const out: SocialDraft[] = []

  if (bills === 0 && rupees <= 0) {
    out.push({
      id: 'quiet',
      title: 'Quiet day',
      caption: `${shop} is open and ready. Drop by — we’d love to see you.`,
    })
  } else {
    const top = f.topItem?.name ? ` Today’s favourite: ${f.topItem.name}.` : ''
    out.push({
      id: 'today',
      title: 'Today’s numbers',
      caption: `${shop} · ${bills} bill${bills === 1 ? '' : 's'} today, ₹${rupees.toLocaleString('en-IN')}.${top} Thank you for the trust.`,
    })
  }

  if (f.topItem?.name && bills > 0) {
    out.push({
      id: 'highlight',
      title: 'Product highlight',
      caption: `${f.topItem.name} is moving at ${shop} today. Come grab yours before we restock.`,
    })
  }

  for (const fest of INDIAN_FESTIVALS) {
    const n = daysUntil(fest.date, today)
    if (n < 0 || n > 7) continue
    out.push({
      id: `fest-${fest.date}`,
      title: fest.name,
      caption: n === 0
        ? `${fest.greeting} from all of us at ${shop}!`
        : `${fest.greeting} in ${n} day${n === 1 ? '' : 's'} — ${shop} has you covered.`,
    })
    break
  }

  return out
}
