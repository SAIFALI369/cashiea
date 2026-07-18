import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, AI_FUNCTION_URL } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { LifeBuoy, Mail, Loader2, Send, CheckCircle2, ExternalLink, Clock, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

const SUPPORT_EMAIL = 'supportcashiea@gmail.com'

export default function Support() {
  const { user, profile } = useAuth()
  const [name, setName] = useState(profile?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState('general')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [mailtoUrl, setMailtoUrl] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error('Please fill in your name, email, and message')
      return
    }
    setSending(true)
    try {
      // POST to the support-email edge function
      const url = AI_FUNCTION_URL.replace('ai-automation', 'support-email')
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({
          name,
          email,
          subject: subject || `${category} enquiry`,
          message: `[${category}]\n\n${message}`,
        }),
      })
      const data = await res.json().catch(() => ({ error: 'No response from server' }))
      if (!res.ok) throw new Error(data?.error || 'Failed to send')

      if (data.delivered) {
        setSent(true)
        toast.success('Message sent! We’ll get back to you soon.')
      } else if (data.mailto) {
        // Fallback: open the user's email client pre-filled
        setMailtoUrl(data.mailto)
        setSent(true)
        toast('Opening your email app to send the message…', { icon: '✉️' })
        window.location.href = data.mailto
      }
    } catch (err) {
      // Final fallback: build a mailto link client-side
      const body = `Name: ${name}\nEmail: ${email}\n\n[${category}]\n\n${message}`
      const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[BizAutomate Support] ${subject || category}`)}&body=${encodeURIComponent(body)}`
      setMailtoUrl(mailto)
      setSent(true)
      toast('Opening your email app to send the message…', { icon: '✉️' })
      window.location.href = mailto
    } finally {
      setSending(false)
    }
  }

  if (sent && !mailtoUrl) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Support" subtitle="We’re here to help" icon={<LifeBuoy className="w-5 h-5" />} />
        <div className="card p-10 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Message sent! ✅</h2>
          <p className="text-slate-400 mb-6">Thanks for reaching out. Our team will reply to <span className="text-white">{email}</span> as soon as possible.</p>
          <button
            onClick={() => { setSent(false); setSubject(''); setMessage('') }}
            className="btn-primary"
          >
            Send another message
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Support" subtitle="Tell us about your problem or what you need" icon={<LifeBuoy className="w-5 h-5" />} />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Your Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Jane Doe" required />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="you@email.com" required />
              </div>
            </div>

            <div>
              <label className="label">What do you need help with?</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { v: 'general', l: 'General' },
                  { v: 'bug', l: 'Bug / Error' },
                  { v: 'billing', l: 'Billing' },
                  { v: 'feature', l: 'Feature request' },
                ].map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => setCategory(c.v)}
                    className={`py-2 rounded-xl text-sm font-medium border transition-all ${category === c.v ? 'border-brand-600 bg-brand-600/15 text-white' : 'border-slate-700 text-slate-400 hover:text-white'}`}
                  >
                    {c.l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field" placeholder="Brief summary of your issue" />
            </div>

            <div>
              <label className="label flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-400" /> Describe your problem or need *
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                className="input-field resize-none"
                placeholder="Tell us what’s happening, what you’re trying to do, and what you need. The more detail, the faster we can help."
                required
              />
              <p className="text-xs text-slate-500 mt-1">{message.length} / 10,000 characters</p>
            </div>

            {mailtoUrl && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-600/30 text-sm text-amber-200">
                <p className="font-medium mb-1">✉️ Email app didn’t open?</p>
                <p className="text-amber-200/80 mb-2">If your mail app didn’t launch, send the message manually to <strong>{SUPPORT_EMAIL}</strong>, or click below:</p>
                <a href={mailtoUrl} className="btn-secondary text-xs inline-flex"><ExternalLink className="w-3.5 h-3.5" /> Open email manually</a>
              </div>
            )}

            <button type="submit" disabled={sending} className="btn-primary w-full py-3">
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {sending ? 'Sending…' : 'Submit'}
            </button>
            <p className="text-xs text-slate-500 text-center">Your message goes straight to our support team at {SUPPORT_EMAIL}</p>
          </form>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-5 h-5 text-brand-400" />
              <h3 className="font-semibold text-white">Email us</h3>
            </div>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-400 hover:text-brand-300 break-all">{SUPPORT_EMAIL}</a>
            <p className="text-xs text-slate-500 mt-2">For any question, bug, billing issue, or feature request.</p>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold text-white">Response time</h3>
            </div>
            <p className="text-sm text-slate-400">We typically reply within <span className="text-white font-medium">24 hours</span>, Monday–Friday.</p>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-white mb-2">Quick tips</h3>
            <ul className="text-sm text-slate-400 space-y-1.5">
              <li>• Include screenshots if it’s a bug</li>
              <li>• Mention the page where it happened</li>
              <li>• Tell us your business type & needs</li>
              <li>• For billing, include your email</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
