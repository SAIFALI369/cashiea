// ════════════════════════════════════════════════════════════════
// MERAJ TTS — ElevenLabs text-to-speech with graceful fallback.
//
// POST { text } → { audio: <base64 mp3>, format: 'mp3' }
//              → { fallback: true, reason: '...' } when ElevenLabs
//                is unavailable (quota, key, network) — the client
//                then uses the browser's built-in speechSynthesis.
//
// Auth: JWT (any signed-in user). Uses ELEVENLABS_API_KEY secret.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";

const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // warm, clear male voice
const MODEL = "eleven_multilingual_v2";

// Cache quota-exhaustion per Deno isolate so we stop hammering a dead key
let quotaDead = false;
let quotaCheckedAt = 0;
const QUOTA_RETRY_MS = 10 * 60 * 1000; // retry the key every 10 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Auth: any signed-in user can use TTS
    const authHeader = req.headers.get("authorization") || "";
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return json({ error: "text is required" }, 400);
    if (text.length > 3000) return json({ error: "text too long (max 3000 chars)" }, 400);

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) return json({ fallback: true, reason: "no-key" });

    // Skip if quota known dead (per isolate, retried every 10 min)
    if (quotaDead && Date.now() - quotaCheckedAt < QUOTA_RETRY_MS) {
      return json({ fallback: true, reason: "quota-exhausted" });
    }

    // ── Call ElevenLabs ──
    const startTime = Date.now();
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL,
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      // 401 = bad key, 422 = quota exceeded, 429 = rate limited
      if (res.status === 401 || res.status === 422 || res.status === 429) {
        quotaDead = true;
        quotaCheckedAt = Date.now();
        return json({ fallback: true, reason: `elevenlabs-${res.status}` });
      }
      return json({ fallback: true, reason: `elevenlabs-${res.status}` });
    }

    // ── Convert audio to base64 ──
    const audioBuffer = await res.arrayBuffer();
    if (audioBuffer.byteLength < 100) {
      return json({ fallback: true, reason: "empty-audio" });
    }

    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(audioBuffer)),
    );

    const elapsed = Date.now() - startTime;
    console.log(`[meraj-tts] generated ${audioBuffer.byteLength} bytes in ${elapsed}ms`);

    return json({
      audio: base64,
      format: "mp3",
      bytes: audioBuffer.byteLength,
      ms: elapsed,
    });
  } catch (e) {
    return json({ fallback: true, reason: (e as Error)?.message || "tts-failed" });
  }
});
