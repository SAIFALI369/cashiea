// ════════════════════════════════════════════════════════════════
// AUTOMATION ENGINE — Cashiea's autonomous departments.
//
// Driven by pg_cron `automation-heartbeat` every 30 min (service role)
// or manually by the owner from the Command Center (JWT, ?job=run).
//
// Departments (each gated by an automation_rules row + guardrails):
//   self_order     — Autonomous Procurement: velocity-sized PO,
//                    auto-sent to the supplier, undoable.
//   churn_winback  — Marketing Director: dormant-customer win-back
//                    with personalised offers (capped/day).
//   ar_escalation  — Autonomous CFO: overdue reminders that escalate
//                    friendly → firm → final (+ split-payment offer).
//   cash_runway    — CFO: predicts a cash gap days ahead and alerts.
//   expiry_guard   — Procurement: bundles expiring stock with a
//                    high-margin partner before it's wasted.
//
// Every action writes an automation_events receipt (the Command
// Center cards) — Cashiea shows its work, never acts invisibly.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { sendWhatsAppText } from "../_shared/whatsapp.ts";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP = "https://cashiea.vercel.app";
const DAY = 86400000;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

// ── Rule defaults (guardrails the owner can tune in Command Center) ──
const RULES: Record<string, { config: Record<string, number>; daily: boolean }> = {
  self_order: { config: { maxOrderValue: 15000, leadDays: 3, coverDays: 7 }, daily: false },
  churn_winback: { config: { dormantDays: 45, discountPercent: 20, maxPerDay: 3 }, daily: true },
  ar_escalation: { config: { friendlyDays: 3, firmDays: 10, finalDays: 21, maxPerDay: 5 }, daily: true },
  cash_runway: { config: { horizonDays: 7 }, daily: true },
  expiry_guard: { config: { daysAhead: 3 }, daily: true },
};

type Rule = { type: string; enabled: boolean; config: Record<string, number>; last_run_at: string | null };

async function loadRules(userId: string): Promise<Record<string, Rule>> {
  const { data } = await svc.from("automation_rules").select("type,enabled,config,last_run_at").eq("user_id", userId);
  const out: Record<string, Rule> = {};
  for (const t of Object.keys(RULES)) {
    const row = (data || []).find((r: any) => r.type === t);
    out[t] = {
      type: t,
      enabled: row ? row.enabled !== false : true, // autonomous by default, owner can switch off
      config: { ...RULES[t].config, ...((row?.config as any) || {}) },
      last_run_at: row?.last_run_at || null,
    };
  }
  return out;
}

async function markRun(userId: string, type: string) {
  try { await svc.from("automation_rules").upsert({ user_id: userId, type, last_run_at: new Date().toISOString() }, { onConflict: "user_id,type" }); } catch { /* best-effort */ }
}

async function recentEvents(userId: string, type: string, sinceMs: number) {
  const { data } = await svc.from("automation_events")
    .select("id,receipt,undo_ref,created_at")
    .eq("user_id", userId).eq("type", type)
    .gte("created_at", new Date(Date.now() - sinceMs).toISOString()).limit(50);
  return data || [];
}

async function event(userId: string, e: {
  type: string; title: string; body: string; severity?: string; money_impact?: number;
  receipt?: any; undo_kind?: string; undo_ref?: string;
}) {
  const { error } = await svc.from("automation_events").insert({
    user_id: userId, type: e.type, title: e.title, body: e.body,
    severity: e.severity || "info", money_impact: e.money_impact || 0,
    receipt: e.receipt || {}, undo_kind: e.undo_kind || null, undo_ref: e.undo_ref || null,
  });
  if (error) console.log(`[automation] event insert failed: ${error.message}`);
  try {
    await svc.from("activity_logs").insert({ user_id: userId, action_type: "summary", description: e.title, time_saved_minutes: 6, money_saved: Math.max(0, e.money_impact || 0) / 100, provider: "automation-engine" });
  } catch { /* best-effort */ }
}

