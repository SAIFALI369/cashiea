import { supabase, edgeFunctionUrl } from './supabase'

/**
 * voiceGreetings — Meraj's living voice.
 *
 * NOT AI-on-every-play: each greeting is generated ONCE through the
 * Meraj voice (meraj-tts: ElevenLabs premium voice), base64-cached in
 * localStorage PER USER (never conflicts between accounts on a shared
 * device), and lives forever after.
 *
 * Events: app open (morning/evening), first sale of the day, a good
 * sale, expense added, new customer joined. Custom greetings: max 3
 * stored, 1 new generation per week (quota resets weekly, never
 * accumulates).
 */

export type GreetEvent = 'open-morning' | 'open-evening' | 'first-sale' | 'sale' | 'expense' | 'customer'

export interface StoredGreeting { text: string; audio: string; format: 'mp3' | 'wav'; at: number }
export interface CustomGreeting extends StoredGreeting { id: string; bind?: GreetEvent | null }

export interface VoiceGreetingState {
  enabled: boolean
  greetings: Partial<Record<GreetEvent, StoredGreeting>>
  customs: CustomGreeting[]
  lastGenWeek: string | null
  lastSaleGreetDate: string | null
  lastPlayed: Record<string, number>
}


// ── GLOBAL SINGLE VOICE — only one Meraj audio may ever play at a time ──
let currentVoice: HTMLAudioElement | null = null
let voiceUnlocked = false

/** Stop whatever Meraj voice is playing (greeting or TTS fallback). */
export function stopAllVoice(): void {
  try { if (currentVoice) { currentVoice.pause(); currentVoice = null } } catch { /* ignore */ }
  try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
}

/** iOS/Safari: audio needs one user gesture before any delayed play. */
export function unlockVoice(): void {
  if (voiceUnlocked) return
  try {
    const a = new Audio('data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAEAAABIADAYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=')
    a.volume = 0.01
    void a.play().then(() => { voiceUnlocked = true }).catch(() => { /* try on next gesture */ })
  } catch { /* ignore */ }
}

const KEY = (userId: string) => `cashiea_vg:${userId}`

export const BUILTIN_TEXTS: Record<GreetEvent, (name: string) => string> = {
  'open-morning': (n) => `Good morning ${n} boss! Aaj ka kya plan hai?`,
  'open-evening': (n) => `Good evening ${n} boss. Aaj to market thoda tight tha — kal phir dhamaka karenge.`,
  'first-sale': (n) => `${n} boss, din ka pehla sale mubarak ho!`,
  'sale': () => `Aaj to mazaa aa gaya boss! Iss sale se din ka quota pura ho gaya.`,
  'expense': () => `Note kar liya boss. Kharcha track mein hai — profit bacha raheinge.`,
  'customer': () => `Naya customer aaya boss! Ab yahan se koi khaali haath nahi jaayega.`,
}

export const EVENT_LABELS: Record<GreetEvent, string> = {
  'open-morning': 'App open — morning',
  'open-evening': 'App open — evening',
  'first-sale': 'First sale of the day',
  'sale': 'A good sale',
  'expense': 'Expense added',
  'customer': 'New customer joined',
}

const COOLDOWN_MS: Partial<Record<GreetEvent, number>> = {
  'sale': 10 * 60 * 1000,
  'expense': 10 * 60 * 1000,
  'customer': 10 * 60 * 1000,
}

function emptyState(): VoiceGreetingState {
  return { enabled: true, greetings: {}, customs: [], lastGenWeek: null, lastSaleGreetDate: null, lastPlayed: {} }
}

export function loadState(userId: string): VoiceGreetingState {
  try {
    const raw = localStorage.getItem(KEY(userId))
    if (!raw) return emptyState()
    const s = JSON.parse(raw) as VoiceGreetingState
    return { ...emptyState(), ...s, greetings: s.greetings || {}, customs: s.customs || [], lastPlayed: s.lastPlayed || {} }
  } catch { return emptyState() }
}

export function saveState(userId: string, s: VoiceGreetingState): void {
  try { localStorage.setItem(KEY(userId), JSON.stringify(s)) } catch { /* storage full — keep going */ }
}

