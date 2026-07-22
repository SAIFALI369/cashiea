// ════════════════════════════════════════════════════════════════
// DAILY REPORTS (cron job) — generates + sends a daily sales report
// to every active shop's WhatsApp. Runs every 30 min via pg_cron and
// self-filters to shops whose configured report_time_utc matches.
//
// Schedule (one-time, after deploy — see schema-v12.sql):
//   SELECT cron.schedule('daily-reports', '*/30 * * * *', $$...$$);
//
// Source of truth for "today's sales" = public.transactions (POS sales)
// — this is where each completed sale lands. Invoices (credit) are
// counted separately in the breakdown as "credit".
//
// WhatsApp delivery: set META Cloud API secrets —
//   supabase secrets set WHATSAPP_TOKEN=EAAG...
//   supabase secrets set WHATSAPP_PHONE_NUMBER_ID=10...
// If not set, the report is still generated + saved (status='failed'
// with a clear error), and logged to failed_jobs — never silent.
//
// Deploy:  supabase functions deploy daily-reports
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
);

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

// ─── Helpers ────────────────────────────────────────────────────
function istDate(): string {
  // Reports cover an IST (Asia/Kolkata) day. Compute today's IST date.
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  return ist.toISOString().split("T")[0];
}

function startOfISTDay(): string {
  const today = istDate();
  // IST 00:00 expressed as UTC = subtract 5.5h
  return new Date(today + "T00:00:00+05:30").toISOString();
}
function endOfISTDay(): string {
  const today = istDate();
  return new Date(today + "T23:59:59+05:30").toISOString();
}

// ─── Aggregate a shop's sales for the IST day ───────────────────
async function gatherDay(userId: string) {
  const start = startOfISTDay();
  const end = endOfISTDay();

  const { data: txns } = await supabase
    .from("transactions")
    .select("total, items, payment_method, status")
    .eq("user_id", userId)
    .gte("created_at", start)
    .lte("created_at", end);

  const completed = (txns || []).filter((t) => t.status === "completed");
  const revenue = completed.reduce((s, t) => s + Number(t.total), 0);

  // Top items by quantity
  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  completed.forEach((t) => {
    (t.items || []).forEach((it: any) => {
      const key = it.product_id || it.name;
      if (!itemMap[key]) itemMap[key] = { name: it.name, qty: 0, revenue: 0 };
      itemMap[key].qty += it.quantity || 0;
      itemMap[key].revenue += (it.quantity || 0) * (it.unit_price || 0);
    });
  });
  const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 3);

  // Payment-mode breakdown as percentages
  const totalsByMethod: Record<string, number> = {};
  completed.forEach((t) => {
    totalsByMethod[t.payment_method] = (totalsByMethod[t.payment_method] || 0) + Number(t.total);
  });
  const breakdown: Record<string, number> = {};
  Object.entries(totalsByMethod).forEach(([m, amt]) => {
    breakdown[m] = revenue > 0 ? Math.round((amt / revenue) * 100) : 0;
  });

  return { revenue, count: completed.length, topItems, breakdown };
}

// ─── Format the WhatsApp message (short, scannable, Swiggy-style) ─
function formatMessage(shopName: string, dateStr: string, data: ReturnType<typeof gatherDay> extends Promise<infer T> ? T : never): string {
  const d = data as any;
  const lines: string[] = [];
  lines.push(`📊 *Daily Report — ${shopName}*`);
  lines.push(`📅 ${dateStr}`);
  lines.push(``);
  lines.push(`💰 *Revenue:* ₹${Number(d.revenue).toFixed(0)}`);
  lines.push(`🧾 *Bills:* ${d.count}`);
  if (d.count > 0) {
    lines.push(`📈 *Avg bill:* ₹${(Number(d.revenue) / d.count).toFixed(0)}`);
  }
  lines.push(``);
  if (d.topItems.length > 0) {
    lines.push(`*Top items:*`);
    d.topItems.forEach((it: any, i: number) => {
      lines.push(`${i + 1}. ${it.name} — ${it.qty} pcs (₹${Number(it.revenue).toFixed(0)})`);
    });
    lines.push(``);
  }
  if (Object.keys(d.breakdown).length > 0) {
    lines.push(`*Payments:*`);
    const order = ["upi", "cash", "card", "wallet", "other"];
    order.forEach((m) => {
      if (d.breakdown[m] != null) {
        const emoji = m === "upi" ? "📱" : m === "cash" ? "💵" : m === "card" ? "💳" : m === "wallet" ? "👛" : "🔹";
        lines.push(`${emoji} ${m}: ${d.breakdown[m]}%`);
      }
    });
  }
  lines.push(``);
  lines.push(`— BizAutomate`);
  return lines.join("\n");
}

