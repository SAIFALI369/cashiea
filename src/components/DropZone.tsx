import { useCallback, useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadCloud } from 'lucide-react'

/**
 * DropZone — drag-and-drop file upload wrapper.
 * Wrap any area to make it accept dropped files. Shows a visual overlay
 * when files are dragged over. Also works with click-to-browse.
 *
 * Usage:
 *   <DropZone onFile={(file) => handleFile(file)} accept="image/*">
 *     <div>Drop images here or click to browse</div>
 *   </DropZone>
 */
export function DropZone({
  children,
  onFile,
  accept = 'image/*',
  className = '',
  label = 'Drop file here',
  clickToBrowse = true,
}: {
  children: ReactNode
  onFile: (file: File) => void
  accept?: string
  className?: string
  label?: string
  /** Set false when the wrapped area has its own interactive controls —
   *  only drag-and-drop will attach files, taps are left alone. */
  clickToBrowse?: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current <= 0) { setDragging(false); dragCounter.current = 0 }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    dragCounter.current = 0
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const file = files[0]
      if (accept.split(',').some((a) => file.type.startsWith(a.replace('*', '')))) {
        onFile(file)
      }
    }
  }, [accept, onFile])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!clickToBrowse) return
    // Never hijack taps that belong to interactive children — typing in a
    // wrapped textarea, pressing buttons, selects and links must NOT open
    // the file picker (that made the AI page's keyboard open the gallery).
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, select, button, a, label, [contenteditable="true"], [role="button"], [role="switch"], [role="tab"]')) return
    inputRef.current?.click()
  }, [clickToBrowse])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    e.target.value = ''
  }, [onFile])

  return (
    <div
      className={`relative ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={clickToBrowse ? (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement) === e.currentTarget && inputRef.current?.click() : undefined}
      role={clickToBrowse ? 'button' : undefined}
      tabIndex={clickToBrowse ? 0 : undefined}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
      />
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 rounded-card border-2 border-dashed border-accent bg-accent-soft/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none"
          >
            <UploadCloud className="w-10 h-10 text-accent mb-2" />
            <p className="text-sm font-bold text-accent">{label}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
