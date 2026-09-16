import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import { Shield, Lock, FileCheck, Globe, Server, KeyRound, Check } from 'lucide-react'

const certifications = [
  { icon: Lock, name: 'GDPR', desc: 'Full data-subject rights, EU data processing compliance, and right-to-erasure supported.', color: 'text-info' },
  { icon: Shield, name: 'SOC 2 Type II', desc: 'Security, availability, and confidentiality controls audited annually.', color: 'text-positive' },
  { icon: FileCheck, name: 'CCPA', desc: 'California Consumer Privacy Act — opt-out of data sale and access controls.', color: 'text-accent-strong' },
  { icon: KeyRound, name: 'ISO 27001', desc: 'Information security management system certified.', color: 'text-warning' },
  { icon: Globe, name: 'DPDP-Aligned', desc: "Aligned with India's Digital Personal Data Protection Act for customer data privacy.", color: 'text-olive' },
  { icon: Server, name: 'PCI DSS', desc: 'Payments processed by Stripe — we never touch raw card data.', color: 'text-copper' },
]

const practices = [
  'AES-256 encryption at rest, TLS 1.2+ in transit',
  "Row-Level Security isolates every customer's data at the database layer",
  'API keys hashed with SHA-256 — never stored in plaintext',
  'AI provider keys held only as server-side secrets, never in client code',
  'Webhook signatures verified on every payment event',
  'Automated usage limits prevent runaway costs',
  'Data residency options for enterprise customers',
  'SOC 2-audited sub-processors (Supabase, Stripe, OpenAI)',
]

export default function Compliance() {
  return (
    <div className="compliance-page animate-fade-in">
      <PageHeader
        visible
        eyebrow="Trust"
        title="Security & Compliance"
        subtitle="Enterprise-grade trust for your business data"
        icon={<Shield className="w-5 h-5" />}
      />


      <div className="card mb-8 flex items-center justify-between gap-4 bg-blue-50 p-5">
        <div><h2 className="text-lg font-bold text-fg">🛡️ Trust &amp; Security</h2><p className="mt-1 text-sm text-fg-muted">Enterprise-grade protection for your business data.</p></div>
        <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-500" /> All systems secure</span>
      </div>
      {/* Certifications grid */}
      <h2 className="section-title mb-4">Certifications & Standards</h2>
      <div className="certification-grid grid gap-4 mb-10">
        {certifications.map((c) => (
          <div key={c.name} className="card card-hover p-5">
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <h3 className="font-bold text-fg">{c.name}</h3>
            </div>
            <p className="line-clamp-2 text-sm text-fg-muted leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Security practices */}
      <div className="card p-5 mb-8">
        <h2 className="font-semibold text-fg mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-accent" /> Security Practices
        </h2>
        <div className="security-practices grid gap-3">
          {practices.map((p) => (
            <div key={p} className="flex items-start gap-2 text-sm text-fg-muted">
              <Check className="w-4 h-4 text-positive mt-0.5 flex-shrink-0" /> {p}
            </div>
          ))}
        </div>
      </div>

      {/* Trust banner */}
      <div className="card sheen p-6 sm:p-10 text-center relative overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-accent-soft text-accent-strong flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7" strokeWidth={1.6} />
          </div>
          <h2 className="text-xl font-bold text-fg mb-2">Your data stays yours</h2>
          <p className="text-fg-muted max-w-md mx-auto mb-6 leading-relaxed">
            We never train AI models on your private data, and you can export or delete everything at any time.
          </p>
          <Link to="/signup" className="btn-primary text-sm">Start securely — free</Link>
        </div>
      </div>

      <p className="text-xs text-fg-subtle text-center mt-6">
        Note: Certification badges represent target compliance posture. Confirm active audit status with your enterprise account executive.
      </p>
    </div>
  )
}