// ─── Send via WhatsApp Cloud API ────────────────────────────────
async function sendWhatsApp(toPhone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return { ok: false, error: "WhatsApp Cloud API not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing)" };
  }
  // Normalize: strip non-digits, prefix 91 if 10-digit Indian
  let num = toPhone.replace(/[^\d]/g, "");
  if (num.length === 10) num = "91" + num;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: num,
          type: "text",
          text: { body: message },
        }),
      }
    );
    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: `WA API ${res.status}: ${errBody.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Network: ${e.message}` };
  }
}

// ─── Main ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Service-role only (cron or manual trigger)
  const authHeader = req.headers.get("authorization") || "";
  const expectedKey = SUPABASE_SERVICE_ROLE_KEY;
  if (!expectedKey || !authHeader.endsWith(expectedKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized — service-role only" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const today = istDate();
    const nowUtcHHMM = new Date().toISOString().split("T")[1].slice(0, 5); // "HH:MM"

    // Find active shops due for their report now:
    //  - plan_tier != 'cancelled'
    //  - has a whatsapp_number
    //  - report_time_utc <= current UTC time (within the 30-min slot)
    //  - no daily_reports row exists for today (unique index guards)
    const { data: dueShops } = await supabase
      .from("profiles")
      .select("id, company_name, full_name, whatsapp_number, report_time_utc, plan_tier")
      .neq("plan_tier", "cancelled")
      .not("whatsapp_number", "is", null);

    const eligible = (dueShops || []).filter((s) => {
      const t = (s.report_time_utc || "17:00").slice(0, 5);
      return t <= nowUtcHHMM;
    });

    // Also retry any reports from earlier today that are in 'retry' status
    const { data: retries } = await supabase
      .from("daily_reports")
      .select("id, user_id")
      .eq("report_date", today)
      .eq("status", "retry");

    const retryUserIds = new Set((retries || []).map((r) => r.user_id));
    const processList = eligible.filter((s) => !retryUserIds.has(s.id) || true);
    // (processList includes both fresh-due shops and retry shops; the latter
    // will update their existing row instead of inserting.)

    let generated = 0, sent = 0, failed = 0;

    for (const shop of processList) {
      const isRetry = retryUserIds.has(shop.id);
      try {
        const data = await gatherDay(shop.id);
        const message = formatMessage(shop.company_name || shop.full_name || "Your Shop", today, data);

        // Insert or fetch the report row
        let reportId: string;
        if (isRetry) {
          reportId = (retries || []).find((r) => r.user_id === shop.id)!.id;
        } else {
          const { data: inserted, error } = await supabase.from("daily_reports").insert({
            user_id: shop.id,
            report_date: today,
            total_revenue: data.revenue,
            transaction_count: data.count,
            top_items: data.topItems,
            payment_breakdown: data.breakdown,
            message_text: message,
            status: "pending",
          }).select().single();
          if (error) {
            // unique violation = already generated today, skip
            if (error.code === "23505") continue;
            throw error;
          }
          reportId = inserted.id;
          generated++;
        }

        // Attempt send
        const result = await sendWhatsApp(shop.whatsapp_number!, message);
        if (result.ok) {
          await supabase.from("daily_reports").update({
            status: "sent", sent_at: new Date().toISOString(), error: null,
          }).eq("id", reportId);
          sent++;
        } else {
          // First failure → mark 'retry' (picked up next cron tick ~30 min later)
          // If this WAS already a retry → log to failed_jobs + mark 'failed'
          if (isRetry) {
            await supabase.from("daily_reports").update({
              status: "failed", error: result.error,
            }).eq("id", reportId);
            await supabase.from("failed_jobs").insert({
              job_type: "daily_report",
              user_id: shop.id,
              payload: { report_id: reportId, phone: shop.whatsapp_number },
              error: result.error,
              status: "pending",
              last_attempted_at: new Date().toISOString(),
            });
            failed++;
          } else {
            await supabase.from("daily_reports").update({
              status: "retry", error: result.error,
            }).eq("id", reportId);
            failed++;
          }
        }
      } catch (err) {
        console.error(`daily-reports: shop ${shop.id} failed:`, err.message);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      date: today,
      slot_utc: nowUtcHHMM,
      generated, sent, failed,
      processed: processList.length,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