async function wa(to: string | null | undefined, msg: string): Promise<boolean> {
  if (!to || !to.trim()) return false;
  try { return (await sendWhatsAppText(to.trim(), msg)).ok; } catch { return false; }
}

async function profile(userId: string) {
  const { data } = await svc.from("profiles").select("full_name,whatsapp_number,company_name").eq("id", userId).maybeSingle();
  return { name: (data?.full_name || "boss").split(" ")[0], wa: data?.whatsapp_number, biz: data?.company_name || "our shop" };
}

// ════════════════════════════════════════════════════════════════
// 1. AUTONOMOUS PROCUREMENT — self-ordering supply chain
//    Velocity-sized PO, auto-sent to the supplier, undoable.
// ════════════════════════════════════════════════════════════════
async function selfOrder(userId: string, rule: Rule, p: { name: string; wa: string | null; biz: string }) {
  // Never double-order: skip if we already acted in the last 20h
  const recent = await recentEvents(userId, "self_order", 20 * 3600000);
  if (recent.some((r: any) => r.undo_ref)) return;

  const [{ data: products }, { data: txns }, { data: suppliers }] = await Promise.all([
    svc.from("products").select("id,name,stock_quantity,low_stock_threshold,cost").eq("user_id", userId).eq("active", true).limit(1000),
    svc.from("transactions").select("items,status,created_at").eq("user_id", userId).eq("status", "completed").gte("created_at", new Date(Date.now() - 30 * DAY).toISOString()).limit(2000),
    svc.from("suppliers").select("id,name").eq("user_id", userId).limit(50),
  ]);

  // 30-day sales velocity per product
  const sold: Record<string, number> = {};
  for (const t of txns || []) for (const it of (t.items as any[]) || []) {
    const pid = it?.product_id || it?.productId;
    if (pid) sold[pid] = (sold[pid] || 0) + (Number(it?.quantity) || 0);
  }

  const low = (products || []).filter((x: any) => Number(x.stock_quantity ?? 0) <= Number(x.low_stock_threshold ?? 0));
  if (!low.length) return;

  const lead = rule.config.leadDays, cover = rule.config.coverDays;
  const items = low.slice(0, 30).map((x: any) => {
    const stock = Number(x.stock_quantity) || 0, alert = Number(x.low_stock_threshold) || 5;
    const velocity = (sold[x.id] || 0) / 30;
    const byVelocity = Math.ceil(velocity * (lead + cover)) - stock;
    const byAlert = alert * 2 - stock;
    return { name: x.name, product_id: x.id, quantity: Math.min(200, Math.max(5, byVelocity > 0 ? byAlert > 0 ? Math.max(byVelocity, byAlert) : byVelocity : byAlert)), unit_price: Number(x.cost) || 0 };
  }).filter((i: any) => i.quantity > 0);
  if (!items.length) return;

  const total = items.reduce((s: number, i: any) => s + i.quantity * i.unit_price, 0);

  // Guardrail: over budget → ask, don't act
  if (total > rule.config.maxOrderValue) {
    await event(userId, {
      type: "self_order", severity: "warning",
      title: `Reorder needs your OK — ${inr(total)} is above your ${inr(rule.config.maxOrderValue)} limit`,
      body: `${items.length} items are low. Approve it on the Auto-reorder page and I'll send it in one tap.`,
      money_impact: total,
      receipt: { items: items.slice(0, 12), total, limit: rule.config.maxOrderValue, approveUrl: `${APP}/app/auto-reorder` },
    });
    return;
  }

  const poNumber = `PO-${Date.now().toString().slice(-6)}`;
  const { data: po, error: poErr } = await svc.from("purchase_orders").insert({
    user_id: userId, supplier_id: null, po_number: poNumber, items,
    subtotal: total, tax_amount: 0, total, status: "sent",
    expected_date: new Date(Date.now() + (lead + 1) * DAY).toISOString().slice(0, 10),
    notes: `Auto-ordered by Cashiea (${items.length} items, velocity-sized). Undo available for 24h.`,
  }).select("id").single();
  if (poErr || !po) return;

  // Send to the first supplier (WhatsApp if configured + number on file)
  let sentTo = "drafted";
  const { data: sup } = await svc.from("suppliers").select("id,name,phone").eq("user_id", userId).not("phone", "is", null).limit(1).maybeSingle().then((r: any) => r).catch(() => ({ data: null }));
  if (sup?.phone) {
    const msg = [`Purchase order ${poNumber} from ${p.biz}:`, "", ...items.slice(0, 10).map((i: any) => `• ${i.name} × ${i.quantity}`), "", `Total: ${inr(total)}. Expected delivery ${new Date(Date.now() + (lead + 1) * DAY).toLocaleDateString("en-IN")}. Bulk rates appreciated as always 🙏`].join("\n");
    if (await wa(sup.phone, msg)) sentTo = sup.name;
  }
  if (p.wa) {
    await wa(p.wa, [`📦 ${p.name}, I placed a reorder with ${sentTo === "drafted" ? "your supplier list" : sentTo}: ${items.length} items, ${inr(total)}.`, `Expected delivery ${new Date(Date.now() + (lead + 1) * DAY).toLocaleDateString("en-IN")}.`, `Undo any time: ${APP}/app/command-center`].join("\n"));
  }

  await event(userId, {
    type: "self_order", severity: "success",
    title: `I reordered ${items.length} items ${sentTo !== "drafted" ? `— sent to ${sentTo}` : "— PO ready"}`,
    body: `Stock was running out in the ${lead + cover}-day window. Order value ${inr(total)}. Undo it with one tap if this is wrong.`,
    money_impact: total,
    undo_kind: "cancel_po", undo_ref: po.id,
    receipt: { poNumber, items: items.slice(0, 12), total, sentTo, expected: new Date(Date.now() + (lead + 1) * DAY).toISOString().slice(0, 10) },
  });
}

