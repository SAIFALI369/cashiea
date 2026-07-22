// ════════════════════════════════════════════════════════════════
// Shared env helpers — abstracts the Supabase platform difference.
//
// ── History ─────────────────────────────────────────────────
//
// Pre-2025 Supabase injected plain-string env vars in edge
// functions:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// 2025+ Supabase platform (oxlwbxkifyrhggrsaoin-style projects)
// uses a publishable + secret key system. The new env vars
// are PLURAL (note the trailing "S") and contain JSON objects
// keyed by name (e.g. "default"):
//   SUPABASE_URL
//   SUPABASE_PUBLISHABLE_KEYS   →  { "default": "sb_publishable_..." }
//   SUPABASE_SECRET_KEYS        →  { "default": "sb_secret_..." }
//   SUPABASE_JWKS_URL           →  https://.../.well-known/jwks.json
//
// This helper:
//   1. Tries the new plural names first, parses the JSON, and
//      returns the "default" key.
//   2. Falls back to the legacy singular names (plain strings).
//   3. Throws a clear error if neither is configured, pointing
//      the operator to the right Supabase secret to set.
//
// Same code, same deploy, works on both platforms.
// ════════════════════════════════════════════════════════════════

export const SUPABASE_URL: string = Deno.env.get("SUPABASE_URL") ?? "";

function parseKeyJson(raw: string | undefined, varName: string): string {
  if (!raw) return ""
  // The new env vars hold JSON like {"default":"sb_..."} or sometimes
  // a plain string (legacy fallback). Handle both.
  const trimmed = raw.trim()
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed)
      return obj?.default ?? obj?.[""] ?? ""
    } catch (e) {
      throw new Error(
        `${varName} looks like JSON but couldn't be parsed: ${(e as Error).message}. ` +
        `Either re-set the secret in Supabase, or contact support.`
      )
    }
  }
  // Plain string — legacy or pre-parsed value.
  return trimmed
}

export const SUPABASE_ANON_KEY: string =
  parseKeyJson(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"), "SUPABASE_PUBLISHABLE_KEYS") ||
  parseKeyJson(Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),   "SUPABASE_PUBLISHABLE_KEY")   ||
  Deno.env.get("SUPABASE_ANON_KEY")                       || "";

export const SUPABASE_SERVICE_ROLE_KEY: string =
  parseKeyJson(Deno.env.get("SUPABASE_SECRET_KEYS"), "SUPABASE_SECRET_KEYS") ||
  parseKeyJson(Deno.env.get("SUPABASE_SECRET_KEY"),   "SUPABASE_SECRET_KEY")   ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")                       || "";

export const SUPABASE_JWKS_URL: string = Deno.env.get("SUPABASE_JWKS_URL") ?? "";

/**
 * Throw a clear error if required env vars are missing.
 * Call this at the top of every edge function before doing any work.
 */
export function assertSupabaseEnv(): void {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not set in this edge function's environment");
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      "No Supabase API key found. Set ONE of these as a Supabase secret:\n" +
      "  • SUPABASE_PUBLISHABLE_KEYS  (new platform — JSON: {\"default\":\"...\"})\n" +
      "  • SUPABASE_PUBLISHABLE_KEY    (new platform — plain string)\n" +
      "  • SUPABASE_ANON_KEY           (legacy — plain string)\n" +
      "Then re-deploy the function."
    );
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "No Supabase secret key found. Set ONE of these as a Supabase secret:\n" +
      "  • SUPABASE_SECRET_KEYS  (new platform — JSON: {\"default\":\"...\"})\n" +
      "  • SUPABASE_SECRET_KEY    (new platform — plain string)\n" +
      "  • SUPABASE_SERVICE_ROLE_KEY (legacy — plain string)\n" +
      "Then re-deploy the function."
    );
  }
}
