'use client'

import { useState } from 'react'
import { generateTelegramLinkCode, unlinkTelegram } from '@/app/actions'
import { Send } from 'lucide-react'

interface Props {
  isLinked: boolean
  chatId: string | null
}

export function TelegramLink({ isLinked, chatId }: Props) {
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleGenerateCode() {
    setLoading(true)
    const result = await generateTelegramLinkCode()
    if (result.code) setCode(result.code)
    setLoading(false)
  }

  async function handleUnlink() {
    setLoading(true)
    await unlinkTelegram()
    setLoading(false)
    window.location.reload()
  }

  if (isLinked) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-teal-600/15 flex items-center justify-center">
            <Send size={18} className="text-teal-500" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Telegram Connected</h3>
            <p className="text-sm text-muted-foreground">Chat ID: {chatId}</p>
          </div>
        </div>
        <button onClick={handleUnlink} disabled={loading}
          className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50">
          {loading ? 'Unlinking...' : 'Disconnect Telegram'}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          <Send size={18} className="text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Connect Telegram</h3>
          <p className="text-sm text-muted-foreground">Get briefs, reminders, and chat with Sana via Telegram</p>
        </div>
      </div>

      {code ? (
        <div className="mt-3 space-y-3">
          <div className="bg-muted dark:bg-white/[0.04] rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground mb-2">Send this to @YourSanaBot on Telegram:</p>
            <p className="text-2xl font-mono font-bold text-teal-500 tracking-widest">/start {code}</p>
          </div>
          <p className="text-xs text-muted-foreground">This code expires when used or when you generate a new one.</p>
        </div>
      ) : (
        <button onClick={handleGenerateCode} disabled={loading}
          className="mt-3 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50">
          {loading ? 'Generating...' : 'Generate Link Code'}
        </button>
      )}
    </div>
  )
}
