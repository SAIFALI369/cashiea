import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DoAnythingBar from '../components/DoAnythingBar'
import { MerajMark } from '../components/MerajMark'
import { motion, stagger, fadeUp } from '../components/motion'
import {
  ShoppingCart, Receipt, Users, Package, FileBarChart, Sparkles, ArrowRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Supporting actions — ordered by business priority, NOT equal weight.
interface Action { to: string; label: string; desc: string; icon: LucideIcon }
const PRIMARY: Action = { to: '/app/pos', label: 'New Sale', desc: 'Ring up a sale', icon: ShoppingCart }
const ACTIONS: Action[] = [
  { to: '/app/invoices', label: 'Quick Bill', desc: 'Create a GST invoice', icon: Receipt },
  { to: '/app/customers', label: 'Customers', desc: 'View & add contacts', icon: Users },
  { to: '/app/products', label: 'Stock', desc: 'Inventory & low-stock', icon: Package },
  { to: '/app/reports', label: 'Reports', desc: 'Sales & insights', icon: FileBarChart },
]

export default function Dashboard() {
  const { profile } = useAuth()
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = (profile?.full_name || 'Owner').split(' ')[0]
  const datestr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="animate-fade-in space-y-6">
      {/* ══ HERO — one clear primary action ══ */}
      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="card relative overflow-hidden p-6 sm:p-8"
      >
        <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full opacity-60" style={{ background: 'radial-gradient(circle, rgb(var(--accent) / 0.14) 0%, transparent 70%)' }} />
        <div className="relative">
          <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-accent">{greet}, {firstName}</p>
          <h1 className="mt-2 text-fg font-bold leading-tight" style={{ fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
            Run your shop today.
          </h1>
          <p className="text-sm text-fg-muted mt-1.5">{datestr} · {profile?.company_name || 'Your business'}</p>

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link to={PRIMARY.to} className="btn-primary text-base px-6 py-3.5 h-auto flex-1 sm:flex-none">
              <PRIMARY.icon className="w-5 h-5" /> {PRIMARY.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/app/assistant" className="btn-secondary text-base px-6 py-3.5 h-auto flex-1 sm:flex-none">
              <Sparkles className="w-5 h-5 text-accent" /> Ask Meraj
            </Link>
          </div>
        </div>
      </motion.section>

      {/* ══ COMMAND CENTER — the smart action launcher ══ */}
      <DoAnythingBar />

      {/* ══ PRIORITISED ACTIONS — varied prominence, consistent padding ══ */}
      <motion.section variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-4">
        {ACTIONS.map((a, i) => (
          <motion.div key={a.to} variants={fadeUp}>
            <Link to={a.to} className={`card card-hover card-press block h-full ${i === 0 ? 'col-span-2' : ''}`}>
              <div className={`flex items-center gap-4 ${i === 0 ? 'p-5' : 'p-4'}`}>
                <span className={`rounded-control bg-accent-soft text-accent flex items-center justify-center flex-shrink-0 ${i === 0 ? 'w-12 h-12' : 'w-10 h-10'}`}>
                  <a.icon className={i === 0 ? 'w-6 h-6' : 'w-5 h-5'} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className={`font-semibold text-fg ${i === 0 ? 'text-base' : 'text-sm'}`}>{a.label}</p>
                  <p className="text-xs text-fg-subtle truncate">{a.desc}</p>
                </div>
                {i === 0 && <ArrowRight className="w-5 h-5 text-fg-subtle ml-auto" />}
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.section>

      {/* ══ MERAJ nudge — the AI as a calm, persistent invite ══ */}
      <Link
        to="/app/assistant"
        className="card card-hover block p-5 flex items-center gap-4"
      >
        <span className="w-11 h-11 rounded-control bg-gradient-to-br from-accent to-accent-strong text-accent-fg flex items-center justify-center flex-shrink-0">
          <MerajMark size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-fg text-sm">Ask Meraj anything</p>
          <p className="text-xs text-fg-subtle">Billing, stock, follow-ups — or “how was business today?”</p>
        </div>
        <span className="text-[10px] font-bold tracking-wide px-2 py-1 rounded-full bg-accent-soft text-accent">AI</span>
      </Link>
    </div>
  )
}
