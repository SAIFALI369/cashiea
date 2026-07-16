// ════════════════════════════════════════════════════════════════
// BizAutomate AI — Multi-Provider AI Edge Function
// Deploy with:  supabase functions deploy ai-automation
// Set secrets:  supabase secrets set OPENAI_API_KEY=sk-...
//               supabase secrets set GEMINI_API_KEY=...
//               supabase secrets set ANTHROPIC_API_KEY=...
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Provider: OpenAI ───────────────────────────────────────────
async function callOpenAI(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  model = "gpt-4o-mini"
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── Provider: Google Gemini ────────────────────────────────────
async function callGemini(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  model = "gemini-1.5-flash"
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${err}`);
  }

  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

// ─── Provider: Anthropic Claude ─────────────────────────────────
async function callAnthropic(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  model = "claude-3-5-sonnet-20241022"
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error: ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

// ─── System prompts per task type ───────────────────────────────
const SYSTEM_PROMPTS: Record<string, string> = {
  invoice:
    "You are an expert billing assistant. Parse the user's request and generate a complete invoice as valid JSON with keys: invoice_number, client_name, client_email, client_address, items (array of {description, quantity, unit_price}), tax_rate (percentage), due_date, notes. Calculate subtotal, tax_amount, and total automatically. Return ONLY valid JSON, no markdown.",
  report:
    "You are a senior business analyst. Generate a professional, well-structured business report based on the data provided. Use clear headings, bullet points, and actionable insights. Format with markdown headings.",
  extract:
    "You are a data extraction specialist. Extract structured data from the user's text. Return ONLY valid JSON with relevant fields. Use descriptive keys. If the data represents contacts, products, transactions, etc., infer the schema automatically.",
  summary:
    "You are an expert summarizer. Summarize the provided text clearly and concisely, preserving key information. Use appropriate formatting (headings, bullet points) for readability.",
};

// ─── Main handler ───────────────────────────────────────────────
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Verify the user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check usage limits
    const { data: profile } = await supabase
      .from("profiles")
      .select("api_usage_count, api_usage_limit, ai_provider, plan")
      .eq("id", user.id)
      .single();

    if (profile && profile.api_usage_count >= profile.api_usage_limit) {
      return new Response(
        JSON.stringify({
          error: "Usage limit reached. Please upgrade your plan.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request
    const { task_type, prompt, provider: requestedProvider } =
      await req.json();

    if (!task_type || !prompt) {
      return new Response(
        JSON.stringify({ error: "task_type and prompt are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const provider = requestedProvider || profile?.ai_provider || "openai";
    const systemPrompt =
      SYSTEM_PROMPTS[task_type] || "You are a helpful business assistant.";

    // Call the appropriate provider
    let result: string;

    switch (provider) {
      case "openai": {
        const key = Deno.env.get("OPENAI_API_KEY");
        if (!key) throw new Error("OPENAI_API_KEY not configured");
        result = await callOpenAI(prompt, systemPrompt, key);
        break;
      }
      case "gemini": {
        const key = Deno.env.get("GEMINI_API_KEY");
        if (!key) throw new Error("GEMINI_API_KEY not configured");
        result = await callGemini(prompt, systemPrompt, key);
        break;
      }
      case "anthropic": {
        const key = Deno.env.get("ANTHROPIC_API_KEY");
        if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
        result = await callAnthropic(prompt, systemPrompt, key);
        break;
      }
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Increment usage
    await supabase.rpc("increment_api_usage", { user_uuid: user.id });

    return new Response(
      JSON.stringify({ result, provider, task_type }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
