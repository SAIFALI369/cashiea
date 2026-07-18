import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import { FileText, Mail, ArrowLeft } from 'lucide-react'

const SUPPORT_EMAIL = 'supportcashiea@gmail.com'
const updated = 'July 18, 2026'

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="border-b border-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white font-bold">
            <FileText className="w-5 h-5 text-brand-400" /> BizAutomate
          </Link>
          <Link to="/" className="btn-ghost text-sm"><ArrowLeft className="w-4 h-4" /> Home</Link>
        </div>
      </nav>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-600/15 border border-brand-700/40 flex items-center justify-center">
            <FileText className="w-6 h-6 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Terms of Use</h1>
            <p className="text-sm text-slate-500">Last updated: {updated}</p>
          </div>
        </div>

        <div className="card p-6 sm:p-8 space-y-6 text-slate-300 leading-relaxed text-sm sm:text-base">
          <p className="text-slate-400">Welcome to BizAutomate. These Terms of Use ("Terms") govern your access to and use of the BizAutomate cashier, point-of-sale, customer management, and related services (the "Service"). By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, please do not use the Service.</p>

          <Section title="1. Eligibility & Account">
            <p>You must be at least 16 years old and able to form a binding contract to use the Service. You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. You agree to provide accurate information and to keep it current. You may not share your account or transfer it without our consent.</p>
          </Section>

          <Section title="2. The Service">
            <p>BizAutomate provides tools for retail and small businesses, including point-of-sale billing, product and inventory management, customer relationship management, quotations, invoices, accounts, supplier and purchase order tracking, AI-assisted content and reports, and marketing campaigns. We may add, change, or discontinue features at any time, and we are not liable to you or any third party for such changes.</p>
          </Section>

          <Section title="3. Acceptable Use">
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose or in violation of any law.</li>
              <li>Enter, store, or transmit content that is fraudulent, infringing, defamatory, harmful, or that you do not have the right to use.</li>
              <li>Attempt to access, probe, or disrupt the Service’s systems, security, or other users’ data.</li>
              <li>Reverse engineer, decompile, or scrape the Service.</li>
              <li>Use the Service to send spam, unsolicited marketing, or communications that violate applicable laws (including anti-spam and consumer-protection laws).</li>
              <li>Resell or sublicense access to the Service without our written permission.</li>
            </ul>
          </Section>

          <Section title="4. Your Content & Responsibilities">
            <p>"Content" means all data you submit to the Service, including products, customers, transactions, invoices, and documents. You retain all rights to your Content and are solely responsible for it. You represent that you have the necessary rights to any Content you submit and that it does not violate these Terms or the rights of any third party.</p>
            <p>You are solely responsible for the accuracy of any AI-generated output (invoices, codes, reports, emails, summaries) and for verifying it before relying on or sending it. AI output is provided as assistance only and may contain errors.</p>
            <p>If your business handles personal or sensitive data (such as customer information), you are responsible for complying with applicable privacy laws, including obtaining any necessary consents from your customers.</p>
          </Section>

          <Section title="5. Payments & Subscriptions">
            <p>Some features require a paid subscription. Subscription fees are billed in advance on a recurring basis (monthly) through our payment processor, Stripe. By subscribing, you authorize us to charge the applicable fees to your payment method until you cancel.</p>
            <p>You may cancel at any time; cancellation takes effect at the end of your current billing period and fees already paid are non-refundable except where required by law. We may change our fees upon reasonable notice. Taxes, if any, are your responsibility.</p>
            <Sub>Free trial</Sub>
            <p>We may offer a free trial with limited features. Trial eligibility, duration, and limits are determined at our discretion and may change.</p>
          </Section>

          <Section title="6. Refunds">
            <p>Except where required by law, subscription fees are non-refundable. If you believe you have been charged in error, please contact us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-400 hover:text-brand-300">{SUPPORT_EMAIL}</a> within 14 days of the charge, and we will review your request.</p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>The Service, including its software, design, features, and branding, is owned by BizAutomate and protected by intellectual property laws. These Terms do not grant you any right to use our trademarks, logos, or trade names. Your Content remains yours, as stated above.</p>
            <p>To the extent the Service uses your data to operate features you request (such as generating an AI report), you grant us a limited license to process that data solely to provide the Service to you.</p>
          </Section>

          <Section title="8. Third-Party Services">
            <p>The Service integrates with third-party providers (such as Supabase, Stripe, AI providers, and email delivery services) whose terms and policies also apply. We are not responsible for the actions or availability of third-party services, and your use of them is at your own risk.</p>
          </Section>

          <Section title="9. Disclaimers">
            <p>The Service is provided "as is" and "as available" without warranties of any kind, whether express or implied. We do not warrant that the Service will be uninterrupted, error-free, secure, or that any result (including AI-generated content, calculations, or reports) will be accurate or reliable. You use the Service at your own risk.</p>
            <p>BizAutomate is a business tool and is not accounting, tax, legal, or medical advice. You should consult qualified professionals for such matters.</p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>To the maximum extent permitted by law, in no event will BizAutomate or its affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, business, or goodwill, arising out of or related to the Service, whether based on warranty, contract, tort (including negligence), or any other theory, even if we have been advised of the possibility of such damages.</p>
            <p>Our total liability for any claim arising from the Service is limited to the amount you paid us in the 12 months preceding the claim, or USD $50, whichever is greater.</p>
          </Section>

          <Section title="11. Indemnification">
            <p>You agree to indemnify and hold BizAutomate and its affiliates harmless from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your Content, your use of the Service, your violation of these Terms, or your violation of any law or third-party rights.</p>
          </Section>

          <Section title="12. Termination">
            <p>You may delete your account at any time. We may suspend or terminate your access to the Service if you violate these Terms, fail to pay fees, or if we determine that doing so protects the Service, our users, or the public. Upon termination, your right to use the Service ends. Sections that by their nature should survive termination (including those on liability, indemnification, and intellectual property) will remain in effect.</p>
          </Section>

          <Section title="13. Governing Law & Disputes">
            <p>These Terms are governed by the laws of India, without regard to conflict-of-law principles. You agree to the exclusive jurisdiction of the courts located in Patna, Bihar, India for any dispute arising from these Terms or the Service, except that we may seek injunctive relief in any court of competent jurisdiction to protect our intellectual property.</p>
          </Section>

          <Section title="14. Changes to These Terms">
            <p>We may modify these Terms from time to time. If we make material changes, we will notify you (such as by email or a notice in the Service) and post the updated Terms with a new "Last updated" date. Your continued use of the Service after changes take effect constitutes acceptance of the updated Terms.</p>
          </Section>

          <Section title="15. Contact">
            <p>If you have questions about these Terms, please contact us:</p>
            <div className="flex items-center gap-2 mt-2 text-brand-400">
              <Mail className="w-4 h-4" />
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-brand-300">{SUPPORT_EMAIL}</a>
            </div>
          </Section>
        </div>

        <p className="text-center text-sm text-slate-600 mt-8">© 2026 BizAutomate. All rights reserved.</p>
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
