// ════════════════════════════════════════════════════════════════
// MERAJ TTS — 3-layer voice cascade:
//
//   1. ElevenLabs eleven_flash_v2_5   → premium warm male voice (mp3)
//   2. Groq Orpheus orpheus-v1-english → GROQ_API_KEY      (wav)
//   3. Groq Orpheus                    → GROQ_API_KEY_2 (backup key)
//
//   All layers failed → { fallback: true, reason } → the client
//   uses the browser's built-in speechSynthesis.
//
// POST { text } → { audio: <base64>, format: 'mp3'|'wav', engine, ms }
//
// Auth: JWT (any signed-in user).
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";

const ELEVEN_VOICE = "JBFqnCBsd6RMkjVDRZzb"; // warm, clear male voice
const ELEVEN_MODEL = "eleven_flash_v2_5"; // 0.5 credits/char, ~112ms
const GROQ_TTS_MODEL = "canopylabs/orpheus-v1-english"; // free-tier TTS
const GROQ_TTS_VOICE = "daniel"; // warm male — closest match to the ElevenLabs voice
const ORPHEUS_MAX = 200; // Orpheus hard input limit (chars)
const ELEVEN_MAX = 250; // keep premium replies tight
const FETCH_TIMEOUT_MS = 8000; // never let one layer hang the cascade

// Per-isolate "layer dead" cache: when a layer fails hard (bad key /
// quota / rate limit) we stop hammering it for 10 minutes and go
// straight to the next layer.
const RETRY_MS = 10 * 60 * 1000;
const deadUntil: Record<string, number> = {};
const layerAlive = (n: string) => Date.now() >= (deadUntil[n] || 0);
const markDead = (n: string) => { deadUntil[n] = Date.now() + RETRY_MS; };

/** bytes → base64 in 8KB chunks (spread on huge buffers overflows the stack) */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Trim to max chars on a word boundary — no half-spoken words. */
function capWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

// ── Layer 1: ElevenLabs (premium) ──
async function elevenTTS(text: string): Promise<{ audio: string; format: string } | null> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return null;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text: capWords(text, ELEVEN_MAX),
        model_id: ELEVEN_MODEL,
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.log(`[meraj-tts] elevenlabs ${res.status}: ${err.slice(0, 180)}`);
    // 401 bad key · 402/422 quota · 429 rate limit → dead for 10 min
    if ([401, 402, 422, 429].includes(res.status)) markDead("elevenlabs");
    return null;
  }
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength < 100) return null;
  return { audio: toBase64(buffer), format: "mp3" };
}

// ── Layers 2 + 3: Groq Orpheus (English, warm male voice) ──
async function groqTTS(text: string, key: string, layer: string): Promise<{ audio: string; format: string } | null> {
  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_TTS_MODEL,
      input: capWords(text, ORPHEUS_MAX), // Orpheus hard limit: 200 chars
      voice: GROQ_TTS_VOICE,
      response_format: "wav", // the only format Orpheus supports
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.log(`[meraj-tts] ${layer} orpheus ${res.status}: ${err.slice(0, 180)}`);
    // 400 model_terms_required / bad request → NOT marked dead: terms may be
    // accepted in the Groq console at any moment, so keep trying (cheap).
    if ([401, 402, 403, 422, 429].includes(res.status)) markDead(layer);
    return null;
  }
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength < 100) return null;
  return { audio: toBase64(buffer), format: "wav" };
}

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

    const startTime = Date.now();
    const reasons: string[] = [];

    // ── Layer 1: ElevenLabs premium voice ──
    if (layerAlive("elevenlabs")) {
      try {
        const out = await elevenTTS(text);
        if (out) {
          console.log(`[meraj-tts] elevenlabs ${Math.round(out.audio.length * 3 / 4)}B in ${Date.now() - startTime}ms`);
          return json({ ...out, engine: "elevenlabs", ms: Date.now() - startTime });
        }
        reasons.push("elevenlabs-failed");
      } catch (e) {
        reasons.push(`elevenlabs:${(e as Error)?.name === "TimeoutError" ? "timeout" : "network"}`);
      }
    } else reasons.push("elevenlabs-dead");

    // ── Layers 2 + 3: Groq Orpheus — primary key, then backup key ──
    const groqKeys = [
      { key: Deno.env.get("GROQ_API_KEY"), layer: "groq-1" },
      { key: Deno.env.get("GROQ_API_KEY_2"), layer: "groq-2" },
    ].filter((k) => !!k.key) as { key: string; layer: string }[];

    for (const { key, layer } of groqKeys) {
      if (!layerAlive(layer)) { reasons.push(`${layer}-dead`); continue }
      try {
        const out = await groqTTS(text, key, layer);
        if (out) {
          console.log(`[meraj-tts] ${layer} orpheus ${Math.round(out.audio.length * 3 / 4)}B in ${Date.now() - startTime}ms`);
          return json({ ...out, engine: layer, ms: Date.now() - startTime });
        }
        reasons.push(`${layer}-failed`);
      } catch (e) {
        reasons.push(`${layer}:${(e as Error)?.name === "TimeoutError" ? "timeout" : "network"}`);
      }
    }

    // ── Everything failed → browser speechSynthesis on the client ──
    return json({ fallback: true, reason: reasons.join("|") || "all-tts-dead" });
  } catch (e) {
    return json({ fallback: true, reason: (e as Error)?.message || "tts-failed" });
  }
});
