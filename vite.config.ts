import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Offline support is enabled through a versioned, build-generated service
// worker. It precaches the immutable app shell while deliberately leaving
// authenticated Supabase responses network-only; private data must never be
// served from a cross-session cache.
const PWA_ENABLED = false // offline mode temporarily disabled (2026-09-13) — re-enable after stabilising
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
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//],
  },
}


/**
 * SPA FALLBACK — static shells for every app route.
 *
 * Some hosting configurations silently drop vercel.json rewrites; the
 * filesystem is the only routing layer that never lies. This plugin
 * copies the built shell to /app/<route>/index.html for every SPA route
 * and to /404.html, so ANY fresh load of any app URL serves the app —
 * no rewrites, no project settings, no service-worker luck required.
 */
const APP_ROUTES = [
  'about', 'account', 'accounts', 'activity', 'api-keys', 'assistant', 'auto-reorder',
  'bank-import', 'brain', 'campaigns', 'cash-flow', 'command-center', 'compliance',
  'connect-apps', 'customers', 'data-entry', 'duplicates', 'email-assistant', 'failed-jobs',
  'goals', 'gst-export', 'integrations', 'invoices', 'khata', 'manifest', 'notifications',
  'permissions', 'pos', 'pricing', 'products', 'profit-dashboard', 'quotations', 'reminders',
  'reports', 'sales', 'scorecard', 'settings', 'snapshot', 'social', 'subscription',
  'suggestions', 'summaries', 'suppliers', 'support', 'team', 'vasooli',
]
function spaFallbackShells(): Plugin {
  return {
    name: 'cashiea-spa-fallback-shells',
    apply: 'build',
    closeBundle() {
      const out = path.resolve(__dirname, 'dist')
      const shell = fs.readFileSync(path.join(out, 'index.html'))
      const targets = ['/app', ...APP_ROUTES.map((r) => `/app/${r}`), '/login']
      for (const t of targets) {
        fs.mkdirSync(path.join(out, t), { recursive: true })
        fs.writeFileSync(path.join(out, t, 'index.html'), shell)
      }
      fs.writeFileSync(path.join(out, '404.html'), shell)
      console.log(`spa-fallback: wrote ${targets.length} route shells + 404.html`)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  // Env vars come from .env.local (dev) or Vercel env vars (production).
  // Nothing is hardcoded — credentials are rotatable without code changes.
  plugins: [
    react(),
    spaFallbackShells(),
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
