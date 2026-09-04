// ════════════════════════════════════════════════════════════════
// VOICE STT — Speech-to-Text via Groq Whisper (whisper-large-v3-turbo)
//
// Receives audio (base64 in JSON) → Groq Whisper → text.
// JWT-auth; every request is bound to one active business and its AI quota.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { resolveBusiness } from "../_shared/business.ts";
import { releaseApiUsage } from "../_shared/usage.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let usageReserved = false;
  let usageConsumed = false;
  let usageOwner = "";
  try {
    const authHeader = req.headers.get("authorization") || "";
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const business = await resolveBusiness(service, user.id);
    if (!business) return json({ error: "Your account is not linked to exactly one active business" }, 403);
    usageOwner = business.ownerId;

    const body = await req.json().catch(() => null);
    const audio = body?.audio;
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType.toLowerCase().split(";", 1)[0].trim() : "audio/webm";
    if (typeof audio !== "string" || !audio) return json({ error: "audio (base64) required" }, 400);
    if (audio.length > 14_000_000) return json({ error: "Audio is too large; record a shorter clip" }, 413);
    if (audio.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(audio)) return json({ error: "audio is not valid base64" }, 400);
    if (!["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-m4a", "audio/mp3"].includes(mimeType)) return json({ error: "Unsupported audio format" }, 400);
    if (body?.language !== undefined && body.language !== "auto" && (typeof body.language !== "string" || !/^[a-z]{2,3}$/i.test(body.language))) return json({ error: "Invalid language" }, 400);

    const { data: reserved, error: reserveError } = await service.rpc("reserve_api_usage", { p_user_id: usageOwner, p_amount: 1 });
    if (reserveError) return json({ error: "AI usage service is unavailable; deploy schema v27 first" }, 503);
    if (!reserved) return json({ error: "Usage limit reached" }, 429);
    usageReserved = true;

    let binaryStr: string;
    try { binaryStr = atob(audio); } catch { return json({ error: "audio is not valid base64" }, 400); }
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_KEY) return json({ error: "GROQ_API_KEY not configured" }, 503);

    const formData = new FormData();
    const extension = mimeType === "audio/mp4" ? "m4a" : mimeType === "audio/mpeg" || mimeType === "audio/mp3" ? "mp3" : mimeType === "audio/wav" ? "wav" : mimeType === "audio/ogg" ? "ogg" : "webm";
    formData.append("file", new Blob([bytes], { type: mimeType }), `speech.${extension}`);
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("response_format", "json");
    const requestedLang = body.language;
    if (requestedLang && requestedLang !== "auto") formData.append("language", requestedLang);

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_KEY}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.text();
      let detail = err.slice(0, 300);
      try { const parsed = JSON.parse(err); if (parsed?.error?.message) detail = String(parsed.error.message).slice(0, 300); } catch { /* raw */ }
      return json({ error: `Whisper error: ${detail}` }, 502);
    }
    usageConsumed = true;
    const data = await res.json();
    return json({ text: typeof data.text === "string" ? data.text.slice(0, 20_000) : "" });
  } catch (e) {
    return json({ error: (e as Error)?.message || "STT failed" }, 500);
  } finally {
    if (usageReserved && !usageConsumed) await releaseApiUsage(
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } }),
      usageOwner,
    );
  }
});
