// ════════════════════════════════════════════════════════════════
// VOICE STT — Speech-to-Text via Groq Whisper (whisper-large-v3-turbo)
//
// Receives audio (base64 in JSON or raw binary) → Groq Whisper → text.
// This replaces browser SpeechRecognition (which fails on most phones).
//
// Body: { audio: <base64>, mimeType: "audio/webm" | "audio/mp4" | ... }
// Returns: { text: "transcribed speech" }
//
// Deploy:  supabase functions deploy voice-stt
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // ── Auth: only signed-in users can use STT ──
    const authHeader = req.headers.get("authorization") || "";
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // ── Get the audio ──
    const body = await req.json();
    const { audio, mimeType, language } = body;
    if (!audio) return json({ error: "audio (base64) required" }, 400);

    // Decode base64 → binary
    const binaryStr = atob(audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    // ── Groq Whisper STT ──
    const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_KEY) return json({ error: "GROQ_API_KEY not configured" }, 503);

    // Build multipart form
    const formData = new FormData();
    const audioBlob = new Blob([bytes], { type: mimeType || "audio/webm" });
    formData.append("file", audioBlob, "speech.webm");
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("response_format", "json");
    // Language: auto-detect handles Hindi + English + Hinglish mixed natively.
    // Only force a language if the user explicitly chose one.
    const requestedLang = body.language;
    if (requestedLang && requestedLang !== "auto") {
      formData.append("language", requestedLang);
    }

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_KEY}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      let detail = err.slice(0, 300);
      try { const p = JSON.parse(err); if (p?.error?.message) detail = p.error.message.slice(0, 300); } catch { /* raw */ }
      return json({ error: `Whisper error: ${detail}` }, 500);
    }

    const data = await res.json();
    return json({ text: data.text || "" });
  } catch (e) {
    return json({ error: (e as Error)?.message || "STT failed" }, 500);
  }
});
