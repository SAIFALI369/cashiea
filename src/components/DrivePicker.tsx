import { useEffect, useRef } from 'react'

/**
 * DrivePicker — opens the Google Picker so the owner can choose exactly which
 * files Cashiea may read (drive.file scope, no Google verification). Needs:
 *   - token: the owner's Google OAuth access token (fetched from the backend)
 *   - developerKey: a Google API key enabled for the Picker API (VITE_GOOGLE_DRIVE_API_KEY)
 * This is an invisible controller component: mount it to open the picker.
 */

const PICKER_SRC = 'https://apis.google.com/js/api.js'

let scriptPromise: Promise<void> | null = null
function loadPickerScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const w = window as any
    if (w.google?.picker) return resolve()
    const s = document.createElement('script')
    s.src = PICKER_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load Google Picker. Check your connection.'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

export interface PickedFile { id: string; name: string; mimeType: string }

export default function DrivePicker({
  token,
  developerKey,
  onPick,
  onError,
}: {
  token: string
  developerKey: string
  onPick: (files: PickedFile[]) => void
  onError: (msg: string) => void
}) {
  const opened = useRef(false)

  useEffect(() => {
    let cancelled = false
    if (opened.current) return
    opened.current = true
    ;(async () => {
      try {
        await loadPickerScript()
        const gapi = (window as any).gapi
        await new Promise<void>((res) => gapi.load('picker', { callback: () => res() }))
        if (cancelled) return
        const g = (window as any).google.picker
        const view = new g.DocsView().setIncludeFolders(true).setMode(g.DocsViewMode.LIST)
        const picker = new g.PickerBuilder()
          .addView(view)
          .enableFeature(g.Feature.MULTISELECT_ENABLED)
          .setOAuthToken(token)
          .setDeveloperKey(developerKey)
          .setTitle('Select files for Meraj to read')
          .setCallback((data: any) => {
            if (data.action === g.Action.PICKED) {
              const files = (data.docs || []).map((d: any) => ({ id: d.id, name: d.name, mimeType: d.mimeType }))
              if (files.length) onPick(files)
            }
          })
          .build()
        picker.setVisible(true)
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Picker failed to open')
      }
    })()
    return () => { cancelled = true }
  }, [token, developerKey, onPick, onError])

  return null
}
