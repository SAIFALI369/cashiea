import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // Allow the Arena live-preview host (any *.e2b.app host) in dev so
    // the preview proxy can reach the app. Production is unaffected.
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
