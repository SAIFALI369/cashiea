import { Link } from 'react-router-dom'
import { Store, ShieldCheck, WifiOff, Sparkles, Mail, MapPin, ArrowRight, Check } from 'lucide-react'
import PublicPageShell, { SectionEyebrow, Mono } from '../../components/PublicPageShell'
import { SUPPORT_EMAIL } from '../../lib/site'

// ────────────────────────────────────────────────────────────────
// Public about page. Only verifiable facts: what Cashiea is, who it
// is for, why it exists and how it behaves. No invented team,
// history, counts or credentials.
// ────────────────────────────────────────────────────────────────

const PRINCIPLES = [
  {
    icon: Check,
    title: 'You approve. It sends.',
    desc: 'Meraj drafts every invoice, reminder and report — and waits. Nothing leaves your shop without your OK.',
  },
  {
    icon: WifiOff,
    title: 'Offline is normal, not an edge case.',
    desc: 'Power cuts and dead zones are part of Indian retail. Billing keeps working and syncs when you reconnect.',
  },
  {
    icon: ShieldCheck,
    title: 'Your data belongs to you.',
    desc: 'Row-level security isolates every shop. Export anytime, cancel anytime. We never sell your customer list.',
  },
  {
    icon: Sparkles,
    title: 'Honest AI.',
    desc: 'Meraj answers from your real data, knows Indian compliance basics, and says “confirm with your CA” when it matters.',
  },
]

export default function SiteAbout() {
  return (
    <PublicPageShell>
      <section className="px-4 pt-14 pb-12 sm:pt-20">
        <div className="max-w-3xl mx-auto text-center">
          <SectionEyebrow>ABOUT CASHIEA</SectionEyebrow>
          <h1 className="mt-3 text-3xl sm:text-5xl font-bold leading-tight text-fg">
            The back office a big store has,<br className="hidden sm:block" />
            <span className="text-accent"> for the shop on your street.</span>
          </h1>
          <p className="mt-5 text-sm sm:text-base text-fg-muted max-w-2xl mx-auto leading-relaxed">
            Cashiea exists for one reason: the owner of a small Indian shop already works a manager’s hours — billing, stock, dues, bookkeeping — on a notebook and WhatsApp. We build the system that does that paperwork, so the owner can keep doing the part only an owner can: deciding, and being there.
          </p>
        </div>
      </section>

      <section className="px-4 pb-14" style={{ background: 'rgb(var(--surface))' }}>
        <div className="max-w-5xl mx-auto pt-12">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="card p-6">
              <Mono className="text-accent-strong">WHO IT’S FOR</Mono>
              <h2 className="mt-2 text-xl font-bold text-fg">Built for Tier 2/3 India</h2>
              <p className="mt-2 text-sm text-fg-muted leading-relaxed">
                Kirana, hardware, medical, garments — shops in towns where the day runs on cash, UPI and udhaar, and where software has to survive power cuts, slow networks and zero training time. Cashiea is voice-first, WhatsApp-native and offline-ready because that is what those counters need.
              </p>
            </div>
            <div className="card p-6">
              <Mono className="text-accent-strong">WHAT WE BUILD</Mono>
              <h2 className="mt-2 text-xl font-bold text-fg">POS + CRM + an AI manager</h2>
              <p className="mt-2 text-sm text-fg-muted leading-relaxed">
                Counter billing with split payments, Rule-46 GST invoices, khata, stock alerts, customer history and daily WhatsApp reports — wrapped around <strong className="text-fg">Meraj</strong>, an AI staff member who watches every sale, stock level and pending payment, and prepares the next sensible action for your approval.
              </p>
            </div>
          </div>

          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="card p-5 flex items-start gap-3">
                <span className="w-9 h-9 rounded-2xl bg-accent-soft text-accent flex items-center justify-center flex-shrink-0"><p.icon className="w-4 h-4" strokeWidth={2} /></span>
                <div>
                  <p className="text-sm font-bold text-fg">{p.title}</p>
                  <p className="mt-1 text-xs text-fg-muted leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="max-w-3xl mx-auto">
          <div className="card p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-accent-soft text-accent flex items-center justify-center flex-shrink-0"><Store className="w-5 h-5" /></span>
              <div>
                <h2 className="text-lg font-bold text-fg">Where we are</h2>
                <p className="mt-1 text-sm text-fg-muted leading-relaxed flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-accent" /> Built and operated from India · data hosted in India
                </p>
                <p className="mt-3 text-sm text-fg-muted leading-relaxed">
                  The fastest way to reach a human is email —{' '}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:text-accent-strong inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{SUPPORT_EMAIL}</a>{' '}
                  — or the in-app support desk once you’re signed in. We typically reply within 24 hours, Monday–Friday.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/help" className="chip">Help center</Link>
                  <Link to="/contact" className="chip">Contact</Link>
                  <Link to="/security" className="chip">Security</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-10">
            <p className="text-sm text-fg-muted">Curious what a day with Meraj feels like?</p>
            <Link to="/signup" className="inline-flex items-center gap-2 mt-4 px-7 py-3.5 rounded-full bg-accent-strong text-accent-fg text-sm font-bold hover:bg-accent hover:shadow-lift transition-all">Start your 14-day free trial <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  )
}