// ════════════════════════════════════════════════════════════════
// 2. MARKETING DIRECTOR — churn alarm & personalised win-back
// ════════════════════════════════════════════════════════════════
async function churnWinback(userId: string, rule: Rule, p: { name: string; wa: string | null; biz: string }) {
  const cutoff = new Date(Date.now() - rule.config.dormantDays * DAY).toISOString();
  const { data: dormant } = await svc.from("customers")
    .select("id,name,phone,last_purchase_at,total_spent,total_orders")
    .eq("user_id", userId).not("phone", "is", null)
    .lt("last_purchase_at", cutoff).limit(50);
  if (!dormant || !dormant.length) return;

  const contacted = await recentEvents(userId, "churn_winback", 30 * DAY);
  const contactedIds = new Set(contacted.map((r: any) => r.receipt?.customer_id).filter(Boolean));
  const alreadyToday = await recentEvents(userId, "churn_winback", DAY);
  let sent = alreadyToday.filter((r: any) => r.receipt?.sent).length;

  for (const c of dormant) {
    if (sent >= rule.config.maxPerDay) break;
    if (contactedIds.has(c.id) || !c.phone) continue;
    const { data: lastTx } = await svc.from("transactions")
      .select("items,created_at").eq("user_id", userId).eq("customer_id", c.id)
      .eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const favItems = ((lastTx?.items as any[]) || []).map((i: any) => i?.name).filter(Boolean).slice(0, 2);
    const avgOrder = Number(c.total_orders) > 0 ? Number(c.total_spent) / Number(c.total_orders) : 0;
    const days = Math.floor((Date.now() - new Date(c.last_purchase_at).getTime()) / DAY);
    const msg = favItems.length
      ? `Hi ${c.name}! It's ${p.biz} 🙂 It's been a while — your favourite ${favItems.join(" and ")} is in stock. Show this message for ${rule.config.discountPercent}% off your next visit. See you soon! 🙏`
      : `Hi ${c.name}! It's ${p.biz} 🙂 We miss you — show this message for ${rule.config.discountPercent}% off your next purchase. See you soon! 🙏`;
    const ok = await wa(c.phone, msg);
    sent++;
    await event(userId, {
      type: "churn_winback", severity: ok ? "info" : "warning",
      title: ok ? `Win-back sent to ${c.name} (dormant ${days} days)` : `Win-back ready for ${c.name} — WhatsApp not configured`,
      body: ok ? `Personalised ${rule.config.discountPercent}% offer based on their last purchase${favItems.length ? ` (${favItems.join(", ")})` : ""}.` : `${c.name} hasn't visited in ${days} days. Connect WhatsApp to auto-send offers.`,
      money_impact: avgOrder,
      receipt: { customer_id: c.id, customer: c.name, days, avgOrder, discount: rule.config.discountPercent, favItems, sent: ok },
    });
  }
}

