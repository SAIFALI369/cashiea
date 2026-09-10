import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, LifeBuoy, BookOpen, Clock, Send, ExternalLink, Sparkles } from 'lucide-react'
import PublicPageShell, { SectionEyebrow } from '../../components/PublicPageShell'
import { SUPPORT_EMAIL } from '../../lib/site'

// ────────────────────────────────────────────────────────────────
// Public contact page. Only real channels: the monitored support
// mailbox (mailto form opens the visitor's own email app), the
// signed-in support desk, and the help center. No invented phone
// numbers, WhatsApp lines or support teams.
// ────────────────────────────────────────────────────────────────

export default function Contact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [opened, setOpened] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const body = `Name: ${name}\nEmail: ${email}\n\n${message}\n\n— Sent from the Cashiea contact page`
    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[Cashiea] Enquiry')}&body=${encodeURIComponent(body)}`
    window.location.href = href
    setOpened(true)
  }

  return (
    <PublicPageShell>
      <section className="px-4 pt-14 pb-10 sm:pt-20 text-center">
        <div className="max-w-2xl mx-auto">
          <SectionEyebrow>CONTACT</SectionEyebrow>
          <h1 className="mt-3 text-3xl sm:text-5xl font-bold leading-tight text-fg">Talk to a human.</h1>
          <p className="mt-4 text-sm sm:text-base text-fg-muted max-w-lg mx-auto leading-relaxed">
            Questions, bugs, billing, ideas — everything lands with our small team at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:text-accent-strong font-semibold">{SUPPORT_EMAIL}</a>.
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-fg-subtle">
            <Clock className="w-3.5 h-3.5 text-positive" /> We typically reply within 24 hours, Monday–Friday.
          </p>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-3 gap-4 items-start">
          {/* Mailto form */}
          <form onSubmit={handleSubmit} className="card p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold text-fg">Send us a message</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Your name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Your name" required />
              </div>
              <div>
                <label className="label">Your email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="you@email.com" required />
              </div>
            </div>
            <div>
              <label className="label">Message *</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="input-field resize-none" placeholder="Tell us what you need — a question, a bug (with the page it happened on), or a billing note." required />
            </div>
            <button type="submit" className="btn-primary w-full py-3">
              <Send className="w-4 h-4" /> Open in your email app
            </button>
            {opened && (
              <p className="text-xs text-fg-subtle flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> Your email app should have opened with the message pre-filled. If not, write to {SUPPORT_EMAIL} directly.
              </p>
            )}
            <p className="text-xs text-fg-subtle">This form opens your own email app with the message addressed to {SUPPORT_EMAIL} — nothing is stored on our side until you hit send there.</p>
          </form>

          {/* Other channels */}
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <LifeBuoy className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-bold text-fg">Already a customer?</h3>
              </div>
              <p className="text-xs text-fg-muted leading-relaxed">
                The in-app <strong className="text-fg">Support</strong> desk is the fastest route — it carries your account context and reaches the same mailbox.
              </p>
              <Link to="/app/support" className="chip mt-3 inline-flex">Open support desk</Link>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-bold text-fg">Prefer self-serve?</h3>
              </div>
              <p className="text-xs text-fg-muted leading-relaxed">
                The help center covers billing, GST invoices, stock, khata, WhatsApp reports, Meraj and troubleshooting.
              </p>
              <Link to="/help" className="chip mt-3 inline-flex">Browse help center</Link>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-bold text-fg">Want a free demo?</h3>
              </div>
              <p className="text-xs text-fg-muted leading-relaxed">
                Write “Demo” in your message with your shop type and city, and we’ll arrange a walkthrough of billing, stock, khata and Meraj with you — over a call or WhatsApp, whichever you prefer.
              </p>
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-bold text-fg mb-2">Write faster, get helped faster</h3>
              <ul className="text-xs text-fg-subtle space-y-1.5">
                <li>• Include a screenshot if it’s a bug</li>
                <li>• Mention the page where it happened</li>
                <li>• For billing, use the email on your account</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </PublicPageShell>
  )
}
