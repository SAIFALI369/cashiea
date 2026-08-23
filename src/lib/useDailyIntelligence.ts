import { useEffect } from 'react'
import { supabase } from './supabase'
import { askAssistant } from './ai'
import toast from 'react-hot-toast'

// ════════════════════════════════════════════════════════════════
// DAILY INTELLIGENCE — lazy-cron system (no server-side pg_cron needed)
//
// Triggers at 9:00 PM IST: AI-generated business suggestions
//   (reorder products, add Indian-market items, profit/sales-based)
// Triggers at 9:10 PM IST: AI-generated personalised questions
//   (to learn more about the business)
// Fires when the owner opens the app after the trigger time
// (per-day localStorage flag prevents re-runs). Results stored in
// ai_predictions and surfaced on the Dashboard + via toast notification.
// ════════════════════════════════════════════════════════════════

function istNow(): Date { return new Date(Date.now() + 5.5 * 3600000) }
function istDateStr(): string { return istNow().toISOString().split('T')[0] }
function istMinutes(): number { const d = istNow(); return d.getUTCHours() * 60 + d.getUTCMinutes() }
function flag(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
function setFlag(key: string, v: string): void { try { localStorage.setItem(key, v) } catch { /* ignore */ } }

export function useDailyIntelligence(ownerId: string | null | undefined) {
  useEffect(() => {
    if (!ownerId) return
    const today = istDateStr()
    const mins = istMinutes()

    // 9:00 PM — business suggestions
    if (mins >= 21 * 60 && !flag(`cashiea_di_s_${today}`)) {
      setFlag(`cashiea_di_s_${today}`, 'running')
      void generateSuggestions(ownerId, today)
    }

    // 9:10 PM — learning questions
    if (mins >= 21 * 60 + 10 && !flag(`cashiea_di_q_${today}`)) {
      setFlag(`cashiea_di_q_${today}`, 'running')
      void generateQuestions(ownerId, today)
    }
  }, [ownerId])
}

async function generateSuggestions(ownerId: string, today: string) {
  const FLAG = `cashiea_di_s_${today}`
  try {
    // Skip if already generated today
    const { data: existing } = await supabase
      .from('ai_predictions')
      .select('id')
      .eq('user_id', ownerId)
      .ilike('title', "Meraj's suggestion%")
      .gte('created_at', today)
      .limit(1)
    if (existing && existing.length > 0) { setFlag(FLAG, 'done'); return }

    const res = await askAssistant(
      'Generate 1-2 actionable business suggestions for tonight based on the current data. Rules: if profits are good (positive month profit + steady sales), give 1 GROWTH suggestion (new product idea, upsell, or expand). If sales today are lower than yesterday, give 2 RECOVERY suggestions (reorder a fast-selling item that is low, and follow up a dormant customer). For Indian retail context, also consider suggesting a product that is commonly needed but might be missing from the catalog (e.g. incense sticks, mobile recharge, tobacco products, sanitary pads, etc.). Be SPECIFIC — use actual product names, customer names, and amounts from the data. Keep each suggestion to 2-3 lines. No markdown headers.',
      false, undefined, 'ask',
    )

    if (res.reply) {
      await supabase.from('ai_predictions').insert({
        user_id: ownerId,
        title: "Meraj's suggestion for tonight",
        description: res.reply,
        status: 'pending',
      })
      toast.success('Meraj has a new suggestion for you', { duration: 5000 })
    }
    setFlag(FLAG, 'done')
  } catch {
    setFlag(FLAG, 'error')
  }
}

async function generateQuestions(ownerId: string, today: string) {
  const FLAG = `cashiea_di_q_${today}`
  try {
    const { data: existing } = await supabase
      .from('ai_predictions')
      .select('id')
      .eq('user_id', ownerId)
      .ilike('title', 'Meraj wants to know%')
      .gte('created_at', today)
      .limit(1)
    if (existing && existing.length > 0) { setFlag(FLAG, 'done'); return }

    const res = await askAssistant(
      'Generate 1-2 personalised questions about this business that will help you (Meraj) serve the owner better. Ask about things you do NOT know yet from the data — supplier details, seasonal patterns, customer preferences, business goals, peak hours, delivery areas, or challenges the owner faces. Make each question SPECIFIC to this shop (reference actual products, customers, or numbers from the data, not generic). Format as direct questions the owner can answer in one sentence.',
      false, undefined, 'ask',
    )

    if (res.reply) {
      await supabase.from('ai_predictions').insert({
        user_id: ownerId,
        title: 'Meraj wants to know',
        description: res.reply,
        status: 'pending',
      })
      toast('Meraj has a question for you', { icon: '❓', duration: 5000 })
    }
    setFlag(FLAG, 'done')
  } catch {
    setFlag(FLAG, 'error')
  }
}

// ════════════════════════════════════════════════════════════════
// BUSINESS INSIGHTS — read / write the business_memory table
// (what Meraj knows about the business + owner-editable notes)
// ════════════════════════════════════════════════════════════════

export interface BusinessMemory {
  summary: string | null
  business_type: string | null
  key_facts: any[] | null
  preferences: Record<string, any> | null
}

export async function fetchBusinessMemory(ownerId: string): Promise<BusinessMemory | null> {
  const { data } = await supabase
    .from('business_memory')
    .select('summary, business_type, key_facts, preferences')
    .eq('user_id', ownerId)
    .maybeSingle()
  return data as BusinessMemory | null
}

export async function saveOwnerNotes(ownerId: string, notes: string): Promise<boolean> {
  const { data: current } = await supabase
    .from('business_memory')
    .select('preferences')
    .eq('user_id', ownerId)
    .maybeSingle()
  const prefs = (current?.preferences && typeof current.preferences === 'object') ? { ...current.preferences } : {}
  prefs.owner_notes = notes
  const { error } = await supabase
    .from('business_memory')
    .update({ preferences: prefs })
    .eq('user_id', ownerId)
  return !error
}
