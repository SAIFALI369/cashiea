import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ScanLine, Loader2 } from 'lucide-react'
import { useBarcodeScanner } from '../lib/useBarcodeScanner'

/**
 * BarcodeScanner — full-screen overlay that opens the camera and detects
 * barcodes/QR codes in real-time. Calls onDetect with the scanned code.
 * Falls back to a manual input if BarcodeDetector isn't supported.
 */
export function BarcodeScanner({ onDetect, onClose }: { onDetect: (code: string) => void; onClose: () => void }) {
  const { scanning, supported, error, startScan, stopScan, videoRef } = useBarcodeScanner()
  const [manualCode, setManualCode] = useState('')
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const hasDetected = useRef(false)

  useEffect(() => {
    if (!supported) return
    startScan((code) => {
      if (!hasDetected.current) {
        hasDetected.current = true
        onDetect(code)
      }
    }, videoElRef.current || undefined)
    return () => { stopScan() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported])

  const handleDetect = (code: string) => {
    if (!hasDetected.current) {
      hasDetected.current = true
      onDetect(code)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex flex-col"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 pt-safe">
          <button onClick={() => { stopScan(); onClose() }} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
            <X className="w-5 h-5" />
          </button>
          <p className="text-sm font-semibold text-white">Scan Barcode</p>
          <div className="w-10" />
        </div>

        {supported ? (
          <>
            {/* Camera view */}
            <div className="flex-1 relative overflow-hidden">
              <video
                ref={videoElRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Scan frame overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-48 border-2 border-white/70 rounded-xl relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-accent rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-accent rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-accent rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-accent rounded-br-lg" />
                  {/* Animated scan line */}
                  <motion.div
                    animate={{ y: [-40, 40, -40] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute left-2 right-2 h-0.5 bg-accent shadow-[0_0_12px_rgb(var(--accent))]"
                  />
                </div>
              </div>
              {/* Dark overlay outside the frame */}
              <div className="absolute inset-0 bg-black/40 pointer-events-none" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }} />
            </div>

            {/* Status */}
            <div className="px-6 py-4 pb-safe">
              <div className="flex items-center justify-center gap-2 text-white/80">
                {scanning ? (
                  <>
                    <ScanLine className="w-4 h-4 animate-pulse" />
                    <p className="text-sm">Point at a barcode…</p>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <p className="text-sm">Starting camera…</p>
                  </>
                )}
              </div>
              {error && <p className="text-center text-xs text-red-400 mt-2">{error}</p>}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <ScanLine className="w-16 h-16 text-white/30 mb-4" />
            <p className="text-white/70 text-sm text-center mb-6">
              Your browser doesn't support camera barcode scanning.
              <br />Enter the barcode number manually:
            </p>
            <div className="flex items-center gap-2 w-full max-w-xs">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && manualCode.trim() && handleDetect(manualCode.trim())}
                placeholder="e.g. 8901234567890"
                className="flex-1 rounded-control bg-white/10 border border-white/20 px-4 py-3 text-white text-lg font-mono placeholder:text-white/30 outline-none focus:border-accent"
                inputMode="numeric"
                autoFocus
              />
              <button
                onClick={() => manualCode.trim() && handleDetect(manualCode.trim())}
                className="px-4 py-3 rounded-control bg-accent text-accent-fg font-semibold text-sm"
              >
                Find
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