// ════════════════════════════════════════════════════════════════
// 3. AUTONOMOUS CFO — self-healing accounts receivable
//    Tone escalates with days late + payer history; final tone
//    offers a split-payment plan to actually recover the money.
// ════════════════════════════════════════════════════════════════
async function arEscalation(userId: string, rule: Rule, p: { name: string; wa: string | null; biz: string }) {
  const { data: overdue } = await svc.from("invoices")
    .select("id,invoice_number,client_name,client_phone,total,due_date,status")
    .eq("user_id", userId).eq("status", "overdue").not("client_phone", "is", null).limit(30);
  if (!overdue || !overdue.length) return;

  const reminded = await recentEvents(userId, "ar_escalation", 4 * DAY);
  const remindedIds = new Set(reminded.map((r: any) => r.receipt?.invoice_id).filter(Boolean));
  const todayCount = reminded.filter((r: any) => new Date(r.created_at).getTime() > Date.now() - DAY).length;
  let sent = todayCount;

  // Habitual late-payers: how many overdue bills each client has now
  const byClient: Record<string, number> = {};
  for (const i of overdue) byClient[i.client_name] = (byClient[i.client_name] || 0) + 1;

  for (const inv of overdue) {
    if (sent >= rule.config.maxPerDay) break;
    if (remindedIds.has(inv.id) || !inv.due_date) continue;
    const daysLate = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / DAY);
    if (daysLate < rule.config.friendlyDays) continue;
    const habitual = (byClient[inv.client_name] || 0) >= 2;
    const tone: "friendly" | "firm" | "final" =
      daysLate >= rule.config.finalDays ? "final" : daysLate >= rule.config.firmDays || habitual ? "firm" : "friendly";
    const amount = Number(inv.total) || 0;
    const msgs = {
      friendly: `Namaste! A gentle reminder from ${p.biz}: invoice ${inv.invoice_number} for ${inr(amount)} was due ${daysLate} days ago. Whenever convenient 🙏`,
      firm: `Hello, this is a follow-up from ${p.biz} regarding invoice ${inv.invoice_number} (${inr(amount)}), now ${daysLate} days overdue. Kindly clear it at the earliest so we can keep serving you smoothly.`,
      final: `Final notice from ${p.biz}: invoice ${inv.invoice_number} (${inr(amount)}) is ${daysLate} days overdue. To make it easy, we can split it — pay half now, the rest in 15 days. Just reply to arrange. 🙏`,
    };
    const ok = await wa(inv.client_phone, msgs[tone]);
    sent++;
    await event(userId, {
      type: "ar_escalation", severity: tone === "final" ? "warning" : "info",
      title: `${tone === "final" ? "Final notice" : tone === "firm" ? "Firm reminder" : "Gentle reminder"} → ${inv.client_name} (${inr(amount)})`,
      body: `${daysLate} days overdue${habitual ? " · habitual late-payer, tone auto-escalated" : ""}${tone === "final" ? " · split-payment plan offered" : ""}.`,
      money_impact: amount,
      receipt: { invoice_id: inv.id, invoice: inv.invoice_number, client: inv.client_name, daysLate, tone, habitual, amount, sent: ok },
    });
  }
}

