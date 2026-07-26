import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { callAI } from '../lib/ai'
import type { Email } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Mail, Sparkles, Loader2, Trash2, Copy } from 'lucide-react'
import toast from 'react-hot-toast'

const emailTypes = [
  { value: 'winback', label: 'Win-Back', icon: '💤', desc: 'Re-engage dormant customer' },
  { value: 'offer', label: 'Promo / Offer', icon: '🏷️', desc: 'Discount or sale announcement' },
  { value: 'thankyou', label: 'Thank You', icon: '🙏', desc: 'Post-purchase appreciation' },
  { value: 'abandoned', label: 'Abandoned Cart', icon: '🛒', desc: 'Nudge an unfinished purchase' },
  { value: 'newsletter', label: 'Newsletter', icon: '📰', desc: 'Update your customers' },
  { value: 'custom', label: 'Custom', icon: '✨', desc: 'Anything you need' },
]

const tones = ['professional', 'friendly', 'persuasive', 'formal', 'casual']

export default function EmailAssistant() {
  const { profile } = useAuth()
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [emailType, setEmailType] = useState('cold_outreach')
  const [tone, setTone] = useState('professional')
  const [recipient, setRecipient] = useState('')
  const [subject, setSubject] = useState('')
  const [keyPoints, setKeyPoints] = useState('')

  useEffect(() => {
    loadEmails()
  }, [])

  const loadEmails = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('emails')
      .select('*')
      .order('created_at', { ascending: false })
    setEmails((data as Email[]) || [])
    setLoading(false)
  }

  const handleGenerate = async () => {
    if (!keyPoints.trim()) {
      toast.error('Add some key points for the email')
      return
    }
    setGenerating(true)
    try {
      const prompt = [
        `Email type: ${emailType}`,
        `Tone: ${tone}`,
        recipient ? `Recipient: ${recipient}` : '',
        subject ? `Suggested subject: ${subject}` : '',
        `Key points to cover:\n${keyPoints}`,
      ].filter(Boolean).join('\n')

      const { result, provider } = await callAI({
        task_type: 'email',
        prompt,
        provider: profile?.ai_provider,
      })

      // Split subject from body if present
      let finalSubject = subject
      let finalBody = result
      const subjectMatch = result.match(/^Subject:\s*(.+)$/im)
      if (subjectMatch) {
        finalSubject = finalSubject || subjectMatch[1].trim()
        finalBody = result.replace(/^Subject:\s*.+\n?/im, '').trim()
      }

      const { data, error } = await supabase
        .from('emails')
        .insert({
          user_id: profile!.id,
          subject: finalSubject || 'Untitled',
          recipient: recipient || null,
          email_type: emailType,
          tone,
          key_points: keyPoints,
          generated_body: finalBody,
          provider,
        })
        .select()
        .single()

      if (error) throw error

      setEmails([data as Email, ...emails])
      setKeyPoints('')
      setSubject('')
      toast.success('Email ready! 📧')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('emails').delete().eq('id', id)
    if (!error) {
      setEmails(emails.filter((e) => e.id !== id))
      toast.success('Email deleted')
    }
  }

  const handleCopy = (email: Email) => {
    const text = `Subject: ${email.subject}\n\n${email.generated_body || ''}`
    navigator.clipboard.writeText(text)
    toast.success('Email copied to clipboard')
  }

  const handleMailto = (email: Email) => {
    const body = encodeURIComponent(email.generated_body || '')
    const subject = encodeURIComponent(email.subject)
    const to = email.recipient ? encodeURIComponent(email.recipient) : ''
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Email Assistant"
        subtitle="Write professional emails in seconds with AI"
        icon={<Mail className="w-5 h-5" />}
      />

      {/* Generator */}
      <div className="card p-4 mb-6">
        {/* Type selector */}
        <label className="label">Email Type</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
          {emailTypes.map((t) => (
            <button
              key={t.value}
              onClick={() => setEmailType(t.value)}
              className={`p-3 rounded-xl border text-left transition-all ${
                emailType === t.value
                  ? 'border-brand-600 bg-brand-600/15'
                  : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
              }`}
            >
              <div className="text-lg mb-0.5">{t.icon}</div>
              <div className="text-sm font-semibold text-white">{t.label}</div>
              <div className="text-xs text-slate-400">{t.desc}</div>
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Recipient (optional)</label>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="input-field"
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label className="label">Subject (optional — AI can suggest)</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input-field"
              placeholder="Quick chat about your stack"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="label">Tone</label>
          <div className="flex flex-wrap gap-2">
            {tones.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium capitalize transition-all border ${
                  tone === t
                    ? 'border-brand-600 bg-brand-600/20 text-brand-300'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <label className="label flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-400" /> Key points to include
        </label>
        <textarea
          value={keyPoints}
          onChange={(e) => setKeyPoints(e.target.value)}
          rows={4}
          className="input-field resize-none"
          placeholder={`e.g. We help startups automate admin work with AI. Offer a free 14-day trial. Mention we integrate with their existing tools. Ask for a 15-min demo next week.`}
        />

        <div className="flex justify-end mt-4">
          <button onClick={handleGenerate} disabled={generating} className="btn-primary text-sm">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Writing...' : 'Generate Email'}
          </button>
        </div>
      </div>

      {/* History */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : emails.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No emails yet"
          description="Pick an email type, add your key points, and let AI draft a polished, ready-to-send email."
        />
      ) : (
        <div className="space-y-4">
          {emails.map((email) => (
            <div key={email.id} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 capitalize">
                    {emailTypes.find((t) => t.value === email.email_type)?.icon} {email.email_type.replace('_', ' ')}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 capitalize">
                    {email.tone}
                  </span>
                  <span className="text-xs text-slate-500">
                    · {new Date(email.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleMailto(email)} className="btn-ghost text-xs">
                    <Mail className="w-3.5 h-3.5" /> Open
                  </button>
                  <button onClick={() => handleCopy(email)} className="btn-ghost text-xs">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                  <button
                    onClick={() => handleDelete(email.id)}
                    className="btn-ghost text-xs text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mb-2">
                <span className="text-xs text-slate-500">Subject: </span>
                <span className="font-semibold text-white">{email.subject}</span>
              </div>
              {email.recipient && (
                <p className="text-xs text-slate-500 mb-2">To: {email.recipient}</p>
              )}
              {email.generated_body && (
                <div className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed bg-slate-900/50 rounded-xl p-4 mt-2 border border-slate-800">
                  {email.generated_body}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
