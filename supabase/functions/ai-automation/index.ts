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

// ─── AI calls now go through the shared _shared/ai-call.ts (Groq + Gemini fallback) ───

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
function frameReportPrompt(reportType: string, title: string, data: string): string {
  const t = title || `${reportType} Report`;
  switch (reportType) {
    case "financial":
      return `Create a FINANCIAL REPORT titled "${t}". Structure it as:\n1. Executive Summary\n2. Revenue Analysis\n3. Expense Breakdown\n4. Profitability & Margins\n5. Cash Flow Highlights\n6. Recommendations\n\nFocus on numbers, ratios, and financial health. Data:\n${data}`;
    case "sales":
      return `Create a SALES REPORT titled "${t}". Structure it as:\n1. Executive Summary\n2. Pipeline Overview\n3. Win/Loss Analysis\n4. Top Performers & Products\n5. Conversion Funnel\n6. Forecast & Recommendations\n\nFocus on deals, conversion rates, and revenue drivers. Data:\n${data}`;
    case "operations":
      return `Create an OPERATIONS REPORT titled "${t}". Structure it as:\n1. Executive Summary\n2. Throughput & Efficiency\n3. Bottlenecks & Issues\n4. Resource Utilization\n5. Quality Metrics\n6. Process Improvement Recommendations\n\nFocus on efficiency, cycle times, and operational health. Data:\n${data}`;
    default:
      return `Create a CUSTOM business report titled "${t}" with an Executive Summary, Findings, and Recommendations sections based on this data:\n${data}`;
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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    // Usage check — honor trial boost
    const { data: profile } = await supabase
      .from("profiles")
      .select("api_usage_count, api_usage_limit, ai_provider, plan, trial_ends_at")
      .eq("id", user.id)
      .single();

    const onTrial = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();
    const limit = onTrial ? Math.max(profile.api_usage_limit, 500) : profile?.api_usage_limit || 50;
    if (profile && profile.api_usage_count >= limit) {
      return json({ error: "Usage limit reached. Please upgrade your plan." }, 429);
    }

    const { task_type, prompt, provider: requestedProvider, report_type, title } = await req.json();
    if (!task_type || !prompt) return json({ error: "task_type and prompt are required" }, 400);

    const provider = requestedProvider || profile?.ai_provider || "openai";
    const systemPrompt = SYSTEM_PROMPTS[task_type] || "You are a helpful business assistant.";

    // Build the actual user prompt (report sub-type framing)
    let userPrompt = prompt;
    if (task_type === "report") {
      userPrompt = frameReportPrompt(report_type || "custom", title || "", prompt);
    }

    const result = await callAIWithFallback(provider, systemPrompt, userPrompt, 2000, "ai-automation");

    // Increment usage + log activity
    await supabase.rpc("increment_api_usage", { user_uuid: user.id });
    const savings = SAVINGS[task_type] || { time: 10, money: 5 };
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      action_type: task_type,
      description: `${task_type} generated`,
      time_saved_minutes: savings.time,
      money_saved: savings.money,
      provider,
    });

    return json({ result, provider, task_type });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
