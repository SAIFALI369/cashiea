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
            position="bottom-center"
            containerStyle={{ zIndex: 9999 }}
            toastOptions={{
              duration: 4000,
              className: 'cashiea-toast cashiea-toast-blank',
              style: {
                padding: '12px 20px',
                maxWidth: 420,
                borderRadius: '9999px',
                background: 'transparent',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                boxShadow: '0 22px 60px -18px rgba(5, 150, 105, 0.65), 0 8px 24px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04) inset',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              },
              success: {
                className: 'cashiea-toast cashiea-toast-success',
                iconTheme: { primary: 'rgba(16, 185, 129, 0.18)', secondary: '#ffffff' },
              },
              error: {
                className: 'cashiea-toast cashiea-toast-error',
                iconTheme: { primary: 'rgba(165, 79, 71, 0.16)', secondary: '#ffffff' },
              },
              loading: {
                className: 'cashiea-toast cashiea-toast-loading',
                iconTheme: { primary: 'rgba(16, 185, 129, 0.18)', secondary: '#ffffff' },
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
)
