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

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    chunksRef.current = []
  }, [])

  const stopListening = useCallback(() => {
    cancelledRef.current = true
    try { mediaRecorderRef.current?.stop() } catch { /* ignore */ }
    cleanupStream()
    setListening(false)
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
          cleanupStream()
          setListening(false)
          if (cancelledRef.current) return

          // 3) Assemble the audio blob
          const audioBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
          if (audioBlob.size < 1000) {
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
              body: JSON.stringify({ audio: base64, mimeType: mimeType || 'audio/webm' }),
            })
            const data = await res.json().catch(() => ({ error: 'Invalid response' }))
            if (!res.ok) {
              onError?.(data?.error || `Speech recognition failed (HTTP ${res.status})`)
              return
            }
            const text = (data.text || '').trim()
            if (text) onResult(text)
            else onError?.("I couldn't hear that clearly — try again.")
          } catch (err) {
            onError?.(err instanceof Error ? err.message : 'Speech processing failed.')
          }
        }

        // 5) Start recording — auto-stop after 12 seconds (safety)
        recorder.start()
        setTimeout(() => {
          try {
            if (recorder.state === 'recording') recorder.stop()
          } catch { /* already stopped */ }
        }, 12000)

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
    startListening,
    stopListening,
    listening,
    sttSupported,
    ttsSupported,
  }
}
