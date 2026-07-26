import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DoAnythingBar from '../components/DoAnythingBar'
import { motion, stagger, fadeUp } from '../components/motion'
import {
  Camera, Receipt, FileBarChart, Mail, MessageCircle, Wallet, TrendingUp,
  Package, ListChecks, ChevronRight, Sparkles, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'

const FEATURES = [
  { label: 'Receipts', desc: 'Create bills & GST invoices', to: '/app/invoices', icon: Receipt, scope: 'receipts' },
  { label: 'Business Report', desc: 'AI sales & insight reports', to: '/app/reports', icon: FileBarChart, scope: 'reports' },
  { label: 'E-mails', desc: 'Draft customer & retargeting emails', to: '/app/email-assistant', icon: Mail, scope: 'emails' },
  { label: 'WhatsApp', desc: 'Win-back & broadcast campaigns', to: '/app/campaigns', icon: MessageCircle, scope: 'whatsapp' },
  { label: 'Expenses', desc: 'Track spending & payouts', to: '/app/accounts', icon: Wallet, scope: 'expenses' },
  { label: 'Profits', desc: 'Profit & loss overview', to: '/app/accounts', icon: TrendingUp, scope: 'profits' },
  { label: 'Stocks', desc: 'Inventory & low-stock alerts', to: '/app/products', icon: Package, scope: 'stocks' },
  { label: 'Tasks', desc: 'AI-predicted actions & follow-ups', to: '/app/brain', icon: ListChecks, scope: 'tasks' },
]

export default function Dashboard() {
  const { profile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) toast.success('Photo captured — this feature is coming soon.')
  }

  return (
    <div className="animate-fade-in">
      {/* Header — "Mere" reserved label + greeting */}
      <div className="mb-7">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-soft text-accent text-[11px] font-semibold tracking-wide">
          <Sparkles className="w-3 h-3" /> Mere
        </span>
        <h1 className="text-xl font-bold text-fg mt-3">{greet}, {profile?.full_name?.split(' ')[0] || 'there'} 👋</h1>
        <p className="text-sm text-fg-muted mt-1">What would you like to do today?</p>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />

      {/* 4-icon row (camera is mobile-only) */}
      <div className="grid grid-cols-4 lg:grid-cols-3 gap-3 sm:gap-4 mb-7">
        <button onClick={() => fileRef.current?.click()} className="lg:hidden card card-hover p-3 sm:p-4 flex flex-col items-center gap-2 group">
          <span className="w-9 h-9 rounded-xl bg-surface-2 text-fg inline-flex items-center justify-center group-hover:bg-accent-soft group-hover:text-accent transition-colors"><Camera className="w-5 h-5" /></span>
          <span className="text-[11px] font-medium text-fg-muted">Camera</span>
        </button>
        <Link to="/app/invoices" className="card card-hover p-3 sm:p-4 flex flex-col items-center gap-2 group">
          <span className="w-9 h-9 rounded-xl bg-surface-2 text-fg inline-flex items-center justify-center group-hover:bg-accent-soft group-hover:text-accent transition-colors"><Receipt className="w-5 h-5" /></span>
          <span className="text-[11px] font-medium text-fg-muted">Quick Bill</span>
        </Link>
        <Link to="/app/products" className="card card-hover p-3 sm:p-4 flex flex-col items-center gap-2 group">
          <span className="w-9 h-9 rounded-xl bg-surface-2 text-fg inline-flex items-center justify-center group-hover:bg-accent-soft group-hover:text-accent transition-colors"><Package className="w-5 h-5" /></span>
          <span className="text-[11px] font-medium text-fg-muted">Products</span>
        </Link>
        <Link to="/app/customers" className="card card-hover p-3 sm:p-4 flex flex-col items-center gap-2 group">
          <span className="w-9 h-9 rounded-xl bg-surface-2 text-fg inline-flex items-center justify-center group-hover:bg-accent-soft group-hover:text-accent transition-colors"><Users className="w-5 h-5" /></span>
          <span className="text-[11px] font-medium text-fg-muted">Customers</span>
        </Link>
      </div>

      {/* Do Anything — docked launcher into the full Meraj page */}
      <div className="mb-8"><DoAnythingBar /></div>

      {/* Feature rows (each with a scoped AI badge) */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2.5">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-fg-subtle px-1 mb-1">Features</p>
        {FEATURES.map((f) => (
          <motion.div key={f.label} variants={fadeUp} className="card card-hover p-4 flex items-center gap-3 group">
            <Link to={f.to} className="flex items-center gap-4 flex-1 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent inline-flex items-center justify-center flex-shrink-0"><f.icon className="w-5 h-5" /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg">{f.label}</p>
                <p className="text-xs text-fg-muted mt-0.5 truncate">{f.desc}</p>
              </div>
            </Link>
            <Link
              to={`/app/assistant?scope=${f.scope}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent-soft text-accent text-[10px] font-semibold hover:bg-accent hover:text-accent-fg transition-colors flex-shrink-0"
              title={`Ask Meraj about ${f.label}`}
            >
              <Sparkles className="w-3 h-3" /> AI
            </Link>
            <ChevronRight className="w-5 h-5 text-fg-subtle group-hover:text-fg group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
