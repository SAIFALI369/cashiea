import { Sparkles, AlertTriangle } from 'lucide-react'

/**
 * Shown when the app is deployed without Supabase env vars configured.
 * Prevents a confusing white screen / cryptic auth errors in front of
 * customers, and tells the owner exactly what to do.
 */
export default function SetupScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full card p-5 text-center">
        <div className="w-16 h-16 rounded-xl bg-amber-500/15 border border-amber-600/30 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-strong flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg">Cashiea</span>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">One-time setup needed</h1>
        <p className="text-slate-400 text-sm mb-6">
          This app needs to be connected to a Supabase project before customers can sign up. The owner
          needs to add environment variables (this is normal for any new SaaS deploy).
        </p>
        <div className="text-left bg-slate-900/60 rounded-xl p-4 border border-slate-800 text-xs text-slate-300 space-y-2">
          <p className="font-semibold text-white">In your hosting dashboard (e.g. Vercel), set:</p>
          <p><code className="text-brand-300">VITE_SUPABASE_URL</code> — your Supabase project URL</p>
          <p><code className="text-brand-300">VITE_SUPABASE_ANON_KEY</code> — your Supabase anon key</p>
          <p><code className="text-brand-300">VITE_STRIPE_ENABLED</code> — <code>true</code> once payments are set up</p>
          <p className="text-slate-500 pt-2 border-t border-slate-800 mt-2">Find these at supabase.com → Project Settings → API. Then redeploy.</p>
        </div>
      </div>
    </div>
  )
}
