// ════════════════════════════════════════════════════════════════
// DAILY REPORTS (cron job) — generates + sends a daily sales report
// to every active shop's WhatsApp. Runs every 30 min via pg_cron and
// self-filters to shops whose configured report_time_utc matches.
//
// Schedule (one-time, after deploy — see schema-v12.sql):
//   SELECT cron.schedule('daily-reports', '*/30 * * * *', $$...$$);
//
// Source of truth for "today's sales" = public.transactions (POS sales).
// Delivery is claimed per report so concurrent cron invocations and manual
// retries cannot send the same report at the same time.
//
// Deploy: supabase functions deploy daily-reports
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { sendWhatsAppText } from "../_shared/whatsapp.ts";
import { resolveBusiness } from "../_shared/business.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const REPORT_CLAIM_STALE_SECONDS = 900;
const PAGE_SIZE = 1000;
const MAX_TRANSACTIONS = 20_000;

// ─── Helpers ────────────────────────────────────────────────────
function istDate(date = new Date()): string {
  // India has no DST; UTC+05:30 is stable and avoids relying on the function
  // runtime's timezone configuration.
  const ist = new Date(date.getTime() + 5.5 * 3600 * 1000);
  return ist.toISOString().split("T")[0];
}

function startOfISTDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00+05:30`).toISOString();
}

function endOfISTDay(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999+05:30`).toISOString();
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function safeError(error: unknown, fallback = "Report generation failed"): string {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500) || fallback;
}

