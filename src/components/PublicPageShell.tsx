import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

// ────────────────────────────────────────────────────────────────
// PublicPageShell — the shared chrome for standalone public pages
// (pricing, features, about, contact, help, security, blog).
// Same nav/footer language as the landing page so every public
// surface feels like one product. Content pages supply their own
// <main> children.
// ────────────────────────────────────────────────────────────────

export function SiteLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="site-logo-lg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(var(--accent))" />
          <stop offset="100%" stopColor="rgb(var(--gold))" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#site-logo-lg)" />
      <path d="M62 28 A26 26 0 1 0 62 72" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" />
      <circle cx="55" cy="50" r="5" fill="white" />
      <path d="M55 30L55 42M55 58L55 70M35 50L47 50M63 50L75 50" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}

export function Mono({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-mono text-[10px] uppercase tracking-[0.18em] ${className}`}>{children}</span>
}

export function SectionEyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <Mono className={`text-fg-subtle flex items-center justify-center gap-2 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
      {children}
    </Mono>
  )
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line py-10 px-4 mt-auto" style={{ background: 'rgb(var(--paper-deep))' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <div className="max-w-xs">
            <div className="flex items-center gap-2"><SiteLogo size={22} /><span className="font-semibold text-sm">Cashiea</span></div>
            <p className="mt-3 text-xs text-fg-muted leading-relaxed">POS, CRM, GST billing, khata, WhatsApp automation and AI — built for small Indian shops.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-xs">
            <div className="space-y-2">
              <p className="font-bold text-fg">Product</p>
              <Link to="/features" className="block text-fg-muted hover:text-fg transition-colors">Features</Link>
              <Link to="/pricing" className="block text-fg-muted hover:text-fg transition-colors">Pricing</Link>
              <Link to="/case-study" className="block text-fg-muted hover:text-fg transition-colors">Case study</Link>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-fg">Company</p>
              <Link to="/about" className="block text-fg-muted hover:text-fg transition-colors">About</Link>
              <Link to="/contact" className="block text-fg-muted hover:text-fg transition-colors">Contact</Link>
              <Link to="/blog" className="block text-fg-muted hover:text-fg transition-colors">Blog</Link>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-fg">Resources</p>
              <Link to="/help" className="block text-fg-muted hover:text-fg transition-colors">Help center</Link>
              <Link to="/security" className="block text-fg-muted hover:text-fg transition-colors">Security</Link>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-fg">Legal</p>
              <Link to="/privacy" className="block text-fg-muted hover:text-fg transition-colors">Privacy</Link>
              <Link to="/terms" className="block text-fg-muted hover:text-fg transition-colors">Terms</Link>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-5 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-fg-subtle">Built for Indian retail. GST-aware. WhatsApp-native. Offline-ready.</p>
          <p className="text-[11px] text-fg-subtle">© {new Date().getFullYear()} Cashiea · Made with care in India</p>
        </div>
      </div>
    </footer>
  )
}

export default function PublicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-fg flex flex-col">
      <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-line" style={{ background: 'rgb(var(--paper) / 0.85)' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2"><SiteLogo /><span className="font-bold text-lg">Cashiea</span></Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-fg-muted">
            <Link to="/features" className="hover:text-fg transition-colors">Features</Link>
            <Link to="/pricing" className="hover:text-fg transition-colors">Pricing</Link>
            <Link to="/help" className="hover:text-fg transition-colors">Help</Link>
            <Link to="/about" className="hover:text-fg transition-colors">About</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors">Login</Link>
            <Link to="/signup" className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-accent-strong text-accent-fg text-sm font-semibold hover:bg-accent transition-colors shadow-soft">Start free trial <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">{children}</main>

      <PublicFooter />
    </div>
  )
}
