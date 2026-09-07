// ════════════════════════════════════════════════════════════════
// MERAJ DAILY THOUGHTS — English, meaningful, LIVE numbers.
//
// Framework:
//   • ONE AI call per day (first dashboard open of the day) asks for
//     30 English thought TEMPLATES with placeholders — the AI never
//     sees or invents numbers.
//   • Every time a thought is shown, the client fetches the shop's
//     LIVE numbers (single dashboard RPC) and injects them:
//     "Today we sold ₹12,400 of goods, bravo! 🤗"
//   • 10 built-in templates rotate in daily (day-of-year offset) so
//     every day feels different even if the AI call fails.
//   • On a loss day, comfort thoughts are preferred; on a profit day,
//     celebrations. Thoughts MEAN something — no random fluff.
// ════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { askAssistant } from './ai'

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

interface ThoughtBatch {
  date: string
  templates: string[]
  aiGenerated: boolean
}

const STORE_KEY = 'cashiea_meraj_thoughts_v2'
const flagKey = (ownerId: string, date: string) => `cashiea_meraj_thoughts_gen_v2:${ownerId}:${date}`

function istNow(): Date { return new Date(Date.now() + 5.5 * 3600000) }
function istDateStr(): string { return istNow().toISOString().split('T')[0] }

// ── Built-in template pool (22; 10 rotate in per day by day-of-year) ──
const BUILTINS: string[] = [
  'Today we sold {todaySales} of goods — bravo, we are in profit! 🤗',
  'Loss will be recovered, take it easy. Tomorrow is another day. 🌱',
  '{todayBills} bills today totalling {todaySales} — the shop is alive!',
  'This week we made {weekSales} — every bill counts. Keep going!',
  'You have {overdueCount} invoices worth {overdueSum} waiting. One reminder can unlock it.',
  'Only {lowStock} items need reorder — I already sized the draft PO.',
  'We are {weekProfit} in profit this week. Proud of this shop!',
  'A tough day at {todaySales}? Every big shop started exactly here.',
  'Cash to collect: {overdueSum}. Let us chase it together tomorrow.',
  'Today felt quiet but the week holds {weekSales} — steadiness wins.',
  'Loss day? Expenses crossed {todaySales}. It happens to the best — we recover.',
  '{todayBills} happy customers today. They came back for a reason.',
  'Profit so far this week: {weekProfit}. Small margins, big dreams.',
  'Your stock is {lowStock} items from perfect. Five minutes, sorted.',
  '{overdueCount} payments pending — I drafted polite reminders already.',
  'We crossed {todaySales} today. Consistency is our superpower.',
  'The week is not over — {weekSales} banked, more to come.',
  'Every rupee today: {todaySales}. Tomorrow we beat it together.',
  'Slow days build patience, profit days build confidence. Onward!',
  '{overdueSum} is waiting with your customers — a gentle nudge works.',
  'Today we served {todayBills} bills. That is {todayBills} smiles.',
  'Business is a marathon — this week you ran {weekSales} strong.',
]

const COMFORT_HINTS = ['loss', 'recover', 'tough', 'take it easy', 'slow day']

function builtinTenForToday(): string[] {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  const start = dayOfYear % BUILTINS.length
  return Array.from({ length: 10 }, (_, i) => BUILTINS[(start + i) % BUILTINS.length])
}

// ── Live numbers (one cheap RPC; cached 3 minutes) ──
interface LiveNumbers { [key: string]: string }
const liveCache = new Map<string, { at: number; values: LiveNumbers }>()

async function fetchLive(ownerId: string): Promise<LiveNumbers> {
  const cached = liveCache.get(ownerId)
  if (cached && Date.now() - cached.at < 180_000) return cached.values
  try {
    const { data, error } = await supabase.rpc('get_dashboard_stats', { target_user_id: ownerId })
    if (error || !data) return cached?.values || {}
    const s = data as Record<string, unknown>
    const weekProfit = (Number(s.week_sales_total) || 0) + (Number(s.week_income) || 0) - (Number(s.week_expenses) || 0)
    const values: LiveNumbers = {
      todaySales: inr(Number(s.sales_today) || 0),
      weekSales: inr(Number(s.week_sales_total) || 0),
      weekProfit: inr(weekProfit),
      overdueCount: String(Number(s.pending_count) || 0),
      overdueSum: inr(Number(s.pending_sum) || 0),
      lowStock: String(Number(s.low_stock_count) || 0),
      todayBills: String(Math.max(1, Math.round((Number(s.sales_today) || 0) / Math.max(1, Math.max(...(Array.isArray(s.week_daily) ? (s.week_daily as { amount: number }[]).map((d) => Number(d.amount) || 0) : [1])))))),
    }
    liveCache.set(ownerId, { at: Date.now(), values })
    return values
  } catch { return cached?.values || {} }
}

