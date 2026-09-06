import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { buildSocialDrafts } from '../lib/socialDrafts'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Check, Copy, Loader2, Megaphone, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Social() {
  const { profile, ownerId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState(0)
  const [bills, setBills] = useState(0)
  const [topItem, setTopItem] = useState<{ name: string; qty: number } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    ;(async () => {
      const { data } = await supabase
        .from('transactions')
        .select('total,status,items')
        .eq('user_id', ownerId)
        .eq('status', 'completed')
        .gte('created_at', start.toISOString())
        .limit(500)
      if (cancelled) return
      const rows = (data as { total?: number; items?: { name?: string; quantity?: number }[] }[]) || []
      setBills(rows.length)
      setSales(rows.reduce((n, r) => n + (Number(r.total) || 0), 0))
      const qty = new Map<string, number>()
      for (const r of rows) {
        for (const it of r.items || []) {
          const name = String(it.name || '').trim()
          if (!name) continue
          qty.set(name, (qty.get(name) || 0) + (Number(it.quantity) || 0))
        }
      }
      let best: { name: string; qty: number } | null = null
      for (const [name, q] of qty) {
        if (!best || q > best.qty) best = { name, qty: q }
      }
      setTopItem(best)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId])

  const drafts = useMemo(() => buildSocialDrafts({
    shopName: profile?.company_name || profile?.full_name || 'Our shop',
    sales,
    bills,
    topItem,
  }), [profile?.company_name, profile?.full_name, sales, bills, topItem])

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      toast.success('Caption copied')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Could not copy')
    }
  }

  const share = async (text: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      toast.success('Copied — paste into WhatsApp Status')
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
      toast.error('Could not share')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="animate-fade-in max-w-lg">
      <PageHeader
        title="Social drafts"
        subtitle="Captions from today’s bills and the next festival. Copy or share — we never post for you."
        icon={<Megaphone className="w-5 h-5" />}
        visible
      />

      {drafts.length === 0 ? (
        <EmptyState icon={Megaphone} title="Nothing to draft" description="Ring up a sale or wait for a festival week — captions build themselves." />
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div key={d.id} className="card p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle mb-2">{d.title}</p>
              <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap">{d.caption}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => copy(d.id, d.caption)} className="btn-secondary text-xs">
                  {copied === d.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === d.id ? 'Copied' : 'Copy'}
                </button>
                <button onClick={() => share(d.caption)} className="btn-ghost text-xs">
                  <Share2 className="w-3.5 h-3.5" /> Share
                </button>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-fg-subtle leading-relaxed">
            Profit is never in a public caption. Paste into WhatsApp Status or Instagram yourself.
          </p>
        </div>
      )}
    </div>
  )
}
