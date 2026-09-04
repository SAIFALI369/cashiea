// ════════════════════════════════════════════════════════════════
// MERAJ DAILY ADVICE — 24/7 actionable business suggestions.
//
// Every day at 5:00 AM IST, Meraj generates 20 short (3-7 word)
// ACTIONABLE suggestions — real advice the owner can act on today
// (reorder, follow-up, discount, promote). No motivational fluff.
// One per hour, 6 AM → 1 AM next day.
//
// The schedule:
//   • 5:00 AM — if today's batch doesn't exist, AI-generates 20
//     sentences and stores them in localStorage.
//   • Each hour the CURRENT thought rotates; shown thoughts are
//     marked as "seen" and never shown again.
//   • If the AI call fails, fall back to a built-in pool of friendly
//     Hindi-English phrases so Meraj is never silent.
//
// The sentences are Meraj talking to the owner like a friend — no
// formal reports, no long explanations. Just companionship.
// ════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { askAssistant } from './ai'

interface ThoughtBatch {
  date: string        // YYYY-MM-DD (IST)
  sentences: string[] // exactly 20 sentences (index 0 = 6am slot, … index 19 = 1am next day)
  seen: boolean[]     // 20 booleans; true once that slot has been displayed
  generatedAt: number // epoch ms (when we tried to fetch AI, for debug)
  aiGenerated: boolean // true if AI actually produced these (fallback if false)
}

const STORE_KEY = 'cashiea_meraj_thoughts_v1'
function storeKey(ownerId?: string | null): string { return `${STORE_KEY}:${ownerId || 'anonymous'}` }

// ── Fallback pool (used if the AI call fails / user is offline).
// 3-7 word ACTIONABLE business suggestions — Meraj acts as the shop's
// manager, giving specific advice the owner can act on today. No fluff,
// no motivational filler — every line earns its place.
const FALLBACK_POOL: string[] = [
  'Top seller reorder kar le',
  'Dormant customer ko WhatsApp bhej',
  'Low-stock items aaj hi order',
  'Bestseller ko counter pe rakho',
  'Slow items pe 10% discount',
  'Aaj ka cash count abhi',
  'Fast-mover bulk mein kharid',
  'Slow-mover return ya exchange',
  'UPI QR checkout pe laga',
  'Overdue invoice reminder bhej',
  'Weekend stock double rakh',
  'Best margin item promote',
  'Customer feedback aaj pucho',
  'Supplier rate compare kar',
  'Expiry-date items aage rakh',
  'Peak hour pe extra stock',
  'Naya combo offer try',
  'Reorder point set kar',
  'Cash-only items UPI pe',
  'Weekly report CA ko bhej',
  'Fast seller ke saath bundle',
  'Old stock clearance sale',
  'UPI payment reminder laga',
  'Delivery area expand kar',
]

function istNow(): Date { return new Date(Date.now() + 5.5 * 3600000) }
function istDateStr(d: Date = istNow()): string { return d.toISOString().split('T')[0] }
function addUtcDays(d: Date, days: number): Date { return new Date(d.getTime() + days * 86400000) }
/**
 * A thought batch runs 6 AM → 1 AM. The 00:00 and 01:00 slots still
 * belong to the previous day's 5 AM batch, not the next calendar day.
 */
function activeBatchDateStr(d: Date = istNow()): string {
  const h = d.getUTCHours()
  return istDateStr(h < 2 ? addUtcDays(d, -1) : d)
}
/**
 * Map an IST date to the "thought hour slot" index 0–19, where:
 *   0 = 06:00–06:59 IST, 1 = 07:00–07:59 IST, … 19 = 01:00–01:59 next day
 * Hours 2,3,4,5 (02:00–05:59 IST) return -1 (Meraj "sleeping" / quiet).
 */
function currentSlotIndex(d: Date = istNow()): number {
  const h = d.getUTCHours()
  if (h >= 6 && h <= 23) return h - 6          // 0..17
  if (h === 0 || h === 1) return 18 + h       // 18,19
  return -1
}

function randomFallbackBatch(): string[] {
  const shuffled = [...FALLBACK_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 20)
}

function emptyBatch(date: string): ThoughtBatch {
  return { date, sentences: randomFallbackBatch(), seen: new Array(20).fill(false), generatedAt: Date.now(), aiGenerated: false }
}

