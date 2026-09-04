import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { Store, MapPin, Tag, Sparkles, Phone, User, Loader2 } from 'lucide-react'

interface Memory { summary: string | null; business_type: string | null; key_facts: any[] }

export default function About() {
  const { profile, ownerId } = useAuth()
  const [mem, setMem] = useState<Memory | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ownerId) { setMem(null); setLoading(false); return }
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('business_memory')
        .select('summary, business_type, key_facts')
        .eq('user_id', ownerId)
        .maybeSingle()
      if (active) { setMem((data as Memory | null) || null); setLoading(false) }
    })()
    return () => { active = false }
  }, [ownerId])

  const facts: any[] = Array.isArray(mem?.key_facts) ? mem!.key_facts : []

  return (
    <div className="animate-fade-in max-w-2xl xl:max-w-3xl">
      <PageHeader title="About" subtitle="Your business at a glance — and what Meraj knows about it." icon={<Store className="w-5 h-5" />} />

      {/* Business identity */}
      <div className="card p-5 sm:p-6 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-11 h-11 rounded-control bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
            <Store className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-fg truncate">{profile?.company_name || 'Your business'}</h2>
            <p className="text-sm text-fg-muted">{mem?.business_type || profile?.shop_category || 'Business type not set yet'}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <InfoRow icon={<User className="w-4 h-4" />} label="Owner" value={profile?.full_name || '—'} />
          <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={profile?.phone || '—'} />
          <InfoRow icon={<MapPin className="w-4 h-4" />} label="Location" value={profile?.business_address || '—'} />
          <InfoRow icon={<Tag className="w-4 h-4" />} label="Category" value={profile?.shop_category || '—'} />
        </div>
      </div>

      {/* What Meraj has learned */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-fg">What Meraj has learned about your business</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-fg-subtle" /></div>
        ) : mem?.summary ? (
          <p className="text-sm text-fg-muted leading-relaxed whitespace-pre-wrap">{mem.summary}</p>
        ) : (
          <p className="text-sm text-fg-subtle">
            Meraj hasn't learned about your business yet. Chat with Meraj about your shop — what you sell, your hours, your customers — and key details will start appearing here.
          </p>
        )}
        {facts.length > 0 && (
          <ul className="mt-4 space-y-2">
            {facts.slice(0, 12).map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-fg">
                <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
                <span>{typeof f === 'string' ? f : f?.fact || JSON.stringify(f)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-8 h-8 rounded-lg bg-surface-2 text-fg-muted flex items-center justify-center flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{label}</p>
        <p className="text-sm text-fg truncate">{value}</p>
      </div>
    </div>
  )
}
