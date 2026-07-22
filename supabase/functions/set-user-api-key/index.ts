// ════════════════════════════════════════════════════════════════
// SET USER API KEY
//
// Frontend sends:  { provider, api_key, default_model, base_url? }
// Backend:
//   1. Verifies the user is authenticated.
//   2. Validates the key shape (sk-…, sk-or-…, AIza…, etc.).
//   3. Encrypts + stores it in user_api_keys via the
//      encrypt_user_api_key RPC (uses USER_KEY_ENC_PASS
//      Supabase secret for the passphrase — never in code).
//   4. Sets the user's profile.ai_provider so the AI edge
//      functions route through the user's key.
//
// The plaintext key NEVER leaves this function. The frontend
// only ever sees back the last-4 hint + the provider + model.
//
// To enable, deploy with:
//   supabase secrets set USER_KEY_ENC_PASS=<a-long-random-string>
//
// Deploy:  supabase functions deploy set-user-api-key
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, assertSupabaseEnv } from "../_shared/env.ts";
import { corsHeaders, json } from "../_shared/retry.ts";
import { detectProviderFromKey, PROVIDERS } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    assertSupabaseEnv();
    // Verify the caller
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const apiKey = (body?.api_key ?? "").trim();
    const requestedProvider = (body?.provider ?? "").trim();
    const explicitModel = (body?.default_model ?? "").trim();
    const baseUrl = (body?.base_url ?? "").trim() || null;
    const label = (body?.label ?? "").trim() || null;

    // ── Validate inputs ───────────────────────────────────────
    if (!apiKey) return json({ error: "API key is required" }, 400);

    // Auto-detect the provider from the key shape if not specified.
    const detected = detectProviderFromKey(apiKey);
    const provider = requestedProvider || detected?.provider || "openai";
    if (!PROVIDERS[provider] && provider !== "custom") {
      return json({ error: `Unknown provider: ${provider}. Try one of: ${Object.keys(PROVIDERS).join(", ")}` }, 400);
    }

    // Provider-specific sanity checks (light — just the format)
    if (provider === "openai" && !apiKey.startsWith("sk-")) {
      return json({ error: "OpenAI keys start with 'sk-'. Check your key and try again." }, 400);
    }
    if (provider === "anthropic" && !apiKey.startsWith("sk-ant-")) {
      return json({ error: "Anthropic keys start with 'sk-ant-'. Check your key and try again." }, 400);
    }
    if (provider === "gemini" && !apiKey.startsWith("AIza")) {
      return json({ error: "Google Gemini keys start with 'AIza'. Check your key and try again." }, 400);
    }
    if (provider === "openrouter" && !apiKey.startsWith("sk-or-")) {
      return json({ error: "OpenRouter keys start with 'sk-or-v1-'. Check your key and try again." }, 400);
    }
    if (provider === "custom" && !baseUrl) {
      return json({ error: "Custom provider requires a base_url (e.g. https://api.together.xyz/v1)" }, 400);
    }

    // Length sanity check (most real keys are at least 20 chars)
    if (apiKey.length < 15) {
      return json({ error: "That key is too short. Paste a full API key from your provider's dashboard." }, 400);
    }

    // ── Encryption passphrase (Supabase secret) ──────────────
    const pass = Deno.env.get("USER_KEY_ENC_PASS");
    if (!pass) {
      return json({
        error: "Server is not configured for per-user keys. Set USER_KEY_ENC_PASS with: supabase secrets set USER_KEY_ENC_PASS=<random-string>",
      }, 500);
    }

    // ── Default model ────────────────────────────────────────
    const defaultModel = explicitModel || (PROVIDERS[provider]?.defaultModel ?? "default");

    // ── Service-role client: encrypt + upsert the key ────────
    const adminClient = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { error: rpcErr } = await adminClient.rpc("encrypt_user_api_key", {
      p_user_id: user.id,
      p_provider: provider,
      p_plaintext_key: apiKey,
      p_passphrase: pass,
      p_default_model: defaultModel,
      p_base_url: baseUrl,
      p_label: label,
    });
    if (rpcErr) throw rpcErr;

    // ── Update the user's profile to reflect the new provider ─
    await adminClient
      .from("profiles")
      .update({ ai_provider: provider })
      .eq("id", user.id);

    const hint = apiKey.slice(-4);
    return json({
      ok: true,
      provider,
      hint,
      model: defaultModel,
      baseUrl,
    });
  } catch (e) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});
