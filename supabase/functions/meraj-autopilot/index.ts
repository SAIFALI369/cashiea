// ════════════════════════════════════════════════════════════════
// MERAJ AUTOPILOT — the self-running manager.
//
// One function, three scheduled jobs (IST):
//   ?job=briefing  08:00 — yesterday's numbers + today's plan, sent to
//                        the OWNER's WhatsApp; auto-drafts the reorder PO.
//   ?job=reminders 09:30 — polite payment reminders to CUSTOMERS with
//                        overdue bills (policy-gated, capped 5/day).
//   ?job=recap     21:00 — what Meraj did today + tomorrow's preview.
//
// Policies live in business_memory.preferences.autopilot (owner-editable
// from Meraj's Plan page). Auth: service-role (pg_cron via vault secret).
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { sendWhatsAppText } from "../_shared/whatsapp.ts";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP = "https://cashiea.vercel.app";

interface AutopilotPrefs {
  briefing: boolean
  recap: boolean
  autoRemind: { enabled: boolean; daysAfterDue: number }
  autoPo: boolean
}
const DEFAULTS: AutopilotPrefs = { briefing: true, recap: true, autoRemind: { enabled: true, daysAfterDue: 3 }, autoPo: true }

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`

async function loadPrefs(userId: string): Promise<AutopilotPrefs> {
  const { data } = await svc.from("business_memory").select("preferences").eq("user_id", userId).maybeSingle()
  const p = (data?.preferences as any)?.autopilot
  if (!p) return { ...DEFAULTS }
  return {
    briefing: p.briefing !== false,
    recap: p.recap !== false,
    autoRemind: { enabled: p.autoRemind?.enabled !== false, daysAfterDue: Number(p.autoRemind?.daysAfterDue) || 3 },
    autoPo: p.autoPo !== false,
  }
}

async function log(userId: string, description: string) {
  try {
    await svc.from("activity_logs").insert({ user_id: userId, action_type: "summary", description, time_saved_minutes: 4, money_saved: 2, provider: "meraj-autopilot" })
  } catch { /* best-effort */ }
}

async function send(to: string | null | undefined, message: string): Promise<boolean> {
  if (!to || !to.trim()) return false
  try {
    const r = await sendWhatsAppText(to.trim(), message)
    return r.ok
  } catch { return false }
}

async function overview(userId: string) {
  const dayAgo = new Date(Date.now() - 86400000).toISOString()
  const [{ data: tx }, { data: inv }, { data: prod }, { data: cr }] = await Promise.all([
    svc.from("transactions").select("total").eq("user_id", userId).eq("status", "completed").gte("created_at", dayAgo),
    svc.from("invoices").select("id, invoice_number, client_name, client_phone, total, due_date, status").eq("user_id", userId).eq("status", "overdue"),
    svc.from("products").select("id, name, stock_quantity, low_stock_threshold, units").eq("user_id", userId).limit(500),
    svc.from("change_requests").select("id").eq("user_id", userId).eq("status", "pending"),
  ])
  const low = (prod || []).filter((p: any) => Number(p.stock_quantity ?? 0) <= Number(p.low_stock_threshold ?? 0))
  return {
    daySales: (tx || []).reduce((s: number, t: any) => s + Number(t.total || 0), 0),
    dayCount: (tx || []).length,
    overdue: inv || [],
    low,
    approvals: (cr || []).length,
  }
}

async function draftReorderPo(userId: string, low: any[]): Promise<number> {
  if (!low.length) return 0
  const items = low.slice(0, 30).map((p: any) => {
    const stock = Number(p.stock_quantity) || 0
    const alert = Number(p.low_stock_threshold) || 5
    const qty = Math.max(alert * 2 - stock, 5)
    return { name: p.name, quantity: qty, unit_price: 0 }
  })
  const { error } = await svc.from("purchase_orders").insert({
    user_id: userId, supplier_id: null, items,
    status: "draft",
    expected_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    notes: "Auto-drafted by Meraj from your low-stock alerts — review prices and send.",
  })
  if (error) return 0
  await log(userId, `Meraj auto-drafted a reorder PO with ${items.length} items`)
  return items.length
}

async function runBriefing(userId: string, name: string, wa: string | null, prefs: AutopilotPrefs) {
  const o = await overview(userId)
  let poItems = 0
  if (prefs.autoPo) poItems = await draftReorderPo(userId, o.low)
  if (!prefs.briefing) return
  const lines = [
    `☀️ Good morning ${name}! Meraj here.`,
    ``,
    `📊 Yesterday: ${inr(o.daySales)} from ${o.dayCount} sale${o.dayCount === 1 ? "" : "s"}.`,
  ]
  if (o.overdue.length) lines.push(`💰 ${o.overdue.length} bill${o.overdue.length > 1 ? "s" : ""} overdue — ${inr(o.overdue.reduce((s: number, i: any) => s + Number(i.total || 0), 0))} to collect.`)
  if (poItems) lines.push(`📦 Reorder: I drafted a PO with ${poItems} item${poItems > 1 ? "s" : ""} — one tap to send.`)
  if (o.approvals) lines.push(`✅ ${o.approvals} team action${o.approvals > 1 ? "s" : ""} waiting for your OK.`)
  lines.push(``, `Your one-tap plan: ${APP}/app/manifest`)
  const ok = await send(wa, lines.join("\n"))
  await log(userId, ok ? "Meraj sent the morning briefing on WhatsApp" : "Morning briefing skipped (no WhatsApp number on profile)")
}

async function runReminders(userId: string, prefs: AutopilotPrefs) {
  if (!prefs.autoRemind.enabled) return 0
  const { data: inv } = await svc.from("invoices")
    .select("id, invoice_number, client_name, client_phone, total, due_date")
    .eq("user_id", userId).eq("status", "overdue").not("client_phone", "is", null).limit(20)
  const cutoff = Date.now() - prefs.autoRemind.daysAfterDue * 86400000
  let sent = 0
  for (const inv2 of inv || []) {
    if (sent >= 5) break
    if (!inv2.due_date || new Date(inv2.due_date).getTime() > cutoff) continue
    const msg = `Namaste! A gentle reminder from ${(await bizName(userId))}: invoice ${inv2.invoice_number} for ${inr(Number(inv2.total) || 0)} was due on ${new Date(inv2.due_date).toLocaleDateString("en-IN")}. Whenever convenient, you can pay via UPI. Thank you! 🙏`
    const ok = await send(inv2.client_phone, msg)
    if (ok) {
      sent++
      try { await svc.from("whatsapp_messages").insert({ user_id: userId, direction: "outbound", to_phone: String(inv2.client_phone).replace(/\D/g, ""), body: msg, status: "sent" }) } catch { /* schema variance */ }
      await log(userId, `Meraj auto-sent a payment reminder to ${inv2.client_name} (₹${inv2.total})`)
    }
  }
  return sent
}

async function bizName(userId: string): Promise<string> {
  const { data } = await svc.from("profiles").select("company_name").eq("id", userId).maybeSingle()
  return data?.company_name || "our shop"
}

async function runRecap(userId: string, name: string, wa: string | null, prefs: AutopilotPrefs) {
  if (!prefs.recap) return
  const o = await overview(userId)
  const dayStart = new Date(Date.now() - 86400000).toISOString()
  const [{ data: todayLogs }, { data: paidInv }, { data: dayExp }] = await Promise.all([
    svc.from("activity_logs").select("description").eq("user_id", userId).eq("provider", "meraj-autopilot")
      .gte("created_at", dayStart).limit(10),
    // Collected in the last ~20h = invoices that turned paid today
    svc.from("invoices").select("total, paid_at").eq("user_id", userId).eq("status", "paid")
      .gte("paid_at", new Date(Date.now() - 20 * 3600000).toISOString()).limit(50),
    svc.from("expenses").select("amount").eq("user_id", userId)
      .gte("date", new Date(Date.now() - 86400000).toISOString().slice(0, 10)).limit(50),
  ])
  const collected = (paidInv || []).reduce((s: number, i: any) => s + Number(i.total || 0), 0)
  const dayCost = (dayExp || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
  const profit = o.daySales - dayCost

  // ── The 9pm Money Report — an employee's end-of-day account.
  //    No hype, no exclamation marks; the last line is the trust-builder
  //    (and the audit trail) — an employee reports what they did. ──
  const lines = [
    `🌙 ${name}, aaj ka hisaab:`,
    ``,
    `Aaj: ${inr(o.daySales)} sales (${o.dayCount} bills), ${inr(profit)} profit after expenses, ${inr(collected)} collected.`,
  ]
  const daysLate = (d: any) => Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 86400000))
  const callList = (o.overdue || [])
    .slice(0, 3)
    .map((i: any) => `${i.client_name} (${inr(Number(i.total) || 0)}, ${daysLate(i.due_date)} din se baaki)`)
  if (callList.length) lines.push(`Kal call karna hai: ${callList.join(", ")}.`)
  if (todayLogs && todayLogs.length) {
    const did = todayLogs.map((l: any) => String(l.description || "").toLowerCase())
    const reminders = did.filter((d: string) => d.includes("reminder")).length
    const drafts = did.filter((d: string) => d.includes("draft") || d.includes("reorder")).length
    const bits: string[] = []
    if (reminders) bits.push(`${reminders} reminder ${reminders === 1 ? "bheja" : "bheje"}`)
    if (drafts) bits.push(`${drafts} restock draft ${drafts === 1 ? "banaya" : "banaye"}`)
    if (bits.length) lines.push(`Aaj maine ${bits.join(", ")}.`)
  }
  const { data: dueSoon } = await svc.from("invoices").select("client_name, total, due_date")
    .eq("user_id", userId).in("status", ["sent", "viewed"]).not("due_date", "is", null)
    .gte("due_date", new Date().toISOString().slice(0, 10)).lte("due_date", new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)).limit(3)
  if (dueSoon && dueSoon.length) lines.push(`Aane wale 3 din mein: ${dueSoon.map((d: any) => `${d.client_name} ${inr(Number(d.total) || 0)}`).join(", ")}`)
  lines.push(``, `Rest well — I'm on watch. Tomorrow's plan: ${APP}/app/manifest`)
  const ok = await send(wa, lines.join("\n"))
  if (ok) await log(userId, "Meraj sent the 9pm money report on WhatsApp")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  const url = new URL(req.url)
  const job = url.searchParams.get("job") || "briefing"
  try {
    const { data: profiles } = await svc.from("profiles")
      .select("id, full_name, whatsapp_number, role, business_owner_id")
      .eq("role", "owner").limit(200)
    let served = 0
    for (const p of profiles || []) {
      try {
        const prefs = await loadPrefs(p.id)
        const name = (p.full_name || "boss").split(" ")[0]
        const wa = p.whatsapp_number
        if (job === "briefing") await runBriefing(p.id, name, wa, prefs)
        else if (job === "reminders") await runReminders(p.id, prefs)
        else if (job === "recap") await runRecap(p.id, name, wa, prefs)
        served++
      } catch { /* one business must never break the run */ }
    }
    return json({ job, served, at: new Date().toISOString() })
  } catch (e) {
    return json({ error: (e as Error)?.message || "autopilot failed" }, 500)
  }
})