async function fetchDayTransactions(userId: string, reportDate: string): Promise<any[]> {
  const start = startOfISTDay(reportDate);
  const end = endOfISTDay(reportDate);
  const rows: any[] = [];

  // Supabase REST commonly caps a response at 1,000 rows. Page explicitly so
  // a high-volume shop's report does not silently undercount its sales.
  for (let offset = 0; offset < MAX_TRANSACTIONS; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("total, items, payment_method, status")
      .eq("user_id", userId)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

// ─── Aggregate a shop's sales for the IST day ───────────────────
async function gatherDay(userId: string, reportDate: string) {
  const txns = await fetchDayTransactions(userId, reportDate);
  const completed = txns.filter((t) => t.status === "completed");
  const revenue = completed.reduce((s, t) => s + Number(t.total || 0), 0);

  // Top items by quantity
  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  completed.forEach((t) => {
    (Array.isArray(t.items) ? t.items : []).forEach((it: any) => {
      const key = it?.product_id || it?.name;
      if (!key) return;
      if (!itemMap[key]) itemMap[key] = { name: String(it.name || key).slice(0, 120), qty: 0, revenue: 0 };
      itemMap[key].qty += Number(it.quantity) || 0;
      itemMap[key].revenue += (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    });
  });
  const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 3);

  // Payment-mode breakdown as percentages
  const totalsByMethod: Record<string, number> = {};
  completed.forEach((t) => {
    const method = String(t.payment_method || "other");
    totalsByMethod[method] = (totalsByMethod[method] || 0) + Number(t.total || 0);
  });
  const breakdown: Record<string, number> = {};
  Object.entries(totalsByMethod).forEach(([method, amount]) => {
    breakdown[method] = revenue > 0 ? Math.round((amount / revenue) * 100) : 0;
  });

  return { revenue, count: completed.length, topItems, breakdown };
}

// ─── Format the WhatsApp message (short, scannable) ──────────────
function formatMessage(shopName: string, dateStr: string, data: Awaited<ReturnType<typeof gatherDay>>): string {
  const lines: string[] = [];
  lines.push(`📊 *Daily Report — ${shopName}*`);
  lines.push(`📅 ${dateStr}`);
  lines.push(``);
  lines.push(`💰 *Revenue:* ₹${Number(data.revenue).toFixed(0)}`);
  lines.push(`🧾 *Bills:* ${data.count}`);
  if (data.count > 0) lines.push(`📈 *Avg bill:* ₹${(Number(data.revenue) / data.count).toFixed(0)}`);
  lines.push(``);
  if (data.topItems.length > 0) {
    lines.push(`*Top items:*`);
    data.topItems.forEach((it, i) => {
      lines.push(`${i + 1}. ${it.name} — ${it.qty} pcs (₹${Number(it.revenue).toFixed(0)})`);
    });
    lines.push(``);
  }
  if (Object.keys(data.breakdown).length > 0) {
    lines.push(`*Payments:*`);
    const order = ["upi", "cash", "card", "wallet", "other"];
    order.forEach((method) => {
      if (data.breakdown[method] != null) {
        const emoji = method === "upi" ? "📱" : method === "cash" ? "💵" : method === "card" ? "💳" : method === "wallet" ? "👛" : "🔹";
        lines.push(`${emoji} ${method}: ${data.breakdown[method]}%`);
      }
    });
  }
  lines.push(``);
  lines.push(`— Cashiea`);
  return lines.join("\n");
}

type Shop = {
  id: string;
  company_name?: string | null;
  full_name?: string | null;
  whatsapp_number?: string | null;
  report_time_utc?: string | null;
};

type ExistingReport = { id: string; user_id: string; report_date: string; status: string };
type WorkItem = { shop: Shop; existing: ExistingReport | null; reportDate: string };

// ─── Main ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Cron uses the exact service-role key. A signed-in owner may also request a
  // single manual retry from Failed Jobs; that path is resolved server-side and
  // can never select a different owner from JSON.
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isServiceRole = !!expectedKey && bearer === expectedKey;
  let authenticatedOwnerId: string | null = null;
  if (!isServiceRole) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!anonKey || !authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const business = await resolveBusiness(supabase, user.id);
    if (!business || !business.isOwner) return json({ error: "Only the business owner can retry daily reports" }, 403);
    authenticatedOwnerId = business.ownerId;
  }

  try {
    const body = await req.json().catch(() => ({}));
    let requestedOwnerId: string | null = authenticatedOwnerId || (body.user_id == null ? null : String(body.user_id));
    const explicitReportId = body.report_id == null ? null : String(body.report_id);
    if (requestedOwnerId && !/^[0-9a-f-]{36}$/i.test(requestedOwnerId)) return json({ error: "user_id is invalid" }, 400);
    if (explicitReportId && !/^[0-9a-f-]{36}$/i.test(explicitReportId)) return json({ error: "report_id is invalid" }, 400);

    const manualRetry = !isServiceRole && body.retry === true;
    let explicitReport: ExistingReport | null = null;
    if (explicitReportId) {
      let reportQuery = supabase
        .from("daily_reports")
        .select("id, user_id, report_date, status")
        .eq("id", explicitReportId)
        .maybeSingle();
      if (requestedOwnerId) reportQuery = reportQuery.eq("user_id", requestedOwnerId);
      const { data: report, error: reportError } = await reportQuery;
      if (reportError) return json({ error: "Could not read the requested report" }, 503);
      if (!report) return json({ error: "Daily report not found" }, 404);
      if (requestedOwnerId && report.user_id !== requestedOwnerId) return json({ error: "Report does not belong to this business" }, 403);
      requestedOwnerId = report.user_id;
      explicitReport = report as ExistingReport;
      if (!["pending", "retry", "failed"].includes(explicitReport.status)) {
        return json({ scanned: 1, sent: 0, failed: 0, skipped: 1, message: "Report is already delivered" });
      }
    }

    const today = istDate();
    const nowUtcHHMM = new Date().toISOString().split("T")[1].slice(0, 5);

    let dueQuery = supabase
      .from("profiles")
      .select("id, company_name, full_name, whatsapp_number, report_time_utc")
      .eq("role", "owner")
      .is("business_owner_id", null)
      .not("whatsapp_number", "is", null);
    if (requestedOwnerId) dueQuery = dueQuery.eq("id", requestedOwnerId);
    const { data: dueShops, error: dueError } = await dueQuery;
    if (dueError) return json({ error: "Could not load report recipients" }, 503);

    let retriesQuery = supabase
      .from("daily_reports")
      .select("id, user_id, report_date, status")
      .eq("report_date", explicitReport?.report_date || today)
      .in("status", ["retry", "failed"]);
    if (requestedOwnerId) retriesQuery = retriesQuery.eq("user_id", requestedOwnerId);
    const { data: retries, error: retriesError } = await retriesQuery;
    if (retriesError) return json({ error: "Could not load report retries" }, 503);

    const retryByUser = new Map((retries || []).map((r) => [r.user_id, r as ExistingReport]));
    let processList: WorkItem[];
    if (explicitReport) {
      const shop = (dueShops || []).find((candidate) => candidate.id === explicitReport!.user_id) as Shop | undefined;
      if (!shop) return json({ error: "Report owner is not an active WhatsApp-enabled business" }, 409);
      processList = [{ shop, existing: explicitReport, reportDate: explicitReport.report_date }];
    } else {
      // Include retry rows even when the configured report time has passed or
      // rolled into the next IST day. This was previously queried but omitted.
      processList = (dueShops || [])
        .filter((shop) => {
          const configured = String(shop.report_time_utc || "17:00").slice(0, 5);
          const validTime = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(configured);
          return manualRetry || retryByUser.has(shop.id) || (validTime && configured <= nowUtcHHMM);
        })
        .map((shop) => ({ shop: shop as Shop, existing: retryByUser.get(shop.id) || null, reportDate: today }));
    }

    let generated = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const work of processList) {
      let reportId: string | null = work.existing?.id || null;
      let claimId: string | null = null;
      const isRetry = !!work.existing;
      try {
        const data = await gatherDay(work.shop.id, work.reportDate);
        const message = formatMessage(work.shop.company_name || work.shop.full_name || "Your Shop", work.reportDate, data);

        if (!reportId) {
          const { data: inserted, error: insertError } = await supabase.from("daily_reports").insert({
            user_id: work.shop.id,
            report_date: work.reportDate,
            total_revenue: data.revenue,
            transaction_count: data.count,
            top_items: data.topItems,
            payment_breakdown: data.breakdown,
            message_text: message,
            status: "pending",
          }).select("id, user_id, report_date, status").maybeSingle();
          if (insertError) {
            if (insertError.code !== "23505") throw insertError;
            const { data: existing, error: existingError } = await supabase.from("daily_reports")
              .select("id, user_id, report_date, status")
              .eq("user_id", work.shop.id).eq("report_date", work.reportDate).maybeSingle();
            if (existingError) throw existingError;
            if (!existing || !["pending", "retry", "failed"].includes(existing.status)) { skipped++; continue; }
            reportId = existing.id;
          } else {
            reportId = inserted?.id || null;
            if (!reportId) throw new Error("Daily report was not created");
            generated++;
          }
        }

        claimId = crypto.randomUUID();
        const { data: didClaim, error: claimError } = await supabase.rpc("claim_daily_report", {
          p_report_id: reportId,
          p_owner_id: work.shop.id,
          p_claim_id: claimId,
          p_stale_after_seconds: REPORT_CLAIM_STALE_SECONDS,
        });
        if (claimError) throw new Error("Daily report worker is not available; deploy schema v27 first");
        if (!didClaim) { skipped++; claimId = null; continue; }

        // Refresh the stored report snapshot only after claiming it. The claim
        // token prevents a stale worker from overwriting a newer retry.
        const { error: snapshotError } = await supabase.from("daily_reports").update({
          total_revenue: data.revenue,
          transaction_count: data.count,
          top_items: data.topItems,
          payment_breakdown: data.breakdown,
          message_text: message,
        }).eq("id", reportId).eq("user_id", work.shop.id).eq("report_claim_id", claimId);
        if (snapshotError) throw snapshotError;

        const result = work.shop.whatsapp_number
          ? await sendWhatsAppText(work.shop.whatsapp_number, message)
          : { ok: false, error: "WhatsApp number is missing" };
        if (result.ok) {
          const { error: sentError } = await supabase.from("daily_reports").update({
            status: "sent", sent_at: new Date().toISOString(), error: null,
            report_claimed_at: null, report_claim_id: null,
          }).eq("id", reportId).eq("user_id", work.shop.id).eq("report_claim_id", claimId);
          if (sentError) throw sentError;
          sent++;
        } else {
          const errorMessage = safeError(result.error, "WhatsApp delivery failed");
          const nextStatus = isRetry ? "failed" : "retry";
          const { error: failedUpdateError } = await supabase.from("daily_reports").update({
            status: nextStatus, error: errorMessage,
            report_claimed_at: null, report_claim_id: null,
          }).eq("id", reportId).eq("user_id", work.shop.id).eq("report_claim_id", claimId);
          if (failedUpdateError) throw failedUpdateError;
          if (isRetry) {
            await supabase.from("failed_jobs").insert({
              job_type: "daily_report",
              user_id: work.shop.id,
              payload: { report_id: reportId, phone: work.shop.whatsapp_number },
              error: errorMessage,
              status: "pending",
              last_attempted_at: new Date().toISOString(),
            });
          }
          failed++;
        }
        claimId = null;
      } catch (error) {
        const errorMessage = safeError(error);
        failed++;
        // Never leave a claimed row permanently in progress after a provider,
        // database, or formatting error. The run-id predicate protects a newer
        // worker if this catch executes after a stale takeover.
        if (reportId && claimId) {
          await supabase.from("daily_reports").update({
            status: isRetry ? "failed" : "retry",
            error: errorMessage,
            report_claimed_at: null,
            report_claim_id: null,
          }).eq("id", reportId).eq("user_id", work.shop.id).eq("report_claim_id", claimId);
        }
        console.error(`daily-reports: shop ${work.shop.id} failed:`, errorMessage);
      }
    }

    return json({
      date: today,
      slot_utc: nowUtcHHMM,
      generated,
      sent,
      failed,
      skipped,
      processed: processList.length,
    });
  } catch (error) {
    return json({ error: safeError(error, "Daily report worker failed") }, 500);
  }
});
