import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { askAssistant } from '../lib/ai'
import PageHeader from '../components/ui/PageHeader'
import { Sparkles, Send, Loader2, Bot, User, Key, ExternalLink, AlertCircle } from 'lucide-react'
import { getUserAPIKeyStatus, type UserAPIKeyStatus } from '../lib/userKeys'
import toast from 'react-hot-toast'

interface Msg { role: 'user' | 'ai'; text: string }

const suggestions = [
  'How was business today?',
  'Who bought cement last month?',
  'Which customers should I follow up?',
  'What should I reorder?',
  'Why did sales drop?',
]

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hlup])(.+)$/gm, '<p>$1</p>')
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [keyStatus, setKeyStatus] = useState<UserAPIKeyStatus | null>(null)

  // On mount, check if the user has an OpenRouter key.
  // If not, the UI shows a "connect your AI" card instead of failing on every send.
  useEffect(() => {
    getUserAPIKeyStatus()
      .then(setKeyStatus)
      .catch(() => setKeyStatus({ has_key: false, provider: null, hint: null, model: null }))
  }, [])

  const send = async (text: string, isBriefing = false) => {
    const q = text.trim()
    if (!q || loading) return
    setInput('')
    const next: Msg[] = [...messages, { role: 'user', text: q }]
    setMessages(next)
    setLoading(true)
    try {
      const reply = await askAssistant(q, isBriefing)
      setMessages([...next, { role: 'ai', text: reply }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      // If the error is "no key configured", show the connect card in chat
      if (/not configured|API key|sk-or-v1/i.test(msg)) {
        setMessages([...next, { role: 'ai', text: `__no_key__` }])
      } else {
        toast.error(msg)
        setMessages([...next, { role: 'ai', text: '⚠️ ' + msg }])
      }
    } finally {
      setLoading(false)
    }
  }

  const briefing = async () => {
    setLoading(true)
    setMessages((m) => [...m, { role: 'user', text: 'Give me my morning briefing' }])
    try {
      const reply = await askAssistant('', true)
      setMessages((m) => [...m, { role: 'ai', text: reply }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      if (/not configured|API key|sk-or-v1/i.test(msg)) {
        setMessages((m) => [...m, { role: 'ai', text: `__no_key__` }])
      } else {
        toast.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  // Detect the "no key" inline state so we can render a special card
  const lastIsNoKey = messages.length > 0 && messages[messages.length - 1].text === '__no_key__'

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="AI Assistant"
        subtitle="Ask anything about your business — sales, customers, stock, follow-ups"
        icon={<Bot className="w-5 h-5" />}
        action={<button onClick={briefing} disabled={loading || !keyStatus?.has_key} className="btn-primary text-sm"><Sparkles className="w-4 h-4" /> Morning Briefing</button>}
      />

      <div className="card flex flex-col" style={{ minHeight: '60vh' }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-apple-50 flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-apple-500" strokeWidth={1.75} />
              </div>
              <h3 className="text-2xl font-semibold tracking-tight text-ink-800 mb-1">Ask me about your business.</h3>
              <p className="text-[15px] text-ink-500 mb-6">"How was business today?" · "Who bought cement?" · "What should I reorder?"</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={loading || !keyStatus?.has_key}
                    className="px-3.5 py-1.5 rounded-full text-[13px] bg-ink-100 text-ink-700 hover:bg-ink-200 transition-colors disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-apple-500' : 'bg-ink-100'}`}>
                {m.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-apple-500" strokeWidth={1.75} />}
              </div>
              {m.text === '__no_key__' ? (
                <div className="rounded-2xl bg-[#fff4e5] border border-[#ffd9a3] p-5 max-w-[80%]">
                  <div className="flex items-start gap-3">
                    <Key className="w-5 h-5 text-[#ff9500] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                    <div>
                      <p className="text-[15px] font-medium text-[#8a5500] mb-1">Add your OpenRouter key to start</p>
                      <p className="text-[13px] text-[#8a5500]/80 leading-relaxed mb-3">
                        The AI assistant needs an OpenRouter key. Free keys take 2 minutes —
                        get one at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-apple-500 hover:underline font-medium">openrouter.ai/keys <ExternalLink className="w-3 h-3 inline -mt-0.5" /></a>, then paste it in Settings.
                      </p>
                      <Link to="/app/settings" className="btn-primary text-sm inline-flex">
                        <Key className="w-3.5 h-3.5" /> Open Settings
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`rounded-2xl p-3.5 max-w-[80%] ${m.role === 'user' ? 'bg-apple-500 text-white' : 'bg-ink-100 text-ink-800'}`}>
                  {m.role === 'ai' ? (
                    <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
                  ) : (
                    <p className="text-sm">{m.text}</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-ink-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-apple-500" strokeWidth={1.75} />
              </div>
              <div className="bg-ink-100 rounded-2xl p-3.5 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-apple-500" />
                <span className="text-sm text-ink-500">Analyzing your business...</span>
              </div>
            </div>
          )}
        </div>

        {/* "AI not configured" persistent banner */}
        {keyStatus !== null && !keyStatus.has_key && (
          <div className="border-t border-ink-200 bg-[#fff4e5] px-5 py-3 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-[#ff9500] flex-shrink-0" strokeWidth={1.75} />
            <p className="text-[13px] text-[#8a5500] flex-1">
              AI not configured. <Link to="/app/settings" className="text-apple-500 hover:underline font-medium">Add your OpenRouter key →</Link>
            </p>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-ink-200 p-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(input)}
            placeholder={keyStatus?.has_key ? 'Ask about sales, customers, stock...' : 'Add your OpenRouter key in Settings to start'}
            className="input-field flex-1"
            disabled={loading || !keyStatus?.has_key}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim() || !keyStatus?.has_key}
            className="btn-primary px-5"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
