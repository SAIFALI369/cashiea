import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * useSpeech — browser-native Text-to-Speech + Speech-to-Text.
 * Free (no API keys), instant, works on Chrome/Edge/Safari.
 * Structured so a premium voice (ElevenLabs etc.) can replace `speak` later.
 */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<any>(null)

  // Preload voices (Chrome loads them async)
  useEffect(() => { window.speechSynthesis?.getVoices() }, [])

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) { onEnd?.(); return }
    window.speechSynthesis.cancel()
    const clean = text.replace(/[*#`_>~|\-]/g, '').replace(/\n+/g, '. ').replace(/\.\s*\./g, '.').slice(0, 400)
    if (!clean.trim()) { onEnd?.(); return }
    const u = new SpeechSynthesisUtterance(clean)
    const voices = window.speechSynthesis.getVoices()
    const hiVoice = voices.find((v) => v.lang.startsWith('hi'))
    if (hiVoice) u.voice = hiVoice
    u.lang = hiVoice ? 'hi-IN' : 'en-IN'
    u.rate = 1.05
    u.pitch = 1.1
    u.volume = 1
    u.onstart = () => setSpeaking(true)
    u.onend = () => { setSpeaking(false); onEnd?.() }
    u.onerror = () => { setSpeaking(false); onEnd?.() }
    window.speechSynthesis.speak(u)
  }, [])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  const startListening = useCallback((onResult: (text: string) => void) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return false
    try { recRef.current?.stop() } catch { /* ignore */ }
    const rec = new SR()
    rec.lang = 'hi-IN'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.continuous = false
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript
      onResult(text)
    }
    recRef.current = rec
    rec.start()
    return true
  }, [])

  const stopListening = useCallback(() => {
    try { recRef.current?.stop() } catch { /* ignore */ }
    setListening(false)
  }, [])

  useEffect(() => () => { try { recRef.current?.stop() } catch { /* ignore */ }; window.speechSynthesis?.cancel() }, [])

  return { speak, stopSpeaking, speaking, startListening, stopListening, listening }
}
