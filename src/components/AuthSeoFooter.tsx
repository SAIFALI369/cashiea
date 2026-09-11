import { Link } from 'react-router-dom'

// ════════════════════════════════════════════════════════════════
// AuthSeoFooter — a small, real footer for /login and /signup.
//
// These two URLs attract a lot of brand-name searches ("cashiea
// login"), but a bare form page gives a crawler almost no text and
// no way onward into the site. This block gives both pages a plain
// sentence explaining what Cashiea is plus internal links to the
// marketing, help and legal pages — the crawl paths that make brand
// queries resolve to us instead of to a look-alike domain.
//
// Visually quiet by design: it sits below the form and never
// competes with the primary action.
// ════════════════════════════════════════════════════════════════

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/help', label: 'Help Center' },
  { to: '/blog', label: 'Blog' },
  { to: '/security', label: 'Security' },
  { to: '/contact', label: 'Contact' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
]

export default function AuthSeoFooter() {
  return (
    <footer className="mt-10 pt-6 border-t border-line">
      <p className="text-xs leading-relaxed text-fg-subtle">
        <strong className="font-semibold text-fg-muted">Cashiea</strong> is an AI-powered POS, GST billing
        and shop-management app for small Indian businesses — counter billing, khata (udhaar) tracking,
        stock alerts, daily WhatsApp reports and Meraj, an AI shop manager that works by voice in 10
        Indian languages. Works offline and syncs automatically.
      </p>
      <nav aria-label="Site links" className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="text-xs text-fg-subtle hover:text-accent transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="mt-4 text-[11px] text-fg-subtle">
        © {new Date().getFullYear()} Cashiea · Made in India
      </p>
    </footer>
  )
}
