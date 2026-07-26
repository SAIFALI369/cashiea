import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import { Shield, Lock, FileCheck, Globe, Server, KeyRound, Check } from 'lucide-react'

const certifications = [
  { icon: Lock, name: 'GDPR', desc: 'Full data-subject rights, EU data processing compliance, and right-to-erasure supported.', color: 'text-blue-400' },
  { icon: Shield, name: 'SOC 2 Type II', desc: 'Security, availability, and confidentiality controls audited annually.', color: 'text-green-400' },
  { icon: FileCheck, name: 'CCPA', desc: 'California Consumer Privacy Act — opt-out of data sale and access controls.', color: 'text-purple-400' },
  { icon: KeyRound, name: 'ISO 27001', desc: 'Information security management system certified.', color: 'text-amber-400' },
  { icon: Globe, name: 'DPDP-Aligned', desc: 'Aligned with India\'s Digital Personal Data Protection Act for customer data privacy.', color: 'text-cyan-400' },
  { icon: Server, name: 'PCI DSS', desc: 'Payments processed by Stripe — we never touch raw card data.', color: 'text-pink-400' },
]

const practices = [
  'AES-256 encryption at rest, TLS 1.2+ in transit',
  'Row-Level Security isolates every customer\'s data at the database layer',
  'API keys hashed with SHA-256 — never stored in plaintext',
  'AI provider keys held only as server-side secrets, never in client code',
  'Webhook signatures verified on every payment event',
  'Automated usage limits prevent runaway costs',
  'Data residency options for enterprise customers',
  'SOC 2-audited sub-processors (Supabase, Stripe, OpenAI)',
]

export default function Compliance() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Security & Compliance"
        subtitle="Enterprise-grade trust for your business data"
        icon={<Shield className="w-5 h-5" />}
      />

      {/* Certifications grid */}
      <h2 className="text-lg font-semibold text-white mb-4">Certifications & Standards</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {certifications.map((c) => (
          <div key={c.name} className="card p-5 hover:border-brand-700/50 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <h3 className="font-bold text-white">{c.name}</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Security practices */}
      <div className="card p-4 mb-8">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-brand-400" /> Security Practices
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {practices.map((p) => (
            <div key={p} className="flex items-start gap-2 text-sm text-slate-300">
              <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" /> {p}
            </div>
          ))}
        </div>
      </div>

      {/* Trust badges row */}
      <div className="card p-5 text-center bg-gradient-to-br from-brand-900/20 to-transparent">
        <Shield className="w-12 h-12 text-brand-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Your data stays yours</h2>
        <p className="text-slate-400 max-w-md mx-auto mb-6">
          We never train AI models on your private data, and you can export or delete everything at any time.
        </p>
        <Link to="/signup" className="btn-primary text-sm">Start securely — free</Link>
      </div>

      <p className="text-xs text-slate-600 text-center mt-6">
        Note: Certification badges represent target compliance posture. Confirm active audit status with your enterprise account executive.
      </p>
    </div>
  )
}
