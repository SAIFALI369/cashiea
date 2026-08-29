import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * useBarcodeScanner — real-time barcode/QR detection using the browser's
 * native BarcodeDetector API (Chrome on Android/desktop, Edge).
 *
 * Falls back to manual entry if the API isn't available (iOS Safari).
 *
 * Usage:
 *   const { scanning, startScan, stopScan, supported } = useBarcodeScanner()
 *   startScan((code) => console.log('Detected:', code))
 */

interface DetectedBarcode {
  rawValue: string
  format: string
}

export function useBarcodeScanner() {
  const [scanning, setScanning] = useState(false)
  const [supported, setSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const callbackRef = useRef<((code: string, format: string) => void) | null>(null)
  const detectedRef = useRef(false)

  useEffect(() => {
    // Check support on mount
    setSupported('BarcodeDetector' in window && typeof (window as any).BarcodeDetector === 'function')
    return () => { stopScan() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopScan = useCallback(() => {
    detectedRef.current = false
    setScanning(false)
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) { videoRef.current.srcObject = null }
    detectorRef.current = null
    callbackRef.current = null
  }, [])

  const detectLoop = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current || detectedRef.current) return
    try {
      const video = videoRef.current
      if (video.readyState >= 2) {
        const barcodes: DetectedBarcode[] = await detectorRef.current.detect(video)
        if (barcodes.length > 0 && !detectedRef.current) {
          detectedRef.current = true
          const { rawValue, format } = barcodes[0]
          if (callbackRef.current) callbackRef.current(rawValue, format)
          // Brief pause so the same barcode doesn't fire twice
          setTimeout(() => { detectedRef.current = false }, 1500)
        }
      }
    } catch { /* frame not ready — skip */ }
    if (streamRef.current) {
      rafRef.current = requestAnimationFrame(() => { detectLoop() })
    }
  }, [])

  const startScan = useCallback(async (
    onDetect: (code: string, format: string) => void,
    videoElement?: HTMLVideoElement,
  ): Promise<boolean> => {
    if (!supported) {
      setError('Barcode scanning is not supported on this browser. Use the search field instead.')
      return false
    }

    stopScan()
    setError(null)
    callbackRef.current = onDetect

    try {
      // Get the camera (rear-facing for barcode scanning)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream

      const video = videoElement || videoRef.current
      if (!video) {
        // Create a video element if not provided
        const el = document.createElement('video')
        el.setAttribute('playsinline', 'true')
        el.style.display = 'none'
        document.body.appendChild(el)
        videoRef.current = el
      } else {
        videoRef.current = video
      }

      videoRef.current!.srcObject = stream
      await videoRef.current!.play()

      // Create the barcode detector with common retail formats
      const BarcodeDetectorClass = (window as any).BarcodeDetector
      detectorRef.current = new BarcodeDetectorClass({
        formats: [
          'ean_13', 'ean_8', 'code_128', 'code_39', 'code_93',
          'upc_a', 'upc_e', 'qr_code', 'data_matrix', 'pdf417',
        ],
      })

      setScanning(true)
      detectLoop()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('NotAllowed') || msg.includes('Permission')) {
        setError('Camera access is blocked — allow it in your browser settings.')
      } else {
        setError(`Could not access camera: ${msg}`)
      }
      stopScan()
      return false
    }
  }, [supported, stopScan, detectLoop])

  return {
    scanning,
    supported,
    error,
    startScan,
    stopScan,
    videoRef,
  }
}
