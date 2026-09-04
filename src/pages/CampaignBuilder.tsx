import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { Megaphone, Loader2, FlaskConical, Repeat, Users, Calendar, Sparkles, Send, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface RecipientInput {
  email: string
  name: string
  company: string
  note: string
}

const tones = ['professional', 'friendly', 'persuasive', 'formal', 'casual']

export default function CampaignBuilder() {
  const { profile, ownerId } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()

  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [variantB, setVariantB] = useState('')
  const [abEnabled, setAbEnabled] = useState(false)
  const [body, setBody] = useState('')
  const [tone, setTone] = useState('professional')
  const [followupEnabled, setFollowupEnabled] = useState(false)
  const [followupDelay, setFollowupDelay] = useState(2)
  const [followupCount, setFollowupCount] = useState(1)
  const [scheduledAt, setScheduledAt] = useState('')
  const [recipients, setRecipients] = useState<RecipientInput[]>([
    { email: '', name: '', company: '', note: '' },
  ])
  const [bulkPaste, setBulkPaste] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [loadingCampaign, setLoadingCampaign] = useState(Boolean(id))

  useEffect(() => {
    if (!id || !ownerId) {
      setLoadingCampaign(false)
      return
    }
    let active = true
    const load = async () => {
      const { data: campaign, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', id)
        .eq('user_id', ownerId)
        .maybeSingle()
      if (!active) return
      if (error || !campaign) {
        toast.error('Campaign not found')
        navigate('/app/campaigns')
        return
      }
      if (campaign.status !== 'draft') {
        toast.error('Only draft campaigns can be edited. Use Retry from the campaign list for a partial send.')
        navigate('/app/campaigns')
        return
      }
      setName(campaign.name || '')
      setSubject(campaign.variant_a_subject || campaign.template_subject || '')
      setVariantB(campaign.variant_b_subject || '')
      setAbEnabled(Boolean(campaign.ab_enabled))
      setBody(campaign.template_body || '')
      setTone(campaign.tone || 'professional')
      setFollowupEnabled(Boolean(campaign.followup_enabled))
      setFollowupDelay(Number(campaign.followup_delay_days) || 2)
      setFollowupCount(Number(campaign.followup_count) || 1)
      setScheduledAt(campaign.scheduled_at ? new Date(campaign.scheduled_at).toISOString().slice(0, 16) : '')

      const { data: rows } = await supabase
        .from('campaign_recipients')
        .select('email, name, personalization')
        .eq('campaign_id', id)
        .eq('user_id', ownerId)
        .order('created_at', { ascending: true })
      if (!active) return
      setRecipients((rows || []).map((row: any) => ({
        email: row.email || '',
        name: row.name || '',
        company: row.personalization?.company || '',
        note: row.personalization?.note || '',
      })))
      setLoadingCampaign(false)
    }
    void load()
    return () => { active = false }
  }, [id, ownerId, navigate])

  const updateRecipient = (i: number, field: keyof RecipientInput, value: string) => {
    const next = [...recipients]
    next[i] = { ...next[i], [field]: value }
    setRecipients(next)
  }

  const addRecipient = () =>
    setRecipients([...recipients, { email: '', name: '', company: '', note: '' }])

  const removeRecipient = (i: number) =>
    setRecipients(recipients.filter((_, idx) => idx !== i))

  const applyBulk = () => {
    // Parse one-per-line: "email, Name, Company" or just "email"
    const lines = bulkPaste.split('\n').map((l) => l.trim()).filter(Boolean)
    const parsed: RecipientInput[] = lines.map((line) => {
      const parts = line.split(',').map((p) => p.trim())
      return {
        email: parts[0] || '',
        name: parts[1] || '',
        company: parts[2] || '',
        note: parts[3] || '',
      }
    })
    setRecipients(parsed.length ? parsed : [{ email: '', name: '', company: '', note: '' }])
    setBulkPaste('')
    setShowBulk(false)
    toast.success(`Loaded ${parsed.length} recipients`)
  }

  const validRecipients = recipients.filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim()))

  const launchCampaign = async () => {
    if (!ownerId) return toast.error('Your business is still loading — please try again')
    if (loadingCampaign) return toast.error('Campaign is still loading')
    if (!name.trim()) return toast.error('Give your campaign a name')
    if (!subject.trim()) return toast.error('Add a subject line')
    if (!body.trim()) return toast.error('Write a base email body')
    if (abEnabled && !variantB.trim()) return toast.error('A/B test needs a variant B subject')
    if (validRecipients.length === 0) return toast.error('Add at least one valid recipient email')
    if (validRecipients.length > 500) return toast.error('Use at most 500 recipients per campaign batch')

    setLaunching(true)
    try {
      const campaignPayload = {
        user_id: ownerId,
        name: name.trim().slice(0, 200),
        template_subject: subject.trim().slice(0, 500),
        template_body: body.trim().slice(0, 50_000),
        tone,
        ab_enabled: abEnabled,
        variant_a_subject: subject.trim().slice(0, 500),
        variant_b_subject: abEnabled ? variantB.trim().slice(0, 500) : null,
        followup_enabled: followupEnabled,
        followup_delay_days: Math.max(1, Math.min(365, Number(followupDelay) || 2)),
        followup_count: Math.max(1, Math.min(10, Number(followupCount) || 1)),
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        status: scheduledAt ? 'scheduled' : 'draft',
      }

      let campaign: any
      if (id) {
        const { data, error: cErr } = await supabase
          .from('email_campaigns')
          .update(campaignPayload)
          .eq('id', id)
          .eq('user_id', ownerId)
          .select()
          .single()
        if (cErr) throw cErr
        campaign = data
        // Editing replaces the pending audience. Never leave old recipients
        // mixed with the newly reviewed list or accidentally resend them.
        const { error: deleteError } = await supabase
          .from('campaign_recipients').delete().eq('campaign_id', id).eq('user_id', ownerId)
        if (deleteError) throw deleteError
      } else {
        const { data, error: cErr } = await supabase
          .from('email_campaigns').insert(campaignPayload).select().single()
        if (cErr) throw cErr
        campaign = data
      }

      const recipientRows = validRecipients.map((r) => ({
        campaign_id: campaign.id,
        user_id: ownerId,
        email: r.email.trim().toLowerCase(),
        name: r.name.trim().slice(0, 200) || null,
        personalization: {
          company: r.company.trim().slice(0, 300) || null,
          note: r.note.trim().slice(0, 1000) || null,
        },
      }))
      const { error: rErr } = await supabase.from('campaign_recipients').insert(recipientRows)
      if (rErr) throw rErr

      if (scheduledAt) {
        toast.success(`Campaign scheduled for ${new Date(scheduledAt).toLocaleString()}`)
        navigate('/app/campaigns')
        return
      }

      // invoke attaches the current JWT and keeps the client independent of
      // hard-coded function hostnames. campaign-send resolves linked staff to
      // the verified business owner before doing any work.
      const { data: result, error: sendError } = await supabase.functions.invoke('campaign-send', {
        body: { campaign_id: campaign.id },
      })
      if (sendError) throw sendError
      if (!result?.success) throw new Error(result?.error || 'Launch failed')

      toast.success(`🚀 Generated ${result.processed} personalized emails${result.delivered ? `, ${result.delivered} delivered` : ''}!`)
      navigate('/app/campaigns')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Launch failed')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={id ? 'Edit Campaign' : 'New Campaign'}
        subtitle="Build personalized outreach — A/B test, follow-ups & scheduling"
        icon={<Megaphone className="w-5 h-5" />}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main config */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basics */}
          <div className="card p-4">
            <h2 className="font-semibold text-white mb-4">1. Campaign Details</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Campaign Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Q1 SaaS Founder Outreach" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Subject Line (A)</label>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field" placeholder="Quick idea for {company}" />
                </div>
                <div>
                  <label className="label">Tone</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className="input-field">
                    {tones.map((t) => <option key={t} value={t} className="bg-slate-900 capitalize">{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" /> Base Email Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  className="input-field resize-none"
                  placeholder={`Hi {name},\n\nI noticed {company} is scaling fast — we help teams like yours automate admin work...\n\n(Use {name} and {company} as merge tags — AI personalizes each one.)`}
                />
              </div>
            </div>
          </div>

          {/* A/B test */}
          <div className="card p-4">
            <label className="flex items-center justify-between cursor-pointer mb-3">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-purple-400" /> A/B Test Subject Lines
              </h2>
              <input type="checkbox" checked={abEnabled} onChange={(e) => setAbEnabled(e.target.checked)} className="w-5 h-5 accent-accent" />
            </label>
            {abEnabled && (
              <div className="animate-fade-in">
                <p className="text-sm text-slate-400 mb-3">Half your list gets subject A, half gets B. Track which wins.</p>
                <label className="label">Variant B Subject</label>
                <input value={variantB} onChange={(e) => setVariantB(e.target.value)} className="input-field" placeholder="An idea worth 2 minutes of your time" />
              </div>
            )}
          </div>

          {/* Follow-ups */}
          <div className="card p-4">
            <label className="flex items-center justify-between cursor-pointer mb-3">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Repeat className="w-4 h-4 text-cyan-400" /> Follow-up Sequence
              </h2>
              <input type="checkbox" checked={followupEnabled} onChange={(e) => setFollowupEnabled(e.target.checked)} className="w-5 h-5 accent-accent" />
            </label>
            {followupEnabled && (
              <div className="grid grid-cols-2 gap-4 animate-fade-in">
                <div>
                  <label className="label">Wait days between follow-ups</label>
                  <input type="number" min={1} max={14} value={followupDelay} onChange={(e) => setFollowupDelay(Number(e.target.value))} className="input-field" />
                </div>
                <div>
                  <label className="label">Number of follow-ups</label>
                  <input type="number" min={1} max={5} value={followupCount} onChange={(e) => setFollowupCount(Number(e.target.value))} className="input-field" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recipients + schedule */}
        <div className="space-y-6">
          {/* Recipients */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" /> Recipients
              </h2>
              <span className="text-xs text-slate-500">{validRecipients.length} valid</span>
            </div>

            <button onClick={() => setShowBulk(!showBulk)} className="btn-secondary text-xs w-full mb-3">
              {showBulk ? 'Hide bulk paste' : '📋 Paste list in bulk'}
            </button>

            {showBulk ? (
              <div className="mb-3 animate-fade-in">
                <textarea
                  value={bulkPaste}
                  onChange={(e) => setBulkPaste(e.target.value)}
                  rows={5}
                  className="input-field resize-none text-xs font-mono"
                  placeholder={`email, Name, Company\njohn@acme.com, John, Acme\njane@x.com, Jane, X Corp`}
                />
                <button onClick={applyBulk} className="btn-primary text-xs w-full mt-2">Load List</button>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {recipients.map((r, i) => (
                  <div key={i} className="bg-slate-900/60 rounded-lg p-2.5">
                    <input value={r.email} onChange={(e) => updateRecipient(i, 'email', e.target.value)} className="input-field text-sm py-2 mb-1.5" placeholder="email@company.com" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input value={r.name} onChange={(e) => updateRecipient(i, 'name', e.target.value)} className="input-field text-xs py-1.5" placeholder="Name" />
                      <input value={r.company} onChange={(e) => updateRecipient(i, 'company', e.target.value)} className="input-field text-xs py-1.5" placeholder="Company" />
                    </div>
                    {recipients.length > 1 && (
                      <button onClick={() => removeRecipient(i)} className="text-xs text-negative hover:text-negative mt-1 flex items-center gap-1">
                        <X className="w-3 h-3" /> remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!showBulk && (
              <button onClick={addRecipient} className="btn-ghost text-xs w-full mt-2">
                <Plus className="w-3.5 h-3.5" /> Add recipient
              </button>
            )}
          </div>

          {/* Schedule */}
          <div className="card p-4">
            <h2 className="font-semibold text-white flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-warning" /> Schedule (optional)
            </h2>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="input-field"
            />
            <p className="text-xs text-slate-500 mt-2">Leave empty to launch immediately.</p>
          </div>

          {/* Launch */}
          <button onClick={launchCampaign} disabled={launching || loadingCampaign} className="btn-primary w-full py-3.5">
            {launching || loadingCampaign ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {loadingCampaign ? 'Loading campaign…' : launching ? 'Personalizing & Sending...' : `Launch to ${validRecipients.length} recipients`}
          </button>
          <p className="text-xs text-slate-500 text-center">
            Uses {validRecipients.length} AI actions · {validRecipients.length * 10} min saved
          </p>
        </div>
      </div>
    </div>
  )
}
