import { useState } from 'react'
import { askAssistant } from '../lib/ai'
import PageHeader from '../components/ui/PageHeader'
import { Sparkles, Send, Loader2, Bot, User } from 'lucide-react'
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
      toast.error(err instanceof Error ? err.message : 'Failed')
      setMessages([...next, { role: 'ai', text: '⚠️ ' + (err instanceof Error ? err.message : 'Something went wrong.') }])
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
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="AI Assistant"
        subtitle="Ask anything about your business — sales, customers, stock, follow-ups"
        icon={<Bot className="w-5 h-5" />}
        action={<button onClick={briefing} disabled={loading} className="btn-primary text-sm"><Sparkles className="w-4 h-4" /> Morning Briefing</button>}
      />

      <div className="card flex flex-col" style={{ minHeight: '60vh' }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-brand-600/15 flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-brand-400" />
              </div>
              <h3 className="font-semibold text-white mb-1">Ask me about your business</h3>
              <p className="text-sm text-slate-400 mb-6">Like: "How was business today?" or "Who bought cement?"</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="px-3 py-1.5 rounded-full text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all border border-slate-700">{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-brand-600' : 'bg-slate-800'}`}>
                {m.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-brand-400" />}
              </div>
              <div className={`rounded-2xl p-3.5 max-w-[80%] ${m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                {m.role === 'ai' ? (
                  <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
                ) : (
                  <p className="text-sm">{m.text}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-brand-400" />
              </div>
              <div className="bg-slate-800 rounded-2xl p-3.5 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                <span className="text-sm text-slate-400">Analyzing your business...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-800 p-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(input)}
            placeholder="Ask about sales, customers, stock..."
            className="input-field flex-1"
            disabled={loading}
          />
          <button onClick={() => send(input)} disabled={loading || !input.trim()} className="btn-primary px-4">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
