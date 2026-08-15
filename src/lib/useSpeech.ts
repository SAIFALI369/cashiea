import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * useSpeech — browser-native Text-to-Speech + Speech-to-Text.
 * Free (no API keys), instant, works on Chrome/Edge/Safari.
 *
 * Honest failure handling (spec §9): microphone errors are surfaced with a
 * plain-language reason the owner can act on — never swallowed silently.
 * Language matching (spec §10): TTS picks a Hindi or English voice based on
 * the reply's script, so an English answer isn't read in a Hindi voice.
 */

/** Map a SpeechRecognition error code to an honest, actionable message. */
function micErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow mic permission in your browser settings, then tap Meraj again.'
    case 'no-speech':
      return "I couldn't hear that clearly — please try again."
    case 'audio-capture':
      return 'No microphone was found. Connect a mic and try again.'
    case 'network':
      return 'Network problem while listening. Check your connection and try again.'
    case 'aborted':
      return '' // user-initiated stop — stay silent
    case 'language-not-supported':
      return 'Speech input for this language is not supported on this browser.'
    default:
      return 'Sorry, I could not catch that. Please try again.'
  }
}

/** Detect reply language: Devanagari → Hindi voice, otherwise English. */
function detectLang(text: string): 'hi-IN' | 'en-IN' {
  return /[\u0900-\u097F]/.test(text) ? 'hi-IN' : 'en-IN'
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<any>(null)

  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const sttSupported =
    typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  // Preload voices (Chrome loads them async)
  useEffect(() => { if (ttsSupported) window.speechSynthesis?.getVoices() }, [ttsSupported])

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!ttsSupported) { onEnd?.(); return }
      window.speechSynthesis.cancel()
      const clean = text.replace(/[*#`_>~|\-]/g, '').replace(/\n+/g, '. ').replace(/\.\s*\./g, '.').slice(0, 400)
      if (!clean.trim()) { onEnd?.(); return }
      const u = new SpeechSynthesisUtterance(clean)
      const lang = detectLang(clean)
      const voices = window.speechSynthesis.getVoices()
      const v = voices.find((x) => x.lang === lang) || voices.find((x) => x.lang.startsWith(lang.slice(0, 2)))
      if (v) u.voice = v
      u.lang = lang
      u.rate = 1.05
      u.pitch = 1.1
      u.volume = 1
      u.onstart = () => setSpeaking(true)
      u.onend = () => { setSpeaking(false); onEnd?.() }
      u.onerror = () => { setSpeaking(false); onEnd?.() }
      window.speechSynthesis.speak(u)
    },
    [ttsSupported]
  )

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [ttsSupported])

  /**
   * Start a push-to-talk listening session.
   *   onResult(text) — fired once with the recognised transcript.
   *   onError(msg)   — fired with an honest message on failure ('' = aborted,
   *                    undefined = nothing to say). NOT called if unsupported.
   * Returns false when speech recognition is unavailable (caller should offer typing).
   */
  const startListening = useCallback(
    (onResult: (text: string) => void, onError?: (msg: string) => void) => {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SR) return false
      try { recRef.current?.stop() } catch { /* ignore */ }
      const rec = new SR()
      rec.lang = 'hi-IN' // Hindi/Hinglish/English transcript (Chrome handles Hinglish well)
      rec.interimResults = false
      rec.maxAlternatives = 1
      rec.continuous = false
      let gotResult = false
      let reported = false
      let timer: ReturnType<typeof setTimeout> | null = null
      const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null } }
      const report = (msg: string) => { if (!reported && msg) { reported = true; onError?.(msg) } }
      rec.onstart = () => {
        setListening(true)
        // Safety net: speech recognition is cloud-based — if the connection
        // drops or the service hangs, stop after 9s instead of listening forever.
        timer = setTimeout(() => { try { rec.stop() } catch { /* ignore */ } }, 9000)
      }
      rec.onresult = (e: any) => { gotResult = true; clearTimer(); onResult(e.results[0][0].transcript) }
      rec.onerror = (e: any) => { setListening(false); clearTimer(); report(micErrorMessage(String(e?.error || ''))) }
      rec.onend = () => {
        setListening(false)
        clearTimer()
        if (!gotResult) report("I didn't catch that — please try again, or type your question.")
      }
      recRef.current = rec
      try {
        rec.start()
      } catch {
        report('Could not start the microphone. Please try again.')
        return false
      }
      return true
    },
    []
  )

  const stopListening = useCallback(() => {
    try { recRef.current?.stop() } catch { /* ignore */ }
    setListening(false)
  }, [])

  useEffect(
    () => () => {
      try { recRef.current?.stop() } catch { /* ignore */ }
      if (ttsSupported) window.speechSynthesis?.cancel()
    },
    [ttsSupported]
  )

  return {
    speak,
    stopSpeaking,
    speaking,
    startListening,
    stopListening,
    listening,
    /** Feature availability — use to give honest "not supported" guidance. */
    supported: { tts: ttsSupported, stt: sttSupported },
  }
}
