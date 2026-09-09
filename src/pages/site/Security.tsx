import { Link } from 'react-router-dom'
import { ShieldCheck, Lock, KeyRound, WifiOff, FileWarning, Mail, Server, UserCheck } from 'lucide-react'
import PublicPageShell, { SectionEyebrow } from '../../components/PublicPageShell'
import { SUPPORT_EMAIL } from '../../lib/site'

// ────────────────────────────────────────────────────────────────
// Security page. Every claim below maps to the shipped architecture
// (Supabase RLS schema, edge-function secrets, Vercel hosting). No
// certifications, audits or bug bounties are claimed — we don't have
// them, and this page says so plainly.
// ────────────────────────────────────────────────────────────────

const PRACTICES = [
  {
    icon: Lock,
    title: 'Encryption in transit',
    desc: 'The app is served over HTTPS from Vercel and talks to Supabase exclusively over TLS. There is no plain-text path for your data.',
  },
  {
    icon: ShieldCheck,
    title: 'Every shop is isolated',
    desc: 'Row-level security is enabled on every table in the database. Each business can only ever read and write its own records — enforced at the database level, not just in the UI.',
  },
  {
    icon: KeyRound,
    title: 'Authentication & sessions',
    desc: 'Sign-in is handled by Supabase Auth with hashed passwords and short-lived JWT sessions. Sensitive operations in edge functions re-verify the caller’s identity server-side.',
  },
  {
    icon: Server,
    title: 'Hosted in India',
    desc: 'The database runs on Supabase in the Mumbai (ap-south-1) region, aligned with our DPDP-first posture for Indian business data.',
  },
  {
    icon: UserCheck,
    title: 'Secrets stay server-side',
    desc: 'AI provider keys, payment keys and messaging credentials live only in edge-function secrets. The browser bundle contains nothing but the public anon key, which RLS renders powerless across tenants.',
  },
  {
    icon: WifiOff,
    title: 'Offline data stays yours',
    desc: 'Sales taken offline are queued on your own device and sync over TLS when you reconnect. Authenticated business data is never served from a cross-session cache.',
  },
]

const CONTROLS = [
  'Rate limiting on support and messaging paths to stop abuse.',
  'Signed, expiring tokens for email open/click tracking — raw record IDs are never accepted from public requests.',
  'Validated, sanitized inputs on edge functions; HTML output escaped; markdown rendered through a strict sanitizer.',
  'Team roles (owner / manager / accountant / staff) gate sensitive surfaces; only the owner touches prices, subscription and settings.',
]

export default function Security() {
  return (
    <PublicPageShell>
      <section className="px-4 pt-14 pb-10 sm:pt-20 text-center">
        <div className="max-w-2xl mx-auto">
          <SectionEyebrow>SECURITY</SectionEyebrow>
          <h1 className="mt-3 text-3xl sm:text-5xl font-bold leading-tight text-fg">Your ledger is your livelihood.</h1>
          <p className="mt-4 text-sm sm:text-base text-fg-muted max-w-lg mx-auto leading-relaxed">
            A shop’s data — customers, dues, sales — is sensitive. Here is exactly how Cashiea protects it, and exactly what we do and don’t claim.
          </p>
        </div>
      </section>

      <section className="px-4 pb-14" style={{ background: 'rgb(var(--surface))' }}>
        <div className="max-w-5xl mx-auto pt-12 grid sm:grid-cols-2 gap-3">
          {PRACTICES.map((p) => (
            <div key={p.title} className="card p-5">
              <span className="w-10 h-10 rounded-2xl bg-accent/10 text-accent-strong flex items-center justify-center mb-3"><p.icon className="w-4 h-4" strokeWidth={1.75} /></span>
              <h2 className="text-sm font-bold text-fg">{p.title}</h2>
              <p className="mt-1.5 text-xs text-fg-muted leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="card p-6">
            <h2 className="text-base font-bold text-fg mb-3">Applied controls</h2>
            <ul className="space-y-2">
              {CONTROLS.map((c) => (
                <li key={c} className="flex items-start gap-2 text-sm text-fg-muted leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block mt-1.5 flex-shrink-0" />{c}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <h2 className="text-base font-bold text-fg mb-2">Privacy, in one paragraph</h2>
            <p className="text-sm text-fg-muted leading-relaxed">
              Cashiea follows India’s DPDP Act 2023: we collect only what the service needs, we never sell your data, we don’t use your business data to train AI models, and you can export or delete your records anytime. The full commitments — including our grievance channel and 72-hour breach notification practice — live in the <Link to="/privacy" className="text-accent hover:text-accent-strong">Privacy Policy</Link>.
            </p>
          </div>

          <div className="card p-6">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-2xl bg-warning/15 text-warning flex items-center justify-center flex-shrink-0"><FileWarning className="w-4 h-4" /></span>
              <div>
                <h2 className="text-base font-bold text-fg">Report a vulnerability</h2>
                <p className="mt-1.5 text-sm text-fg-muted leading-relaxed">
                  If you believe you’ve found a security issue in Cashiea, email <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:text-accent-strong inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{SUPPORT_EMAIL}</a> with the subject line <strong className="text-fg">“Security”</strong>. Include steps to reproduce and we’ll take it from there. Please don’t test against other customers’ data.
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6" style={{ borderColor: 'rgb(var(--line))' }}>
            <h2 className="text-base font-bold text-fg mb-2">What we don’t claim</h2>
            <p className="text-sm text-fg-muted leading-relaxed">
              Accuracy matters more than impressive wording: Cashiea does not currently hold independent security certifications, and we do not run a bug-bounty program. If that changes, this page will say so. What you see above is the real, shipped posture — nothing more.
            </p>
          </div>
        </div>
      </section>
    </PublicPageShell>
  )
}
