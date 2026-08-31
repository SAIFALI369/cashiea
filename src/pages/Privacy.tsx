import { Shield, Mail, Building2 } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SUPPORT_EMAIL = 'supportcashiea@gmail.com'
const updated = '31 August 2026'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-bold text-fg mb-3">{title}</h2>
      <div className="space-y-2 text-sm text-fg-muted leading-relaxed">{children}</div>
    </section>
  )
}

export default function Privacy() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="animate-fade-in max-w-2xl xl:max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <div className="w-12 h-12 rounded-xl bg-accent-soft text-accent border border-accent-strong/30 flex items-center justify-center mb-4"><Shield className="w-6 h-6" /></div>
        <h1 className="text-2xl sm:text-3xl font-bold text-fg">Privacy Policy</h1>
        <p className="text-sm text-fg-subtle mt-1">Last updated: {updated}</p>
      </div>

      <div className="space-y-4">
        <Section title="1. Who we are">
          <p>Cashiea ("we", "us") is a business management application for Indian retail shops — billing, inventory, customers, payments and the Meraj AI assistant — operated from India. Under the Digital Personal Data Protection Act, 2023 ("DPDP Act"), Cashiea is the <strong className="text-fg">Data Fiduciary</strong> for the personal data processed through the Service. This policy is published in accordance with the DPDP Act, 2023 and the DPDP Rules, 2025, read with the Information Technology Act, 2000 and the SPDI Rules, 2011.</p>
          <p>Grievance / Data Protection contact: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:text-accent-strong">{SUPPORT_EMAIL}</a></p>
        </Section>

        <Section title="2. What this policy covers">
          <p>This policy applies to the Cashiea website and mobile app (together, the "Service") and to personal data of shop owners, their staff, and the customer details they choose to store in Cashiea. It does not apply to how you use third-party services such as WhatsApp, Google or UPI apps — those are governed by their own terms.</p>
        </Section>

        <Section title="3. Personal data we collect">
          <p><strong className="text-fg">Account data:</strong> name, email address, phone number, password (hashed), business name and profile.</p>
          <p><strong className="text-fg">Business records you create:</strong> sales and transactions, invoices, products, suppliers, expenses, and customer contact details (names, phone numbers, addresses) that you or your staff enter while using the Service. You are responsible for having a lawful basis (such as consent) to store your customers' details.</p>
          <p><strong className="text-fg">Content you share with Meraj:</strong> questions you ask, notes you save, photos you attach, and WhatsApp messages you choose to send or receive through the Service.</p>
          <p><strong className="text-fg">Technical data:</strong> device and browser information, access logs and error logs, used to keep the Service secure and working.</p>
          <p>We do not collect your customers' payment credentials, your bank passwords, or your GST portal credentials. UPI payments you collect go directly to your own UPI ID — Cashiea never holds your money.</p>
        </Section>

        <Section title="4. Why we process it (purposes)">
          <p>We process personal data only to provide and improve the Service: creating and securing your account; storing and displaying your business records; generating bills, invoices, reports and AI assistance; sending the daily WhatsApp report and reminders you enable; backing up and restoring your data; and detecting abuse or faults.</p>
          <p>We do not sell your personal data or use it for advertising, and we do not use your business data to train AI models.</p>
        </Section>

        <Section title="5. Consent and withdrawal">
          <p>Processing is based on your consent (DPDP Act, Section 6) given when you create an account and use the Service, and on the legitimate operation of the Service you requested. You may withdraw consent at any time — by turning off a feature (for example, WhatsApp reports) in Settings, or by closing your account. Withdrawal does not affect processing already completed.</p>
        </Section>

        <Section title="6. Who we share data with (processors)">
          <p>We share personal data only with service providers who help run Cashiea, under contract and only for that purpose:</p>
          <p><strong className="text-fg">Supabase</strong> — primary database and hosting, in the India (ap-south-1) region. <strong className="text-fg">Vercel</strong> — application hosting. <strong className="text-fg">Groq / Google (Gemini)</strong> — AI processing that powers Meraj; your questions and relevant business context are sent to generate replies. <strong className="text-fg">Meta (WhatsApp Cloud API)</strong> — only for messages you choose to send or receive through the Service. <strong className="text-fg">Email delivery providers</strong> — for transactional emails you request.</p>
          <p>Some of these providers may process data outside India. Where that happens, we rely on the transfer provisions of the DPDP Act and disclose it here.</p>
        </Section>

        <Section title="7. Security">
          <p>We use industry-standard safeguards: TLS encryption in transit, hashed passwords, per-account row-level security so one business can never read another's data, least-privilege access for our staff, and audit logging. No system is perfectly secure; if a personal data breach occurs we will notify you and the Data Protection Board of India <strong className="text-fg">without delay, with a detailed report within 72 hours</strong> of becoming aware, as required by Rule 7 of the DPDP Rules, 2025.</p>
        </Section>

        <Section title="8. How long we keep it">
          <p>Account and business data is retained while your account is active. When you delete data or close your account, we erase it from production systems within 30 days (backups roll off within 90 days), except where retention is required by law. Where practical, we will notify you before erasing data you asked us to keep (as the DPDP Rules require a 48-hour pre-erasure notice).</p>
        </Section>

        <Section title="9. Your rights (data principal rights)">
          <p>Under the DPDP Act you can:</p>
          <p>• <strong className="text-fg">Access</strong> a summary of the personal data we hold about you.<br />
          • <strong className="text-fg">Correct</strong> inaccurate or incomplete data — most fields are editable directly in Settings.<br />
          • <strong className="text-fg">Erase</strong> your data (subject to legal retention, such as pending statutory records).<br />
          • <strong className="text-fg">Withdraw consent</strong> for specific processing.<br />
          • <strong className="text-fg">Nominate</strong> another person to exercise these rights on your behalf.<br />
          • <strong className="text-fg">Raise a grievance</strong> with us — we aim to respond within 30 days, and in any case within the statutory period; if unresolved you may complain to the Data Protection Board of India.</p>
          <p>To exercise any right, email <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:text-accent-strong">{SUPPORT_EMAIL}</a> from your registered address.</p>
        </Section>

        <Section title="10. Children">
          <p>The Service is intended for businesses and is not offered to anyone under 18. We do not knowingly process children's personal data. If you believe a minor has created an account, contact us and we will delete it.</p>
        </Section>

        <Section title="11. Changes to this policy">
          <p>We may update this policy as the Service or the law changes. Material changes will be announced in the app with a new "Last updated" date. Continued use after the update means you accept the revised policy.</p>
        </Section>

        <Section title="12. Contact">
          <p>Questions, data requests or grievances: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:text-accent-strong">{SUPPORT_EMAIL}</a>. We are the Data Fiduciary for Cashiea and this is our published grievance channel.</p>
        </Section>

        <div className="card p-5 flex items-start gap-3 bg-surface/60">
          <Building2 className="w-5 h-5 text-fg-subtle flex-shrink-0 mt-0.5" />
          <p className="text-xs text-fg-subtle leading-relaxed">
            This policy is written to comply with the Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025 (notified 14 November 2025), the Information Technology Act, 2000 and the SPDI Rules, 2011, as applicable to Cashiea's operations.
          </p>
        </div>

        <p className="text-center text-xs text-fg-subtle flex items-center justify-center gap-1.5"><Mail className="w-3 h-3" /> {SUPPORT_EMAIL}</p>
      </div>
    </div>
  )
}
