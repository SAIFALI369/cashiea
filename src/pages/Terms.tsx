import { FileSignature, Mail, Scale } from 'lucide-react'
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

export default function Terms() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="animate-fade-in max-w-2xl xl:max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <div className="w-12 h-12 rounded-xl bg-accent-soft text-accent border border-accent-strong/30 flex items-center justify-center mb-4"><FileSignature className="w-6 h-6" /></div>
        <h1 className="text-2xl sm:text-3xl font-bold text-fg">Terms of Use</h1>
        <p className="text-sm text-fg-subtle mt-1">Last updated: {updated}</p>
      </div>

      <div className="space-y-4">
        <Section title="1. The agreement">
          <p>These Terms govern your use of Cashiea — a business management application for Indian retail shops, including the Meraj AI assistant ("the Service"). By creating an account you accept these Terms on behalf of yourself and, where you act for a business, on behalf of that business. If you do not accept them, do not use the Service.</p>
        </Section>

        <Section title="2. Eligibility and accounts">
          <p>You must be at least 18 years old and legally able to bind the business you register. You are responsible for the accuracy of your business details, for keeping your password secure, and for everything done through your account, including actions by staff members you invite. Tell us immediately about any unauthorised access.</p>
        </Section>

        <Section title="3. The Service and Meraj (AI)">
          <p>Cashiea provides billing and GST-compliant invoicing tools, inventory, customer records, udhaar (khata) tracking, reports, reminders and the Meraj AI assistant that can draft documents and perform actions <strong className="text-fg">only after you confirm them</strong>.</p>
          <p><strong className="text-fg">AI disclaimer:</strong> Meraj's outputs are machine-generated assistance. They may contain errors. They are <strong className="text-fg">not professional tax, legal or accounting advice</strong>. You remain solely responsible for your statutory obligations — including GST registration, the correctness of every invoice you issue, GST return filings and income tax. Verify anything that affects money or compliance with a Chartered Accountant or tax professional before acting on it.</p>
        </Section>

        <Section title="4. Your data and your customers' data">
          <p>Your business data belongs to you. You grant us a limited licence to process it solely to provide the Service (see our Privacy Policy). When you store customer or supplier details, you confirm you have a lawful right to do so. Nothing in these Terms transfers ownership of your data to us.</p>
        </Section>

        <Section title="5. Acceptable use">
          <p>You agree not to: use the Service for any unlawful purpose; store or send content that is illegal, infringing or fraudulent; attempt to access other users' data, probe or breach the Service's security, or reverse-engineer it; resell or provide it to third parties as a competing service; or abuse the AI or messaging features (including spamming customers on WhatsApp, which also breaches Meta's policies). We may suspend accounts that create legal or security risk for us or other users.</p>
        </Section>

        <Section title="6. Plans, fees and GST">
          <p>Cashiea offers a free plan and paid plans displayed in the app. Fees are in Indian Rupees. Where Cashiea is required to charge GST on its subscription fees, GST applies in addition at the applicable rate and is shown on your invoice/tax invoice. Payments are processed by our payment provider; we do not store your card details. Plans currently in early access may run in demo mode — you will never be charged without an explicit action from you.</p>
        </Section>

        <Section title="7. Third-party services">
          <p>The Service connects to services you choose — WhatsApp (Meta), Google, UPI apps and AI providers. Those connections are governed by the respective providers' terms, and their availability is outside our control. UPI payments go directly between your customer and your own UPI ID; Cashiea is not a payment gateway and never holds your money.</p>
        </Section>

        <Section title="8. Availability and changes">
          <p>We aim for reliable service, but we do not promise uninterrupted access. We may add, change or discontinue features; where a change is material and adverse we will give you reasonable notice in the app. Offline sales you record sync automatically when your connection returns — but treat the sync status shown in the app as the truth about what has been saved.</p>
        </Section>

        <Section title="9. Disclaimers">
          <p>The Service is provided "as is" and "as available". To the extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose and non-infringement. We do not warrant that the Service will be error-free, that AI output will be accurate, or that data loss will never occur — you are encouraged to export your data periodically (Reports → Excel/PDF).</p>
        </Section>

        <Section title="10. Limitation of liability">
          <p>To the maximum extent permitted by applicable law, Cashiea's total aggregate liability arising from or relating to the Service is limited to the fees you paid us in the 12 months before the claim (or ₹1,000, whichever is higher). We are not liable for indirect, incidental or consequential losses, lost profits, or lost data beyond the last available backup. Nothing in these Terms limits liability that cannot be limited under Indian law, including liability for fraud or for death or personal injury caused by negligence.</p>
        </Section>

        <Section title="11. Indemnity">
          <p>You agree to indemnify Cashiea against claims, losses and reasonable legal costs arising from your use of the Service — including invoices you issue, messages you send, content you store, and your breach of tax or other legal obligations.</p>
        </Section>

        <Section title="12. Termination">
          <p>You may close your account at any time; your data is erased as described in the Privacy Policy. We may suspend or terminate accounts that breach these Terms, remain unpaid, or create legal risk, after notice where practicable. On termination your right to use the Service ends and outstanding fees (if any) become due.</p>
        </Section>

        <Section title="13. Governing law and disputes">
          <p>These Terms are governed by the laws of India. Any dispute will first be raised with us at {SUPPORT_EMAIL} so we can try to resolve it within 30 days. If unresolved, it is subject to the exclusive jurisdiction of the competent courts of India.</p>
        </Section>

        <Section title="14. Changes to these Terms">
          <p>We may update these Terms as the Service evolves. Material changes will be announced in the app with a new "Last updated" date. Continuing to use the Service after changes take effect means you accept the updated Terms; if you do not, you may close your account.</p>
        </Section>

        <Section title="15. Contact">
          <p>Questions about these Terms: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:text-accent-strong">{SUPPORT_EMAIL}</a></p>
        </Section>

        <div className="card p-5 flex items-start gap-3 bg-surface/60">
          <Scale className="w-5 h-5 text-fg-subtle flex-shrink-0 mt-0.5" />
          <p className="text-xs text-fg-subtle leading-relaxed">
            These Terms are drafted for an Indian SaaS offering under the Indian Contract Act, 1872, the Information Technology Act, 2000 and the Consumer Protection Act, 2019 (including the E-Commerce Rules, 2020), and work alongside our Privacy Policy, which implements the DPDP Act, 2023 and DPDP Rules, 2025.
          </p>
        </div>

        <p className="text-center text-xs text-fg-subtle flex items-center justify-center gap-1.5"><Mail className="w-3 h-3" /> {SUPPORT_EMAIL}</p>
      </div>
    </div>
  )
}
