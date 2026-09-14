// ════════════════════════════════════════════════════════════════
// abandonedCarts.ts — recover parked sales.
//
// The "Shopify abandoned cart recovery" answer for a physical shop:
// a HELD cart (hold & resume at the POS) with real value that nobody
// came back to is exactly an abandoned cart. This module finds them,
// and drafts the WhatsApp nudge — the owner always sees the message
// before anything is sent (same rule as every Cashiea send).
//
// Detection is pure and tested; sending is a wa.me deep link the owner
// taps (no auto-messaging, no template approval needed).
// ════════════════════════════════════════════════════════════════

import type { HeldCart } from './types'

export interface AbandonedCart {
  id: string
  label: string
  /** Customer name when the cart was held with one attached. */
  customerName: string | null
  customerPhone: string | null
  total: number
  itemCount: number
  heldAt: string
  ageHours: number
}

export const ABANDON_DEFAULTS = {
  /** Younger than this, the customer may just be shopping around. */
  minAgeHours: 2,
  /** Older than this, the moment has passed — noise, not help. */
  maxAgeHours: 72,
  /** Carts below this value are not worth a reminder. */
  minValue: 100,
} as const

function cartItemCount(cart: HeldCart['cart']): number {
  const lines = (cart as { lines?: unknown[] })?.lines
  if (!Array.isArray(lines)) return 0
  return lines.reduce<number>((sum, l) => {
    const qty = Number((l as { quantity?: unknown })?.quantity)
    return sum + (Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1)
  }, 0)
}

/**
 * Pure detector: held carts with value, aged into the follow-up window.
 * A cart with a customer phone is actionable; one without still shows
 * (the label often holds the customer's name) but can't be pinged.
 */
export function findAbandonedCarts(
  carts: HeldCart[],
  now = Date.now(),
  opts: Partial<typeof ABANDON_DEFAULTS> = {},
): AbandonedCart[] {
  const minAge = opts.minAgeHours ?? ABANDON_DEFAULTS.minAgeHours
  const maxAge = opts.maxAgeHours ?? ABANDON_DEFAULTS.maxAgeHours
  const minValue = opts.minValue ?? ABANDON_DEFAULTS.minValue

  const out: AbandonedCart[] = []
  for (const c of carts) {
    const held = new Date(c.created_at).getTime()
    if (!Number.isFinite(held)) continue
    const ageHours = (now - held) / 3600000
    if (ageHours < minAge || ageHours > maxAge) continue

    const total = Math.max(0, Number(c.total) || 0)
    if (total < minValue) continue

    const snapshot = c.cart as {
      customer?: { name?: unknown } | null
      lines?: unknown[]
    } | null
    const customerName = snapshot?.customer?.name
      ? String(snapshot.customer.name)
      : null
    // The hold label usually holds the customer's name when no customer
    // object was attached (the POS asks for a label like "Ramesh's cart").
    const label = String(c.label || '').trim()
    const phone = (c as unknown as { customer_phone?: string | null }).customer_phone || null

    out.push({
      id: c.id,
      label: label || (customerName ? `${customerName}'s cart` : 'Held cart'),
      customerName,
      customerPhone: phone,
      total: Math.round(total * 100) / 100,
      itemCount: cartItemCount(c.cart),
      heldAt: c.created_at,
      ageHours: Math.round(ageHours * 10) / 10,
    })
  }
  // Biggest + oldest first — that is where the money is.
  return out.sort((a, b) => b.total - a.total || a.ageHours - b.ageHours)
}

/** "3.5 hours ago" style age for the card. */
export function formatAge(hours: number): string {
  const h = Math.max(0, Number(hours) || 0)
  if (h < 1) return 'just now'
  if (h < 24) {
    const whole = Math.floor(h)
    const half = h - whole >= 0.5
    return `${whole}${half ? '.5' : ''} hour${whole === 1 && !half ? '' : 's'} ago`
  }
  const days = Math.floor(h / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** The WhatsApp nudge — friendly, one nudge only, never pushy. */
export function draftCartReminder(cart: AbandonedCart, shopName: string): string {
  const shop = shopName || 'our shop'
  const name = cart.customerName || cart.label.replace(/'s cart$/i, '')
  const hello = name ? `Hi ${name}!` : 'Hello!'
  return (
    `${hello} This is ${shop} 🙂\n\n` +
    `We kept your items ready — ${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'}, ` +
    `₹${cart.total.toLocaleString('en-IN')}.\n\n` +
    `Would you like us to hold them until evening, or should we bill and deliver? Reply here and we'll sort it out. 🙏`
  )
}

/** wa.me deep link for the reminder (opens WhatsApp with the text ready). */
export function cartReminderLink(cart: AbandonedCart, shopName: string): string | null {
  if (!cart.customerPhone) return null
  const digits = String(cart.customerPhone).replace(/\D/g, '')
  if (digits.length < 10) return null
  const msisdn = digits.length === 10 ? `91${digits}` : digits
  const text = encodeURIComponent(draftCartReminder(cart, shopName))
  return `https://wa.me/${msisdn}?text=${text}`
}
