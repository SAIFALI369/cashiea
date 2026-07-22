import { AlertTriangle } from 'lucide-react'

/**
 * Shown when the app is deployed without Supabase env vars configured.
 * Prevents a confusing white screen / cryptic auth errors in front of
 * customers, and tells the owner exactly what to do.
 */
export default function SetupScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden" style={{ background: '#fbfbfd' }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,149,0,0.10) 0%, transparent 70%)' }} />

      <div className="relative max-w-[520px] w-full">
        <div className="card p-9 sm:p-10 text-center shadow-apple">
          <div className="w-16 h-16 rounded-2xl bg-[#fff4e5] flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-8 h-8 text-[#ff9500]" strokeWidth={1.75} />
          </div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <svg width={28} height={28} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="setupLogo" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0071e3" />
                  <stop offset="100%" stopColor="#3a8eff" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="24" fill="url(#setupLogo)" />
              <path d="M62 28 A26 26 0 1 0 62 72" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" />
              <circle cx="55" cy="50" r="5" fill="white" />
            </svg>
            <span className="font-semibold text-ink-800 text-[18px] tracking-tight">Cashiea</span>
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-800 mb-2">One-time setup needed.</h1>
          <p className="text-[15px] text-ink-600 mb-6">
            This app needs to be connected to a Supabase project before customers can sign up. The owner
            needs to add environment variables — this is normal for any new SaaS deploy.
          </p>
          <div className="text-left bg-ink-50 rounded-xl p-4 border border-ink-200 text-[13px] text-ink-700 space-y-2">
            <p className="font-medium text-ink-800">In your hosting dashboard (e.g. Vercel), set:</p>
            <p><code className="text-apple-500 font-mono">VITE_SUPABASE_URL</code> — your Supabase project URL</p>
            <p><code className="text-apple-500 font-mono">VITE_SUPABASE_ANON_KEY</code> — your Supabase anon key</p>
            <p><code className="text-apple-500 font-mono">VITE_STRIPE_ENABLED</code> — <code className="text-ink-800">true</code> once payments are set up</p>
            <p className="text-ink-500 pt-2 border-t border-ink-200 mt-2">Find these at supabase.com → Project Settings → API. Then redeploy.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
