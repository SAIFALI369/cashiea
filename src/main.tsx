import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'

// PWA / offline cache is TEMPORARILY DISABLED (see vite.config selfDestroying).
// On load, remove any leftover service worker + caches so the browser always
// fetches the latest build (this was causing "no UI changes appear"). Remove
// this block when re-enabling offline.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister().catch(() => {})))
      .catch(() => {})
    if (window.caches) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k).catch(() => {})))
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgb(var(--surface))',
                color: 'rgb(var(--fg))',
                borderRadius: '12px',
                border: '1px solid rgb(var(--line))',
                fontSize: '14px',
                boxShadow: '0 8px 24px -8px rgb(var(--shadow) / 0.2)',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
)
