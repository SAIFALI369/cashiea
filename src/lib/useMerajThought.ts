// ════════════════════════════════════════════════════════════════
// MERAJ DAILY THOUGHTS — 24/7 friendly refreshment storage.
//
// Every day at 5:00 AM IST, Meraj generates 20 short (3-7 word)
// friendly sentences ("bhai, sales theek chal rahi hai", "aaj profit
// acha hoga", etc.) — one per hour for the next 20 hours starting
// at 6 AM (the 4am–5am slot is Meraj "sleeping").
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

// ── Fallback pool (used if the AI call fails / user is offline).
// 3-7 word Hinglish friend phrases — warm, encouraging, shop-life vibes.
const FALLBACK_POOL: string[] = [
  'Aaj ka din achha jayega',
  'Bhai, tu jeetega aaj',
  'Sales badh rahi hain boss',
  'Tu kar lega, bharosa hai',
  'Thoda chai ho jaye?',
  'Aaj customer ayenge pakka',
  'Stock check kar le bhai',
  'Profit dekh ke khush hoga',
  'Hustle kar, fal milega',
  'Tere jaisa koi nahi hai',
  'Aaj bonus day banega',
  'Bhai aaj focus karna',
  'Sab theek ho jayega',
  'Tu champion hai yaar',
  'Aaj target pura hoga',
  'Chinta mat, main hoon na',
  'Customer ko haske welcome kar',
  'Cash flow strong rakhna',
  'Aaj naya try karte hain',
  'Raat tak record banega',
  'Subah subah energy high rakho',
  'Har customer ek mauka hai',
  'Aaj inventory check kar',
  'Dhandha tere haath mein hai',
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

function readBatch(): ThoughtBatch | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ThoughtBatch
    if (!parsed || !parsed.date || !Array.isArray(parsed.sentences) || parsed.sentences.length < 20) return null
    return parsed
  } catch { return null }
}
function writeBatch(b: ThoughtBatch) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(b)) } catch { /* ignore */ }
}

/** Ensure today's batch exists — generates if missing (or it's a new day). */
async function ensureTodayBatch(ownerId: string | null | undefined): Promise<ThoughtBatch> {
  const today = activeBatchDateStr()
  const existing = readBatch()
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
  const flagKey = `cashiea_meraj_thoughts_gen_${today}`
  try {
    if (!localStorage.getItem(flagKey)) {
      localStorage.setItem(flagKey, 'running')
      askAssistant(
        'Generate EXACTLY 20 very short friendly sentences (3 to 7 WORDS each, no longer) that a shop assistant friend named Meraj would say to the shop owner throughout the day. Mix Hinglish and English. Be warm, encouraging, casual, friend-like. NO lists, NO numbering, NO emoji, NO long lines. One short phrase per line. Examples of tone: "Aaj ka din achha jayega", "Tu champion hai yaar", "Thoda chai ho jaye?", "Sales badh rahi hain", "Har customer ek mauka hai". Output ONLY the 20 lines, one per line, nothing else.',
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
          const updated = readBatch()
          if (updated && updated.date === today) {
            updated.sentences = lines
            updated.aiGenerated = true
            writeBatch(updated)
          } else {
            writeBatch({ ...emptyBatch(today), sentences: lines, aiGenerated: true })
          }
        }
        localStorage.setItem(flagKey, 'done')
      }).catch(() => {
        localStorage.setItem(flagKey, 'error')
      })
    }
  } catch { /* ignore */ }

  writeBatch(batch)
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
    const batch = readBatch()
    if (!batch) { setText(null); return }

    if (slot < 0) { setText(null); return }

    // If current slot's sentence is already seen (e.g. from a previous visit
    // this hour), look forward for the next unseen slot. Never repeat a
    // consumed line; if today's 20 are exhausted, use an extra fallback.
    let idx = batch.seen[slot] ? -1 : slot
    if (idx < 0) {
      for (let i = slot + 1; i < 20; i++) {
        if (!batch.seen[i]) { idx = i; break }
      }
    }

    if (idx < 0) {
      setText(randomFallbackBatch()[Math.floor(Math.random() * FALLBACK_POOL.length)])
      return
    }

    // Mark it consumed ("delete after shown").
    batch.seen[idx] = true
    writeBatch(batch)

    setText(batch.sentences[idx] || null)
  }, [slot, tick])

  const refreshNow = () => {
    // Force-move to the next unseen sentence (skipping already-seen)
    const batch = readBatch()
    if (!batch) return
    let next = -1
    const start = Math.max(0, currentSlotIndex() + 1)
    for (let i = start; i < 20; i++) {
      if (!batch.seen[i]) { next = i; break }
    }
    if (next < 0) {
      for (let i = 0; i < start; i++) {
        if (!batch.seen[i]) { next = i; break }
      }
    }
    if (next >= 0) {
      batch.seen[next] = true
      writeBatch(batch)
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
export const __test = { currentSlotIndex, istDateStr, activeBatchDateStr }