/** One-time generation through Meraj's voice. Returns the stored greeting. */
export async function generateGreeting(text: string): Promise<StoredGreeting> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in first')
  const res = await fetch(edgeFunctionUrl('meraj-tts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ text }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.audio) throw new Error(data?.error || 'Voice generation failed')
  return { text, audio: data.audio, format: data.format === 'wav' ? 'wav' : 'mp3', at: Date.now() }
}

function playStored(g: StoredGreeting): Promise<void> {
  return new Promise((resolve) => {
    try {
      stopAllVoice() // only one voice at a time — greeting vs talking-Meraj
      const audio = new Audio(`data:audio/${g.format};base64,${g.audio}`)
      currentVoice = audio
      audio.onended = () => { if (currentVoice === audio) currentVoice = null; resolve() }
      audio.onerror = () => { if (currentVoice === audio) currentVoice = null; resolve() }
      void audio.play().catch(() => { if (currentVoice === audio) currentVoice = null; resolve() })
    } catch { resolve() }
  })
}

/** ISO week key like 2026-W37 — the custom-generation quota window. */
function isoWeek(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const diff = date.getTime() - firstThursday.getTime()
  const week = 1 + Math.round(diff / (7 * 86400000))
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function customQuota(s: VoiceGreetingState): { canGenerate: boolean; weekKey: string } {
  const weekKey = isoWeek()
  return { canGenerate: s.lastGenWeek !== weekKey, weekKey }
}

/** Generate + store a custom greeting (max 3, one generation per week). */
export async function addCustom(userId: string, text: string, bind: GreetEvent | null): Promise<{ ok: boolean; error?: string; state: VoiceGreetingState }> {
  const s = loadState(userId)
  if (s.customs.length >= 3) return { ok: false, error: 'Custom greeting limit reached (3). Delete one to add another.', state: s }
  const { canGenerate, weekKey } = customQuota(s)
  if (!canGenerate) return { ok: false, error: 'Weekly limit: 1 new voice per week. It resets next week — unused quota does not accumulate.', state: s }
  const g = await generateGreeting(text)
  s.customs = [...s.customs, { ...g, id: crypto.randomUUID(), bind }]
  s.lastGenWeek = weekKey
  saveState(userId, s)
  return { ok: true, state: s }
}

/** The heart: call on real events; guards + caches + plays. */
export async function onVoiceEvent(userId: string, kind: 'open' | 'sale' | 'expense' | 'customer', displayName?: string): Promise<void> {
  try {
    const s = loadState(userId)
    if (!s.enabled) return

    const name = (displayName || 'boss').split(' ')[0]
    let event: GreetEvent | null = null
    if (kind === 'open') {
      const h = new Date().getHours()
      event = h < 16 ? 'open-morning' : 'open-evening'
    } else if (kind === 'sale') {
      const today = new Date().toISOString().slice(0, 10)
      if (s.lastSaleGreetDate !== today) {
        event = 'first-sale'
        s.lastSaleGreetDate = today
        saveState(userId, s) // mark even if playback fails — first is first
      } else {
        event = 'sale'
      }
    } else {
      event = kind
    }
    if (!event) return

    // cooldown so Meraj never nags
    const last = s.lastPlayed[event] || 0
    const cd = COOLDOWN_MS[event] ?? 0
    if (cd && Date.now() - last < cd) return

    // custom override for this event?
    const custom = s.customs.find((c) => c.bind === event)
    if (custom) {
      s.lastPlayed[event] = Date.now()
      saveState(userId, s)
      await playStored(custom)
      return
    }

    let g = s.greetings[event]
    if (!g) {
      // ONE-TIME generation — then it lives forever in local storage
      g = await generateGreeting(BUILTIN_TEXTS[event](name))
      s.greetings[event] = g
    }
    s.lastPlayed[event] = Date.now()
    saveState(userId, s)
    await playStored(g)
  } catch { /* voice must never break the app */ }
}


/** Play a stored {audio, format} object (used by the Audio page). */
export function playStoredKind(g: { audio: string; format: string }): Promise<void> {
  return new Promise((resolve) => {
    try {
      stopAllVoice()
      const audio = new Audio(`data:audio/${g.format};base64,${g.audio}`)
      currentVoice = audio
      audio.onended = () => { if (currentVoice === audio) currentVoice = null; resolve() }
      audio.onerror = () => { if (currentVoice === audio) currentVoice = null; resolve() }
      void audio.play().catch(() => { if (currentVoice === audio) currentVoice = null; resolve() })
    } catch { resolve() }
  })
}
