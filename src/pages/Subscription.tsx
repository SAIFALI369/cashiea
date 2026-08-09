import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { PLANS, PlanKey } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import { CreditCard, Check, Loader2, Zap, Crown } from 'lucide-react'
import toast from 'react-hot-toast'

// Flip to true once you've set up Stripe (see README → Stripe Setup).
// Controls whether upgrades go through real checkout or demo mode.
const STRIPE_ENABLED = import.meta.env.VITE_STRIPE_ENABLED === 'true'

export default function Subscription() {
  const { profile, ownerId, refreshProfile } = useAuth()
  const [updating, setUpdating] = useState<PlanKey | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const currentPlan = profile?.plan || 'free'

  // Handle Stripe redirect result
  useEffect(() => {
    const status = searchParams.get('status')
    if (status === 'success') {
      toast.success('Payment successful! Your plan is now active 🎉')
      refreshProfile()
      searchParams.delete('status')
      setSearchParams(searchParams, { replace: true })
    } else if (status === 'canceled') {
      toast('Checkout canceled — no charge was made.')
      searchParams.delete('status')
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUpgrade = async (plan: PlanKey) => {
    if (plan === currentPlan) return
    setUpdating(plan)

    try {
      // Downgrading to free doesn't need checkout
      if (plan === 'free') {
        await applyPlan(plan)
        toast.success('Switched to Free plan')
        return
      }

      if (STRIPE_ENABLED) {
        // ─── Real Stripe Checkout ───
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: { plan },
        })
        if (error) throw error
        if (data?.url) {
          window.location.href = data.url // redirect to Stripe
          return
        }
        throw new Error('No checkout URL returned')
      } else {
        // ─── Demo mode: update plan directly ───
        await applyPlan(plan)
        toast.success(`Upgraded to ${PLANS[plan].name}! 🎉 (demo mode)`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setUpdating(null)
    }
  }

  // Helper: write the plan + usage limit to the DB (demo / downgrade path)
  const applyPlan = async (plan: PlanKey) => {
    const { error } = await supabase
      .from('profiles')
      .update({ plan, api_usage_limit: PLANS[plan].usageLimit })
      .eq('id', profile!.id)
    if (error) throw error

    await supabase
      .from('subscriptions')
      .upsert({ user_id: ownerId, plan, status: 'active' })

    await refreshProfile()
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Subscription"
        subtitle="Manage your plan and AI usage limits"
        icon={<CreditCard className="w-5 h-5" />}
      />

      {/* Current plan banner */}
      <div className="card p-4 mb-8 bg-gradient-to-r from-brand-900/30 to-transparent">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-600/20 border border-brand-700/50 flex items-center justify-center">
              <Crown className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Current Plan</p>
              <p className="text-xl font-bold text-white">
                {PLANS[currentPlan].name} — ${PLANS[currentPlan].price}/mo
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">AI Actions</p>
            <p className="text-xl font-bold text-white">
              {profile?.api_usage_count || 0} / {profile?.api_usage_limit || 50}
            </p>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(PLANS).map(([key, plan]) => {
          const isCurrent = key === currentPlan
          const isPopular = key === 'pro'
          return (
            <div
              key={key}
              className={`card p-4 relative ${
                isCurrent
                  ? 'border-brand-600 ring-1 ring-brand-600/50'
                  : isPopular
                  ? 'border-brand-700/50'
                  : ''
              }`}
            >
              {isPopular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand-600 text-white text-xs font-bold whitespace-nowrap">
                  Most Popular
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-green-600 text-white text-xs font-bold whitespace-nowrap">
                  Current Plan
                </div>
              )}

              <h3 className="font-bold text-white text-lg">{plan.name}</h3>
              <div className="my-4">
                <span className="text-4xl font-extrabold text-white">₹{plan.price}</span>
                <span className="text-slate-500 text-sm">/mo</span>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-brand-400 mb-4">
                <Zap className="w-4 h-4" />
                <span className="font-semibold">{plan.usageLimit.toLocaleString()}</span>
                <span className="text-slate-500">AI actions/mo</span>
              </div>

              <ul className="space-y-2.5 mb-6 min-h-[140px]">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm text-slate-400">
                    <Check className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(key as PlanKey)}
                disabled={isCurrent || updating !== null}
                className={`w-full text-sm py-2.5 rounded-xl font-semibold transition-all ${
                  isCurrent
                    ? 'bg-slate-800 text-slate-500 cursor-default'
                    : plan.price > PLANS[currentPlan].price
                    ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {updating === key ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : isCurrent ? (
                  'Current Plan'
                ) : plan.price > PLANS[currentPlan].price ? (
                  `Upgrade to ${plan.name}`
                ) : (
                  `Switch to ${plan.name}`
                )}
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-center text-sm text-slate-500 mt-8">
        {STRIPE_ENABLED
          ? '🔒 Secure checkout powered by Stripe.'
          : '🔒 Demo mode — upgrades are applied instantly without payment. Add Stripe keys + set VITE_STRIPE_ENABLED=true to go live (see README).'}
      </p>
    </div>
  )
}