// ════════════════════════════════════════════════════════════════
// 4. AUTONOMOUS CFO — predictive cash runway
//    Honest version of "move money": we can't touch banks, but we
//    can see the gap coming days ahead and tell the owner exactly
//    what to do about it.
// ════════════════════════════════════════════════════════════════
async function cashRunway(userId: string, rule: Rule, p: { name: string; wa: string | null; biz: string }) {
  const h = rule.config.horizonDays;
  const monthAgo = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
  const [{ data: sales }, { data: exp }, { data: pos }] = await Promise.all([
    svc.from("transactions").select("total").eq("user_id", userId).eq("status", "completed").gte("created_at", new Date(Date.now() - 30 * DAY).toISOString()).limit(5000),
    svc.from("expenses").select("amount,date").eq("user_id", userId).gte("date", monthAgo).limit(2000),
    svc.from("purchase_orders").select("total,expected_date,status").eq("user_id", userId).neq("status", "cancelled").gte("expected_date", new Date().toISOString().slice(0, 10)).lte("expected_date", new Date(Date.now() + h * DAY).toISOString().slice(0, 10)).limit(50),
  ]);
  const avgIn = (sales || []).reduce((s: number, t: any) => s + Number(t.total || 0), 0) / 30;
  const avgOut = (exp || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0) / 30;
  const poDue = (pos || []).reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const projectedIn = avgIn * h, projectedOut = avgOut * h + poDue;
  if (projectedIn <= 0 || projectedOut <= projectedIn * 1.15) return; // healthy → stay quiet

  const gap = projectedOut - projectedIn;
  await event(userId, {
    type: "cash_runway", severity: "critical",
    title: `Cash gap predicted in the next ${h} days — about ${inr(gap)}`,
    body: `Projected out ${inr(projectedOut)} vs in ${inr(projectedIn)} (incl. ${inr(poDue)} supplier dues). Delay low-priority orders or push collections now.`,
    money_impact: gap,
    receipt: { horizonDays: h, avgDailyIn: avgIn, avgDailyOut: avgOut, poDue, projectedIn, projectedOut, gap },
  });
  if (p.wa) {
    await wa(p.wa, `⚠️ ${p.name}, I project a cash gap of ~${inr(gap)} over the next ${h} days (${inr(projectedOut)} going out vs ${inr(projectedIn)} coming in). Consider delaying low-priority orders and pushing collections. Details: ${APP}/app/command-center`);
  }
}

// ════════════════════════════════════════════════════════════════
// 5. EXPIRY GUARDIAN — bundle expiring stock before it's waste
// ════════════════════════════════════════════════════════════════
async function expiryGuard(userId: string, rule: Rule, _p: { name: string; wa: string | null; biz: string }) {
  const until = new Date(Date.now() + rule.config.daysAhead * DAY).toISOString().slice(0, 10);
  const { data: expiring } = await svc.from("products")
    .select("id,name,stock_quantity,cost,price,expiry_date")
    .eq("user_id", userId).eq("active", true).gt("stock_quantity", 0)
    .not("expiry_date", "is", null).lte("expiry_date", until).limit(20);
  if (!expiring || !expiring.length) return;
  const { data: partners } = await svc.from("products")
    .select("name,price,cost").eq("user_id", userId).eq("active", true).gt("stock_quantity", 0).limit(500);
  let best = { name: "", margin: 0 };
  for (const x of partners || []) {
    const m = Number(x.price || 0) - Number(x.cost || 0);
    if (m > best.margin) best = { name: x.name, margin: m };
  }
  const lines = expiring.map((x: any) => {
    const value = Number(x.stock_quantity) * Number(x.cost || 0);
    const expiry = x.expiry_date?.slice(0, 10) || "soon";
    const bundle = best.name && best.name !== x.name ? `bundle: "Buy ${x.name}, get ${best.name} at 50% off"` : "run a clearance discount";
    return { name: x.name, stock: x.stock_quantity, expiry, value, suggestion: bundle };
  });
  const atStake = lines.reduce((s, l) => s + l.value, 0);
  await event(userId, {
    type: "expiry_guard", severity: "warning",
    title: `${lines.length} item${lines.length > 1 ? "s" : ""} expiring within ${rule.config.daysAhead} days — ${inr(atStake)} at stake`,
    body: `I can bundle them with your highest-margin item${best.name ? ` (${best.name})` : ""} to clear them before they're wasted. Suggested bundles are in the receipt.`,
    money_impact: atStake,
    receipt: { items: lines, bestPartner: best.name },
  });
}

