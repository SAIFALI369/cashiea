import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import { Shield, Mail, ArrowLeft } from 'lucide-react'

const SUPPORT_EMAIL = 'supportcashiea@gmail.com'

const updated = 'July 18, 2026'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="border-b border-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white font-bold">
            <Shield className="w-5 h-5 text-brand-400" /> Cashiea
          </Link>
          <Link to="/" className="btn-ghost text-sm"><ArrowLeft className="w-4 h-4" /> Home</Link>
        </div>
      </nav>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent-strong/15 border border-accent-strong/40 flex items-center justify-center">
            <Shield className="w-6 h-6 text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Privacy Policy</h1>
            <p className="text-sm text-slate-500">Last updated: {updated}</p>
          </div>
        </div>

        <div className="card p-4 sm:p-5 space-y-6 text-slate-300 leading-relaxed text-sm sm:text-base">
          <p className="text-slate-400">This Privacy Policy explains how Cashiea ("we", "us", or "our") collects, uses, discloses, and safeguards your information when you use our cashier, point-of-sale, customer management, and related services (the "Service"). Please read this policy carefully.</p>

          <Section title="1. Information We Collect">
            <p>We collect information you provide directly and information collected automatically when you use the Service.</p>
            <Sub>Account information</Sub>
            <p>Name, email address, password (hashed), and business details (company name, GSTIN, address) you provide when you create an account or update your profile.</p>
            <Sub>Business data you enter</Sub>
            <p>Products, customers, transactions, invoices, quotations, suppliers, purchase orders, expenses, and similar records you create while using the Service. This is your data — you own and control it.</p>
            <Sub>Usage & technical data</Sub>
            <p>Device type, browser, IP address, access times, and feature usage, collected automatically via cookies and logs to operate and secure the Service.</p>
            <Sub>Support communications</Sub>
            <p>If you contact support, we receive the name, email, and message you submit through the support form.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul>
              <li>To provide, operate, and maintain the Service (processing sales, storing records, generating invoices and reports).</li>
              <li>To create and manage your account and authenticate you.</li>
              <li>To process payments and manage your subscription (via Stripe).</li>
              <li>To respond to your support requests and inquiries.</li>
              <li>To improve, personalize, and troubleshoot the Service.</li>
              <li>To detect, prevent, and address fraud, abuse, and security issues.</li>
              <li>To send service notices, policy updates, and (with consent) product updates.</li>
            </ul>
            <p>We do <strong>not</strong> use your private business or customer data to train AI models.</p>
          </Section>

          <Section title="3. How We Share Your Information">
            <p>We do not sell your personal information. We share data only as described below:</p>
            <Sub>Service providers</Sub>
            <p>We use trusted third-party providers that process data on our behalf:</p>
            <ul>
              <li><strong>Supabase</strong> — database hosting, authentication, and cloud functions.</li>
              <li><strong>Stripe</strong> — payment processing. We never see or store your full card details.</li>
              <li><strong>AI providers</strong> (such as OpenAI, Google Gemini, or Anthropic, depending on your selection) — to generate invoices, reports, summaries, and other content you request. Only the prompt needed for your request is sent.</li>
              <li><strong>Resend</strong> (if email delivery is enabled) — to send campaign and notification emails on your behalf.</li>
            </ul>
            <Sub>Legal & safety</Sub>
            <p>We may disclose information when required by law, court order, or to protect the rights, property, or safety of Cashiea, our users, or others.</p>
            <Sub>Business transfers</Sub>
            <p>In the event of a merger, acquisition, or asset sale, information may be transferred subject to the protections in this policy.</p>
          </Section>

          <Section title="4. Data Security">
            <p>We use industry-standard safeguards to protect your information, including:</p>
            <ul>
              <li>AES-256 encryption at rest and TLS 1.2+ encryption in transit.</li>
              <li>Row-Level Security in the database isolating each account’s data.</li>
              <li>Hashed passwords and API keys (never stored in plain text).</li>
              <li>Server-side secrets for all API and payment credentials.</li>
              <li>Access controls limiting data to authorized personnel only.</li>
            </ul>
            <p>No method of transmission or storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.</p>
          </Section>

          <Section title="5. Data Retention">
            <p>We retain your data for as long as your account is active or as needed to provide the Service. You may request export or deletion of your data at any time. Upon account deletion, your data is removed within 30 days, except where retention is required by law (such as certain financial records).</p>
          </Section>

          <Section title="6. Cookies">
            <p>We use essential cookies to keep you logged in and remember your preferences, and analytics cookies to understand usage. You can control cookies through your browser settings. Disabling some cookies may affect Service functionality.</p>
          </Section>

          <Section title="7. Your Privacy Rights">
            <p>Depending on your location (e.g. GDPR in the EU/UK, CCPA in California), you may have the right to:</p>
            <ul>
              <li>Access the personal information we hold about you.</li>
              <li>Request correction of inaccurate information.</li>
              <li>Request deletion of your personal data ("right to be forgotten").</li>
              <li>Opt out of the sale or sharing of your personal information.</li>
              <li>Withdraw consent at any time (without affecting prior processing).</li>
              <li>Lodge a complaint with your local data protection authority.</li>
            </ul>
            <p>To exercise any of these rights, contact us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-400 hover:text-brand-300">{SUPPORT_EMAIL}</a>.</p>
          </Section>

          <Section title="8. Children’s Privacy">
            <p>The Service is intended for business use and is not directed to individuals under 16. We do not knowingly collect personal information from children. If you believe we have collected such information, please contact us and we will delete it.</p>
          </Section>

          <Section title="9. International Transfers">
            <p>Your information may be processed in countries other than your own, including the United States and India, where our providers operate. We take steps to ensure appropriate safeguards are in place for such transfers, in line with applicable data protection laws.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page and updating the "Last updated" date. We encourage you to review this page periodically.</p>
          </Section>

          <Section title="11. Contact Us">
            <p>If you have questions about this Privacy Policy or our data practices, please contact us:</p>
            <div className="flex items-center gap-2 mt-2 text-brand-400">
              <Mail className="w-4 h-4" />
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-brand-300">{SUPPORT_EMAIL}</a>
            </div>
          </Section>
        </div>

        <p className="text-center text-sm text-slate-600 mt-8">© 2026 Cashiea. All rights reserved.</p>
      </article>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="font-semibold text-slate-200 mt-3 mb-1">{children}</p>
}