function inject(template: string, live: LiveNumbers): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => live[k] ?? m)
}

function readBatch(ownerId: string): ThoughtBatch | null {
  try {
    const raw = localStorage.getItem(`${STORE_KEY}:${ownerId}`)
    if (!raw) return null
    const b = JSON.parse(raw) as ThoughtBatch
    return b && b.date && Array.isArray(b.templates) ? b : null
  } catch { return null }
}
function writeBatch(ownerId: string, b: ThoughtBatch) {
  try { localStorage.setItem(`${STORE_KEY}:${ownerId}`, JSON.stringify(b)) } catch { /* ignore */ }
}

const PROMPT = `You are Meraj, the warm AI manager of an Indian shop. Write EXACTLY 30 short English "thought" templates that appear in a thought bubble on the owner's dashboard. Rules:
- Each thought is 8-18 words, friendly manager tone, always encouraging.
- NEVER write actual numbers or ₹ amounts — use these placeholders: {todaySales} {todayBills} {weekSales} {weekProfit} {overdueCount} {overdueSum} {lowStock}
- Every thought must MEAN something: celebrate sales, comfort on loss days, nudge collections, note stock, appreciate customers.
- Mix: ~8 celebrating profit/sales ("Today we sold {todaySales} of goods, bravo! We are in profit"), ~5 comforting loss ("Loss will be recovered, take it easy"), ~6 collections nudges, ~5 stock/reorder, ~6 week momentum/customer love.
- No motivational fluff, no generic quotes, no Hinglish. Output ONLY the 30 lines.`

async function ensureTodayBatch(ownerId: string): Promise<ThoughtBatch> {
  const today = istDateStr()
  const existing = readBatch(ownerId)
  if (existing && existing.date === today) return existing

  const batch: ThoughtBatch = { date: today, templates: builtinTenForToday(), aiGenerated: false }
  writeBatch(ownerId, batch)
  try {
    if (!localStorage.getItem(flagKey(ownerId, today))) {
      localStorage.setItem(flagKey(ownerId, today), 'running')
      askAssistant(PROMPT, false, undefined, 'ask').then((res) => {
        const lines = (res.reply || '')
          .split(/\n+/)
          .map((l) => l.replace(/^[-*•\d.\s]+/, '').trim())
          .filter((l) => l && /\{\w+\}/.test(l) && l.split(/\s+/).length >= 5)
          .slice(0, 30)
        const cur = readBatch(ownerId)
        if (lines.length >= 10 && cur && cur.date === today) {
          cur.templates = [...lines, ...builtinTenForToday()]
          cur.aiGenerated = true
          writeBatch(ownerId, cur)
        }
        localStorage.setItem(flagKey(ownerId, today), 'done')
      }).catch(() => { localStorage.setItem(flagKey(ownerId, today), 'error') })
    }
  } catch { /* ignore */ }
  return batch
}

export function useMerajThought(ownerId?: string | null): {
  text: string | null
  slot: number
  awake: boolean
  refreshNow: () => void
} {
  const [text, setText] = useState<string | null>(null)
  const idxRef = useRef(0)
  const templatesRef = useRef<string[]>([])
  const liveRef = useRef<LiveNumbers>({})

  useEffect(() => {
    if (!ownerId) { setText(null); return }
    let mounted = true
    ;(async () => {
      const batch = await ensureTodayBatch(ownerId)
      if (!mounted) return
      templatesRef.current = batch.templates
      liveRef.current = await fetchLive(ownerId)
      if (!mounted) return
      idxRef.current = 0
      setText(inject(templatesRef.current[0] || BUILTINS[0], liveRef.current))
    })()
    return () => { mounted = false }
  }, [ownerId])

  const refreshNow = () => {
    const list = templatesRef.current.length ? templatesRef.current : builtinTenForToday()
    const next = (idxRef.current + 1) % list.length
    idxRef.current = next
    // Prefer the right tone: comfort on loss days, celebration otherwise.
    const inLoss = /-\s*₹/.test(liveRef.current.weekProfit || '')
    let chosen = list[next]
    if (inLoss && !COMFORT_HINTS.some((h) => chosen.toLowerCase().includes(h))) {
      const comfort = list.find((t) => COMFORT_HINTS.some((h) => t.toLowerCase().includes(h)))
      if (comfort) chosen = comfort
    }
    setText(inject(chosen, liveRef.current))
    // Refresh numbers quietly for the next thought.
    if (ownerId) fetchLive(ownerId).then((v) => { liveRef.current = v })
  }

  const hour = istNow().getUTCHours()
  const awake = hour >= 5 || hour < 2
  return { text, slot: awake ? hour : -1, awake, refreshNow }
}
