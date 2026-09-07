import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, AI_FUNCTION_URL } from './supabase'

/**
 * useSpeech — Meraj's voice system.
 *
 * STT (Speech → Text): MediaRecorder captures audio on ANY browser (iOS Safari,
 * Android Chrome, desktop) → POST to the voice-stt edge function → Groq Whisper
 * (whisper-large-v3-turbo) returns the text. Sub-second, Hinglish-native.
 *
 * TTS (Text → Speech): browser speechSynthesis with Indian English / Hindi voice
 * preference. Structured as a pluggable interface — swap in a premium TTS API
 * (ElevenLabs, Cartesia, etc.) by replacing the `speak()` body.
 */

/** Map a speech error code to an honest, actionable message. */
function micErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked — allow it in your browser settings and try again.'
    case 'no-speech':
      return "I couldn't hear that clearly — try speaking a bit louder."
    case 'network':
      return 'Speech recognition needs an internet connection.'
    case 'aborted':
      return '' // user cancelled — no message needed
    default:
      return `Voice error (${code}) — please try again.`
  }
}

// ── TTS voice preference: Indian English > Hindi > English > any ──
let cachedVoice: SpeechSynthesisVoice | null = null
function pickBestVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  // Priority: Indian English, Hindi, any English, first available
  const score = (v: SpeechSynthesisVoice): number => {
    const lang = (v.lang || '').toLowerCase()
    const name = (v.name || '').toLowerCase()
    if (lang === 'en-in') return 100
    if (lang === 'hi-in' || lang === 'hi') return 90
    if (name.includes('india') || name.includes('hindi')) return 85
    if (lang.startsWith('en')) return 50
    return 10
  }
  const sorted = [...voices].sort((a, b) => score(b) - score(a))
  cachedVoice = sorted[0] || null
  return cachedVoice
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  // MediaRecorder works on ALL modern browsers (unlike SpeechRecognition)
  const sttSupported = typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia

  // Preload voices (Chrome loads them async)
  useEffect(() => {
    if (ttsSupported) {
      pickBestVoice()
      window.speechSynthesis?.getVoices()
      // Chrome fires voiceschanged when the list is ready
      const handler = () => { cachedVoice = null; pickBestVoice() }
      window.speechSynthesis?.addEventListener?.('voiceschanged', handler)
      return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', handler)
    }
  }, [ttsSupported])

  // ── TTS unlock: iOS/Android require the FIRST speechSynthesis call to be
  //    inside a user gesture. Speaking a zero-volume utterance on mic-tap
  //    unlocks the engine so later async replies can actually talk. ──
  const unlockTts = useCallback(() => {
    if (ttsSupported) {
      try {
        const u = new SpeechSynthesisUtterance(' ')
        u.volume = 0
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(u)
      } catch { /* ignore */ }
    }
  }, [ttsSupported])

  // ── TTS: speak text aloud ──
  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      if (!ttsSupported || !text.trim()) {
        onDone?.()
        return
      }
      // Strip markdown so it doesn't read asterisks/hashtags aloud
      const clean = text
        .replace(/[#*`>_|]/g, ' ')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links → just the text
        .replace(/₹/g, ' rupees ')
        .replace(/\u20b9/g, ' rupees ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 600) // don't read entire essays aloud

      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(clean)
      const voice = pickBestVoice()
      if (voice) u.voice = voice
      u.lang = voice?.lang || 'en-IN'
      u.rate = 1.05 // slightly faster = more natural
      u.pitch = 1.0
      u.onstart = () => setSpeaking(true)
      u.onend = () => { setSpeaking(false); onDone?.() }
      u.onerror = () => { setSpeaking(false); onDone?.() }
      window.speechSynthesis.speak(u)
    },
    [ttsSupported],
  )

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [ttsSupported])

  // ── STT: record audio → Groq Whisper → text ──
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const cancelledRef = useRef(false)

  /** Stop the mic tracks and drop the recorder ref — does NOT touch chunks. */
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
  }, [])

  const cleanupStream = useCallback(() => {
    stopStream()
    chunksRef.current = []
  }, [stopStream])

  /**
   * stopListening — stop the recording; the onstop handler ASSEMBLES THE
   * AUDIO FIRST and transcribes it. This is "I'm done talking", not cancel.
   */
  const stopListening = useCallback(() => {
    try { mediaRecorderRef.current?.stop() } catch { /* ignore */ }
  }, [])

  /** cancelListening — true cancel: discard audio, transcribe nothing. */
  const cancelListening = useCallback(() => {
    cancelledRef.current = true
    try { mediaRecorderRef.current?.stop() } catch { /* ignore */ }
    cleanupStream()
    setListening(false)
    setTranscribing(false)
  }, [cleanupStream])

  /**
   * startListening — records audio via MediaRecorder, transcribes via Groq Whisper.
   * Works on ALL browsers (iOS Safari, Android Chrome, desktop Firefox, etc.)
   */
  const startListening = useCallback(
    async (onResult: (text: string) => void, onError?: (msg: string) => void): Promise<boolean> => {
      if (!sttSupported) {
        onError?.('Voice input is not supported on this browser.')
        return false
      }

      cancelledRef.current = false
      setListening(true)

      try {
        // 1) Get the mic
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
        streamRef.current = stream

        // 2) Pick the best supported audio format for this browser
        const mimeCandidates = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',        // iOS Safari
          'audio/ogg;codecs=opus',
          'audio/wav',
        ]
        let mimeType = ''
        for (const m of mimeCandidates) {
          if (MediaRecorder.isTypeSupported?.(m)) { mimeType = m; break }
        }

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        mediaRecorderRef.current = recorder
        chunksRef.current = []

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }

        recorder.onstop = async () => {
          // 3) ASSEMBLE THE AUDIO BLOB FIRST — the old code ran cleanupStream()
          //    before this line, which zeroed the chunks and produced an
          //    empty blob every single time ("couldn't hear, speak louder").
          const audioBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
          chunksRef.current = []
          stopStream()
          setListening(false)
          // IMMEDIATELY show "Transcribing…" — the user stopped talking and
          // deserves feedback within 200ms, not 2-4s later when Whisper returns
          setTranscribing(true)
          if (cancelledRef.current) { setTranscribing(false); return }
          if (audioBlob.size < 100) {
            onError?.("I couldn't hear that clearly — try speaking a bit louder.")
            return
          }

          // 4) Convert to base64 and send to Groq Whisper via edge function
          try {
            const reader = new FileReader()
            const base64 = await new Promise<string>((res, rej) => {
              reader.onload = () => res((reader.result as string).split(',')[1])
              reader.onerror = rej
              reader.readAsDataURL(audioBlob)
            })

            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { onError?.('You must be signed in.'); return }

            const sttUrl = AI_FUNCTION_URL.replace('ai-automation', 'voice-stt')
            const res = await fetch(sttUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ audio: base64, mimeType: mimeType || 'audio/webm', language: localStorage.getItem('cashiea_voice_lang') || 'auto' }),
            })
            const data = await res.json().catch(() => ({ error: 'Invalid response' }))
            if (!res.ok) {
              onError?.(data?.error || `Speech recognition failed (HTTP ${res.status})`)
              return
            }
            const text = (data.text || '').trim()
            setTranscribing(false)
            if (text) onResult(text)
            else onError?.("I couldn't hear that clearly — try again.")
          } catch (err) {
            setTranscribing(false)
            onError?.(err instanceof Error ? err.message : 'Speech processing failed.')
          }
        }

        // 5) Start recording — send data chunks every 250ms (prevents mobile
        // browser buffering issues) + auto-stop after 15s safety
        recorder.start(250)
        setTimeout(() => {
          try {
            if (recorder.state === 'recording') recorder.stop()
          } catch { /* already stopped */ }
        }, 15000)

        return true
      } catch (err) {
        cleanupStream()
        setListening(false)
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('NotAllowed') || msg.includes('Permission')) {
          onError?.('Microphone access is blocked — allow it in your browser settings.')
        } else {
          onError?.(`Could not access microphone: ${msg}`)
        }
        return false
      }
    },
    [sttSupported, cleanupStream],
  )

  // ── LIVE LISTENING — pseudo-streaming STT: the mic records in ~3s windows,
  //    each window is transcribed by Groq Whisper and appended live. Works on
  //    EVERY browser (no SpeechRecognition needed) with ~3s text granularity. ──
  const liveActiveRef = useRef(false)
  const liveRecorderRef = useRef<MediaRecorder | null>(null)

  const startLiveListening = useCallback(
    async (onPartial: (text: string, isFinal: boolean) => void, onError?: (msg: string) => void): Promise<boolean> => {
      if (!sttSupported) { onError?.('Voice input is not supported on this browser.'); return false }
      liveActiveRef.current = true
      setListening(true)

      const transcribe = async (blob: Blob): Promise<string> => {
        if (blob.size < 200) return ''
        try {
          const reader = new FileReader()
          const base64 = await new Promise<string>((res, rej) => { reader.onload = () => res((reader.result as string).split(',')[1]); reader.onerror = rej; reader.readAsDataURL(blob) })
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) return ''
          const sttUrl = AI_FUNCTION_URL.replace('ai-automation', 'voice-stt')
          const res = await fetch(sttUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
            body: JSON.stringify({ audio: base64, mimeType: 'audio/webm', language: localStorage.getItem('cashiea_voice_lang') || 'auto' }),
          })
          const data = await res.json().catch(() => ({}))
          return res.ok ? (data.text || '').trim() : ''
        } catch { return '' }
      }

      const runWindow = async (): Promise<string> => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
          const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported?.(m)) || ''
          const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
          liveRecorderRef.current = rec
          const chunks: Blob[] = []
          rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
          const stopped = new Promise<Blob>((resolve) => { rec.onstop = () => resolve(new Blob(chunks, { type: mime || 'audio/webm' })) })
          rec.start(250)
          // Sleep ~3s, but wake within 150ms of a stop request
          await new Promise<void>((r) => {
            const t0 = Date.now()
            const tick = () => { if (!liveActiveRef.current || Date.now() - t0 >= 3000) r(); else setTimeout(tick, 150) }
            tick()
          })
          if (rec.state === 'recording') rec.stop()
          const blob = await stopped
          stream.getTracks().forEach((t) => t.stop())
          return await transcribe(blob)
        } catch { return '' }
      }

      while (liveActiveRef.current) {
        const text = await runWindow()
        if (!liveActiveRef.current) {
          if (text) onPartial(text, true)
          break
        }
        if (text) onPartial(text, false)
      }
      setListening(false)
      return true
    },
    [sttSupported],
  )

  const stopLiveListening = useCallback(() => {
    liveActiveRef.current = false
    try { liveRecorderRef.current?.stop() } catch { /* ignore */ }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true
      try { mediaRecorderRef.current?.stop() } catch { /* ignore */ }
      cleanupStream()
      if (ttsSupported) window.speechSynthesis?.cancel()
    }
  }, [cleanupStream, ttsSupported])

  return {
    speak,
    stopSpeaking,
    speaking,
    unlockTts,
    startListening,
    stopListening,
    cancelListening,
    startLiveListening,
    stopLiveListening,
    listening,
    transcribing,
    sttSupported,
    ttsSupported,
  }
}