function readBatch(ownerId?: string | null): ThoughtBatch | null {
  try {
    const raw = localStorage.getItem(storeKey(ownerId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ThoughtBatch
    if (!parsed || !parsed.date || !Array.isArray(parsed.sentences) || parsed.sentences.length < 20) return null
    return parsed
  } catch { return null }
}
function writeBatch(b: ThoughtBatch, ownerId?: string | null) {
  try { localStorage.setItem(storeKey(ownerId), JSON.stringify(b)) } catch { /* ignore */ }
}

/** Ensure today's batch exists — generates if missing (or it's a new day). */
async function ensureTodayBatch(ownerId: string | null | undefined): Promise<ThoughtBatch> {
  const today = activeBatchDateStr()
  const existing = readBatch(ownerId)
  if (existing && existing.date === today) {
    // Top-up if the array lost entries for some reason
    if (existing.sentences.length < 20) existing.sentences = [...existing.sentences, ...randomFallbackBatch()].slice(0, 20)
    if (!existing.seen || existing.seen.length < 20) existing.seen = [...(existing.seen || []), ...new Array(20).fill(false)].slice(0, 20)
    return existing
  }

  // New day — build a fresh batch. Try AI; fall back to the built-in pool.
  const batch = emptyBatch(today)

  // Fire-and-forget AI generation — don't block UI if it fails/offline.
  // We don't want to spam the API every open so we mark "running" via a flag.
  const flagKey = `cashiea_meraj_thoughts_gen:${ownerId || 'anonymous'}:${today}`
  try {
    if (!localStorage.getItem(flagKey)) {
      localStorage.setItem(flagKey, 'running')
      askAssistant(
        'You are Meraj, the shop manager. Give EXACTLY 20 ultra-short (3-7 words) ACTIONABLE business suggestions — specific advice the owner can act on TODAY. Mix Hinglish and English. Each line = one concrete action: reorder a fast-seller, follow up a dormant customer, discount a slow item, count cash, compare supplier rates, set reorder points, promote best-margin items, clear old stock, expand delivery, bundle products. NO fluff, NO motivational filler, NO generic praise. One suggestion per line. Examples of the bar: "Top seller reorder kar le", "Slow items pe 10% discount", "Overdue invoice reminder bhej". Output ONLY the 20 lines, nothing else.',
        false, undefined, 'ask',
      ).then((res) => {
        const lines = (res.reply || '')
          .split(/\n+/)
          .map((l) => l.replace(/^[-*•\d.\s]+/, '').trim())
          .filter((l) => l && l.split(/\s+/).length >= 2 && l.split(/\s+/).length <= 9)
          .slice(0, 20)
        if (lines.length >= 10) {
          // Fill to 20 with fallbacks if AI gave fewer than 20
          while (lines.length < 20) lines.push(randomFallbackBatch()[lines.length % FALLBACK_POOL.length])
          const updated = readBatch(ownerId)
          if (updated && updated.date === today) {
            updated.sentences = lines
            updated.aiGenerated = true
            writeBatch(updated, ownerId)
          } else {
            writeBatch({ ...emptyBatch(today), sentences: lines, aiGenerated: true }, ownerId)
          }
        }
        localStorage.setItem(flagKey, 'done')
      }).catch(() => {
        localStorage.setItem(flagKey, 'error')
      })
    }
  } catch { /* ignore */ }

  writeBatch(batch, ownerId)
  return batch
}

/**
 * Return the current thought sentence for this hour, cycling automatically
 * when the hour ticks over. Also marks it "seen" as soon as it's shown,
 * so once shown it's deleted/consumed and never appears again.
 */
export function useMerajThought(ownerId?: string | null): {
  text: string | null       // null when Meraj is "sleeping" (2–5 AM IST)
  slot: number              // 0..19, or -1 when sleeping
  awake: boolean            // false during 2–5 AM IST
  refreshNow: () => void    // manually rotate (e.g. when user taps the bubble)
} {
  const [text, setText] = useState<string | null>(null)
  const [slot, setSlot] = useState<number>(() => currentSlotIndex())
  const [tick, setTick] = useState(0)

  // Ensure today's batch is present + watch for hour changes.
  useEffect(() => {
    let mounted = true
    ensureTodayBatch(ownerId).then(() => {
      if (mounted) setTick((t) => t + 1)
    })

    // Re-check every minute for hour rollover (cheap).
    const interval = setInterval(() => {
      const nextSlot = currentSlotIndex()
      setSlot((prev) => {
        if (nextSlot !== prev) {
          ensureTodayBatch(ownerId)
          setTick((t) => t + 1)
        }
        return nextSlot
      })
    }, 60_000)
    return () => { mounted = false; clearInterval(interval) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId])

  // Pick the current-slot text (first unseen), mark it seen (consumed).
  useEffect(() => {
    const batch = readBatch(ownerId)
    if (!batch) { setText(null); return }

    if (slot < 0) { setText(null); return }

    // If current slot's sentence already seen (e.g. from a previous visit
    // this hour), look for the first unseen slot within range to display
    // something fresh. Otherwise just show the current slot's line.
    let idx = slot
    if (batch.seen[slot]) {
      // find next unseen at-or-after current slot; else fall back to current
      for (let i = slot; i < 20; i++) {
        if (!batch.seen[i]) { idx = i; break }
      }
    }

    // Mark it consumed ("delete after shown").
    batch.seen[idx] = true
    writeBatch(batch, ownerId)

    setText(batch.sentences[idx] || null)
  }, [slot, tick, ownerId])

  const refreshNow = () => {
    // Force-move to the next unseen sentence (skipping already-seen)
    const batch = readBatch(ownerId)
    if (!batch) return
    let next = -1
    for (let i = 0; i < 20; i++) {
      if (!batch.seen[i]) { next = i; break }
    }
    if (next >= 0) {
      batch.seen[next] = true
      writeBatch(batch, ownerId)
      setText(batch.sentences[next])
      setSlot(next)
    } else {
      // All 20 seen today → drop a few extra fallback lines to avoid silence
      const extra = randomFallbackBatch()[Math.floor(Math.random() * FALLBACK_POOL.length)]
      setText(extra)
    }
  }

  return { text, slot, awake: slot >= 0, refreshNow }
}

/** Exposed for tests: deterministic slot computation. */
export const __test = { currentSlotIndex, istDateStr }
