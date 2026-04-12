'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import type { CoachMessage } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  initialHistory: CoachMessage[]
  mode?: 'coach' | 'strategy'
}

interface DisplayMessage {
  role: 'user' | 'assistant'
  content: string
}

const COACH_SUGGESTIONS = [
  'Build me a content strategy for my niche',
  'Write me 5 hook ideas for my next video',
  'What content should I make this week?',
  'How should I market my product on social?',
]

const STRATEGY_SUGGESTIONS = [
  "Let's build my content strategy from scratch",
  "I need help defining my niche positioning",
  "Help me figure out my content pillars",
  "What should my posting schedule look like?",
]

export function CoachChat({ initialHistory, mode = 'coach' }: Props) {
  const [messages, setMessages] = useState<DisplayMessage[]>(
    initialHistory.map(m => ({ role: m.role, content: m.content }))
  )
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const suggestions = mode === 'strategy' ? STRATEGY_SUGGESTIONS : COACH_SUGGESTIONS

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      const sh = inputRef.current.scrollHeight
      inputRef.current.style.height = Math.min(sh, 128) + 'px'
      inputRef.current.style.overflowY = sh > 128 ? 'auto' : 'hidden'
    }
  }, [input])

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return

    const userMsg: DisplayMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    const history = [...messages, userMsg].slice(-20).map(m => ({
      role: m.role,
      content: m.content,
    }))

    const assistantMsg: DisplayMessage = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    const endpoint = mode === 'strategy' ? '/api/coach/strategy' : '/api/coach'

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
    })

    if (!res.body) { setStreaming(false); return }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: updated[updated.length - 1].content + chunk,
        }
        return updated
      })
    }

    setStreaming(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-4 sm:px-6 pb-10" style={{ minHeight: 'calc(100vh - 140px)' }}>
            <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center mb-5 text-white font-bold text-lg">
              S
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-1">
              {mode === 'strategy' ? "Let's build your strategy" : 'What can I help with?'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-8">
              {mode === 'strategy'
                ? "I'll ask you sharp questions about your niche, audience, and goals. Then I'll build your complete content strategy."
                : 'I know your niche, audience, and strategy. Ask me anything about your content.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {suggestions.map(text => (
                <button key={text} onClick={() => sendMessage(text)}
                  className="text-left px-4 py-3 rounded-xl border border-border dark:border-white/[0.07] bg-card dark:bg-white/[0.03] text-sm text-foreground hover:bg-muted dark:hover:bg-white/[0.06] hover:border-border transition-colors">
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center shrink-0 text-white text-[11px] font-semibold">
                    S
                  </div>
                )}
                <div className={cn(
                  'max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-teal-600 text-white rounded-tr-sm'
                    : 'bg-muted dark:bg-white/[0.04] border border-border dark:border-white/[0.06] text-foreground rounded-tl-sm'
                )}>
                  {msg.content}
                  {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
                    <span className="inline-block w-1.5 h-4 bg-teal-500 ml-0.5 animate-pulse rounded-full" />
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="px-4 sm:px-6 py-4 border-t border-border bg-background">
        <div className="relative max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            className="w-full bg-muted dark:bg-white/[0.04] border border-border dark:border-white/[0.08] rounded-xl py-3.5 pl-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
            style={{ minHeight: 48, maxHeight: 128 }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-teal-600 hover:bg-teal-700 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-1.5">
          Enter to send &middot; Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
