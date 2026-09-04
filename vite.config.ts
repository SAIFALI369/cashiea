import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Offline support is enabled through a versioned, build-generated service
// worker. It precaches the immutable app shell while deliberately leaving
// authenticated Supabase responses network-only; private data must never be
// served from a cross-session cache.
const PWA_ENABLED = true
const PWA_OPTIONS = {
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
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
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  // Do not runtime-cache Supabase REST/function responses: they include
  // authenticated business data and may belong to a different account after a
  // sign-out. Offline writes are handled by the authenticated intent queue.
  runtimeCaching: [],
  workbox: {
    cacheId: 'cashiea-v4',
    cleanupOutdatedCaches: true,
    navigateFallbackDenylist: [/^\/api\//],
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  // Env vars come from .env.local (dev) or Vercel env vars (production).
  // Nothing is hardcoded — credentials are rotatable without code changes.
  plugins: [
    react(),
    ...(PWA_ENABLED ? [VitePWA(PWA_OPTIONS)] : []),
  ],
  server: {
    port: 5173,
    open: true,
    // Allow the Arena live-preview host in dev; production is unaffected.
    allowedHosts: ['.e2b.app'],
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