// ════════════════════════════════════════════════════════════════
// Runner + HTTP surface
// ════════════════════════════════════════════════════════════════
async function runForUser(userId: string, force = false) {
  const rules = await loadRules(userId);
  const p = await profile(userId);
  const ran: string[] = [];
  for (const [type, rule] of Object.entries(rules)) {
    if (!rule.enabled) continue;
    if (!force && RULES[type].daily && rule.last_run_at && Date.now() - new Date(rule.last_run_at).getTime() < 22 * 3600000) continue;
    try {
      if (type === "self_order") await selfOrder(userId, rule, p);
      else if (type === "churn_winback") await churnWinback(userId, rule, p);
      else if (type === "ar_escalation") await arEscalation(userId, rule, p);
      else if (type === "cash_runway") await cashRunway(userId, rule, p);
      else if (type === "expiry_guard") await expiryGuard(userId, rule, p);
      ran.push(type);
      if (RULES[type].daily) await markRun(userId, type);
    } catch (e) {
      console.log(`[automation] ${type} failed for ${userId}: ${(e as Error)?.message}`);
    }
  }
  return ran;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const job = url.searchParams.get("job") || "heartbeat";
  const auth = req.headers.get("authorization") || "";
  const isService = auth === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;

  try {
    // ── UNDO: owner JWT only, verifies ownership ──
    if (job === "undo") {
      if (isService) return json({ error: "Use a user token for undo" }, 403);
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
      const { data: { user } } = await anon.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const body = await req.json().catch(() => null);
      const eventId = body?.event_id;
      if (!eventId) return json({ error: "event_id required" }, 400);
      const { data: ev } = await svc.from("automation_events").select("id,user_id,undone,undo_kind,undo_ref,receipt").eq("id", eventId).maybeSingle();
      if (!ev || ev.user_id !== user.id) return json({ error: "Not found" }, 404);
      if (ev.undone) return json({ error: "Already undone" }, 400);
      if (ev.undo_kind === "cancel_po" && ev.undo_ref) {
        const { error: poErr } = await svc.from("purchase_orders").update({ status: "cancelled", notes: "Cancelled by owner (undo) — auto-order reversed." }).eq("id", ev.undo_ref).eq("user_id", user.id);
        if (poErr) return json({ error: poErr.message }, 500);
      }
      const { error } = await svc.from("automation_events").update({ undone: true, seen: true }).eq("id", eventId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, undone: true, kind: ev.undo_kind });
    }

    // ── RUN (owner JWT, this business only) or HEARTBEAT (cron, all owners) ──
    if (job === "run") {
      if (isService) return json({ error: "Use a user token to run" }, 403);
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
      const { data: { user } } = await anon.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const ran = await runForUser(user.id, true);
      return json({ job, ran, at: new Date().toISOString() });
    }

    // heartbeat (cron)
    const { data: owners } = await svc.from("profiles").select("id").eq("role", "owner").limit(200);
    let served = 0;
    for (const o of owners || []) {
      try { await runForUser(o.id); served++; } catch { /* one business never breaks the run */ }
    }
    return json({ job: "heartbeat", served, at: new Date().toISOString() });
  } catch (e) {
    return json({ error: (e as Error)?.message || "automation failed" }, 500);
  }
});
