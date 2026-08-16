import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA / offline cache is DISABLED — the service worker was serving a stale app
// shell so pushed UI updates never appeared. To RE-ENABLE offline later:
//   1) set PWA_ENABLED to true below
//   2) delete public/sw.js (the destroy stub)
//   3) remove the service-worker unregister block in src/main.tsx
const PWA_ENABLED = false
const PWA_OPTIONS = {
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  includeAssets: ['favicon.svg', 'icon-512.png'],
  manifest: {
    name: 'Cashiea — AI Shop Manager',
    short_name: 'Cashiea',
    description: "POS billing, customer tracking & AI automation for India's small shops.",
    theme_color: '#0c1322',
    background_color: '#0c1322',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    icons: [
      { src: '/icon-512.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/rest\//i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-rest',
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
  workbox: { cacheId: 'cashiea-v3', cleanupOutdatedCaches: true },
}

// https://vitejs.dev/config/
export default defineConfig({
  // Force the LIVE Supabase project into the build regardless of what
  // CI/Vercel env vars say (they were stuck on the abandoned old project).
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://prwvaetatdidsugczluv.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3ZhZXRhdGRpZHN1Z2N6bHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDUzNTgsImV4cCI6MjEwMTQyMTM1OH0.OasYlwTZh-Uvpv69hbfTq60VPtj6DN2OFQIj1GPlc30'),
  },
  plugins: [
    react(),
    ...(PWA_ENABLED ? [VitePWA(PWA_OPTIONS)] : []),
  ],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    // Code-split heavy libs into their own chunks so they only load
    // when actually used. No feature changes — just faster initial load.
    rollupOptions: {
      output: {
        manualChunks: {
          // PDF generation (jspdf is ~300KB) — only loads on the Invoices page
          'pdf': ['jspdf'],
          // Supabase client — large, used app-wide so kept separate
          'supabase': ['@supabase/supabase-js'],
          // AI SDK — only used by the standalone test script, keep out of main
          'ai-sdk': ['ai', '@ai-sdk/openai-compatible'],
          // Icons — tree-shaken but grouped
          'icons': ['lucide-react'],
          // Router
          'router': ['react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
