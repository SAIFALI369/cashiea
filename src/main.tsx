import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'

// vite-plugin-pwa registers the versioned service worker in production builds.
// It caches only the immutable app shell; authenticated mutations remain in the
// durable, tenant-bound offline queue in src/lib/offlineQueue.ts.
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
