// ════════════════════════════════════════════════════════════════
// Cashiea — Multi-Provider AI Edge Function
// Deploy:  supabase functions deploy ai-automation
// Secrets: supabase secrets set OPENAI_API_KEY=sk-...
//          supabase secrets set GEMINI_API_KEY=...
//          supabase secrets set ANTHROPIC_API_KEY=...
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { callAIWithFallback } from "../_shared/ai-call.ts";
import { resolveBusiness } from "../_shared/business.ts";
import { releaseApiUsage } from "../_shared/usage.ts";

// ─── AI calls go through _shared/ai-call.ts (Groq primary + Gemini fallback — same as Meraj chat) ──

// ─── Structured system prompts per task type ────────────────────
// Report sub-types get tailored instructions so output is genuinely
// different (not just a word-swapped prompt).
const SYSTEM_PROMPTS: Record<string, string> = {
  invoice:
    "You are an expert billing assistant for a retail business. Parse the user's request and generate a complete invoice as valid JSON with keys: invoice_number, client_name, client_email, client_address, items (array of {description, quantity, unit_price}), tax_rate (percentage), due_date, notes. Calculate subtotal, tax_amount, and total automatically. Return ONLY valid JSON, no markdown, no preamble.",
  report:
    "You are a senior retail business analyst. Generate a professional report using markdown with clear headings (##), subheadings (###), and bullet points. Always include an Executive Summary, a Findings/Data section, and an Actionable Recommendations section.",
  extract:
    "You are a data extraction specialist for a retail business. Extract structured data from the user's text (customer details, order info, product data). Return ONLY valid JSON with relevant fields. Use descriptive keys. Infer the schema automatically based on the content.",
  summary:
    "You are an expert summarizer for a retail business. Summarize the provided text (sales data, customer feedback, inventory notes) clearly and concisely, preserving key information. Use appropriate formatting for readability.",
  email:
    "You are an expert retail copywriter writing customer-facing emails (win-back offers, promotions, receipts, thank-yous, abandoned-cart nudges). Write a polished, ready-to-send email based on the user's instructions. Match the requested tone. Use a clear subject line and well-structured body with a call to action. Do NOT include placeholders like [Your Name]. Return the email as: first line 'Subject: ...', a blank line, then the body.",
  sentiment:
    "You analyze the sentiment of text (e.g. customer reviews or feedback). Classify it and return ONLY valid JSON with keys: sentiment ('positive','negative','neutral'), score (0.0 to 1.0), confidence (0.0 to 1.0), summary (one short sentence). No markdown.",
};

// Per-report-type prompt framing (genuine structural differences)
// India context for every generated report: Indian currency and number
// formatting, GST-aware analysis, legally careful phrasing.
const INDIA_REPORT_CONTEXT =
  "You are writing for an Indian retail shop owner. Use \u20B9 (rupee) for all amounts and Indian number grouping (lakh/crore) where natural. Remember GST: revenue figures from sales data are typically GST-inclusive unless stated otherwise, GST collected is a liability not income, and CGST/SGST applies intra-state while IGST applies inter-state. Amounts and tax conclusions are informational, not professional advice.\n\n";

function frameReportPrompt(reportType: string, title: string, data: string): string {
  const t = title || `${reportType} Report`;
  switch (reportType) {
    case "financial":
      return `${INDIA_REPORT_CONTEXT}Create a FINANCIAL REPORT titled "${t}". Structure it as:\n1. Executive Summary\n2. Revenue Analysis\n3. Expense Breakdown\n4. Profitability & Margins\n5. Cash Flow Highlights\n6. Recommendations\n\nFocus on numbers, ratios, and financial health. Data:\n${data}`;
    case "sales":
      return `${INDIA_REPORT_CONTEXT}Create a SALES REPORT titled "${t}". Structure it as:\n1. Executive Summary\n2. Pipeline Overview\n3. Win/Loss Analysis\n4. Top Performers & Products\n5. Conversion Funnel\n6. Forecast & Recommendations\n\nFocus on deals, conversion rates, and revenue drivers. Data:\n${data}`;
    case "operations":
      return `${INDIA_REPORT_CONTEXT}Create an OPERATIONS REPORT titled "${t}". Structure it as:\n1. Executive Summary\n2. Throughput & Efficiency\n3. Bottlenecks & Issues\n4. Resource Utilization\n5. Quality Metrics\n6. Process Improvement Recommendations\n\nFocus on efficiency, cycle times, and operational health. Data:\n${data}`;
    default:
      return `${INDIA_REPORT_CONTEXT}Create a CUSTOM business report titled "${t}" with an Executive Summary, Findings, and Recommendations sections based on this data:\n${data}`;
  }
}

