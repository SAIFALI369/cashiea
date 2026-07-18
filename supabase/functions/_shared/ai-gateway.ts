// ════════════════════════════════════════════════════════════════
// Vercel AI Gateway helper — shared by all AI edge functions.
//
// The gateway is OpenAI-compatible at https://ai-gateway.vercel.sh/v1
// and uses model IDs in the form "provider/model" e.g. "openai/gpt-4o-mini".
//
// Setup (Supabase secret — NEVER commit):
//   supabase secrets set AI_GATEWAY_API_KEY=vck_...
//
// You can override the default model per call via the `model` argument.
// Good defaults for a retail SaaS (cheap + capable):
//   openai/gpt-4o-mini           $0.15/M in, $0.60/M out
//   google/gemini-2.5-flash-lite $0.10/M in, $0.40/M out
//   deepseek/deepseek-v3.1       $0.25/M in, $0.95/M out
// ════════════════════════════════════════════════════════════════

export const GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
export const GATEWAY_DEFAULT_MODEL = "openai/gpt-4o-mini";

/**
 * Call the Vercel AI Gateway (OpenAI-compatible chat completions).
 * Returns { ok, status, value } so it can be wrapped in withRetry.
 */
export async function callGateway(
  systemPrompt: string,
  prompt: string,
  opts: { model?: string; maxTokens?: number; temperature?: number } = {}
): Promise<{ ok: boolean; status: number; value: string }> {
  const key = Deno.env.get("AI_GATEWAY_API_KEY");
  if (!key) throw new Error("AI_GATEWAY_API_KEY not configured (set it with: supabase secrets set AI_GATEWAY_API_KEY=vck_...)");

  const res = await fetch(`${GATEWAY_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model || GATEWAY_DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Surface the gateway's structured errors (e.g. card-required) clearly
    let detail = errText.slice(0, 400);
    try {
      const parsed = JSON.parse(errText);
      if (parsed?.error?.message) detail = parsed.error.message.slice(0, 400);
    } catch { /* keep raw */ }
    // 403 customer_verification_required = no card on file
    if (res.status === 403 && errText.includes("credit card")) {
      throw new Error("AI Gateway needs a credit card on file. Add one at vercel.com → AI → Billing to unlock your free credits.");
    }
    return { ok: false, status: res.status, value: detail };
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return { ok: false, status: 502, value: "Gateway returned no content" };
  return { ok: true, status: 200, value: content as string };
}

/**
 * List the models available through the gateway (calls /v1/models).
 * Useful for a model-picker UI. Returns the raw JSON string.
 */
export async function listGatewayModels(): Promise<string> {
  const key = Deno.env.get("AI_GATEWAY_API_KEY");
  if (!key) throw new Error("AI_GATEWAY_API_KEY not configured");
  const res = await fetch(`${GATEWAY_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gateway models request failed (${res.status}): ${t.slice(0, 200)}`);
  }
  return await res.text();
}