// ─── Time & money saved estimates per task (Usage Tracker) ───────
const SAVINGS: Record<string, { time: number; money: number }> = {
  invoice: { time: 15, money: 7.5 },
  report: { time: 45, money: 22.5 },
  extract: { time: 20, money: 10 },
  summary: { time: 25, money: 12.5 },
  email: { time: 10, money: 5 },
  sentiment: { time: 2, money: 1 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 100_000) return json({ error: "Request is too large" }, 413);

  let usageReserved = false;
  let usageConsumed = false;
  let usageOwner = "";
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const business = await resolveBusiness(service, user.id);
    if (!business) return json({ error: "Your account is not linked to exactly one active business" }, 403);
    const { ownerId } = business;
    usageOwner = ownerId;
    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("ai_provider")
      .eq("id", ownerId)
      .maybeSingle();
    if (profileError || !profile) return json({ error: "Could not load business profile" }, 503);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid JSON body" }, 400);
    const taskType = typeof body.task_type === "string" ? body.task_type : "";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 20_000) : "";
    if (!Object.prototype.hasOwnProperty.call(SYSTEM_PROMPTS, taskType) || !prompt) {
      return json({ error: "A supported task_type and prompt are required" }, 400);
    }
    if (body.report_type !== undefined && (typeof body.report_type !== "string" || !["financial", "sales", "operations", "custom"].includes(body.report_type))) return json({ error: "Unsupported report type" }, 400);
    if (body.title !== undefined && (typeof body.title !== "string" || body.title.length > 200)) return json({ error: "title is invalid or too long" }, 400);
    if (body.provider !== undefined && (typeof body.provider !== "string" || body.provider.length > 40)) return json({ error: "provider is invalid" }, 400);

    const { data: reserved, error: reserveError } = await service.rpc("reserve_api_usage", { p_user_id: ownerId, p_amount: 1 });
    if (reserveError) return json({ error: "AI usage service is unavailable; deploy schema v27 first" }, 503);
    if (!reserved) return json({ error: "Usage limit reached. Please upgrade your plan." }, 429);
    usageReserved = true;

    const requestedProvider = typeof body.provider === "string" ? body.provider : "";
    const allowedProviders = ["groq", "openai", "gemini", "anthropic", "vercel_gateway", "openrouter"];
    const provider = allowedProviders.includes(requestedProvider) ? requestedProvider : (profile.ai_provider || "groq");
    const systemPrompt = SYSTEM_PROMPTS[taskType] || "You are a helpful business assistant.";

    let userPrompt = prompt;
    if (taskType === "report") {
      const reportType = typeof body.report_type === "string" ? body.report_type.slice(0, 40) : "custom";
      const title = typeof body.title === "string" ? body.title.slice(0, 200) : "";
      userPrompt = frameReportPrompt(reportType, title, prompt);
    }

    const result = await callAIWithFallback(provider, systemPrompt, userPrompt, 2000, "ai-automation");
    usageConsumed = true;
    const savings = SAVINGS[taskType] || { time: 10, money: 5 };
    await service.from("activity_logs").insert({
      user_id: ownerId,
      action_type: taskType,
      description: `${taskType} generated`,
      time_saved_minutes: savings.time,
      money_saved: savings.money,
      provider,
    });

    return json({ result, provider, task_type: taskType });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  } finally {
    if (usageReserved && !usageConsumed) await releaseApiUsage(
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } }),
      usageOwner,
    );
  }
});
