import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getTelegramBot } from '@/lib/telegram'
import { anthropic, MODEL, buildCoachSystemPrompt, extractTemplateFromLink } from '@/lib/claude'
import { extractFirstVideoUrl } from '@/lib/templates'
import { runAgent } from '@/lib/agent/orchestrator'
import {
  approveQueuedPost,
  rejectQueuedPost,
  approveTrialReel,
  rejectTrialReel,
} from '@/app/actions'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const bot = getTelegramBot()

  // Handle callback queries (inline keyboard buttons)
  if (body.callback_query) {
    const callbackData: string = body.callback_query.data ?? ''
    const chatId = String(body.callback_query.message?.chat?.id)
    const messageId = body.callback_query.message?.message_id
    await bot.telegram.answerCbQuery(body.callback_query.id)

    const [action, id] = callbackData.split(':')
    let resultText = ''

    if (action === 'approve' && id) {
      const res = await approveQueuedPost(id)
      if (res.error && !res.notConfigured) {
        resultText = `⚠️ Approval failed: ${res.error}`
      } else if (res.notConfigured) {
        resultText = '✅ Approved (Metricool not yet connected — will schedule once credentials are set)'
      } else {
        resultText = `✅ Approved — scheduled via Metricool for ${formatTime(res.scheduledAt)}`
      }
    } else if (action === 'reject' && id) {
      await rejectQueuedPost(id)
      resultText = '❌ Rejected — draft will not be posted'
    } else if (action === 'approve_trial' && id) {
      await approveTrialReel(id)
      resultText = '🧪 Agent posted Trial Reel — watch for results in 6hrs'
    } else if (action === 'reject_trial' && id) {
      await rejectTrialReel(id)
      resultText = '❌ Trial Reel skipped'
    } else {
      resultText = `Unknown action: ${callbackData}`
    }

    if (messageId) {
      try {
        await bot.telegram.editMessageReplyMarkup(chatId, messageId, undefined, { inline_keyboard: [] })
      } catch {}
    }
    await bot.telegram.sendMessage(chatId, resultText)
    return NextResponse.json({ ok: true })
  }

  const msg = body.message
  if (!msg?.text) return NextResponse.json({ ok: true })

  const chatId = String(msg.chat.id)
  const text = msg.text.trim()
  const supabase = createServiceClient()

  // /start — link account
  if (text.startsWith('/start')) {
    const code = text.split(' ')[1]?.trim()
    if (!code) {
      await bot.telegram.sendMessage(chatId,
        "Welcome to Sana! To connect your account:\n\n" +
        "1. Go to your Sana dashboard > Settings\n" +
        "2. Click 'Connect Telegram'\n" +
        "3. Send me the code: /start YOUR_CODE"
      )
      return NextResponse.json({ ok: true })
    }

    // Find profile with this link code
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('telegram_link_code', code.toUpperCase())
      .single()

    if (!profile) {
      await bot.telegram.sendMessage(chatId, "Invalid code. Please check your dashboard and try again.")
      return NextResponse.json({ ok: true })
    }

    // Link the account
    await supabase
      .from('profiles')
      .update({ telegram_chat_id: chatId, telegram_link_code: null })
      .eq('user_id', profile.user_id)

    await bot.telegram.sendMessage(chatId,
      "Connected! I'm Sana, your marketing agent.\n\n" +
      "Commands:\n" +
      "/coach <question> — Ask me anything\n" +
      "/help — See all commands\n\n" +
      "Or just send me a message and I'll respond as your coach."
    )
    return NextResponse.json({ ok: true })
  }

  // /help
  if (text === '/help') {
    await bot.telegram.sendMessage(chatId,
      "Sana Commands:\n\n" +
      "/coach <question> — Ask your AI coach\n" +
      "/help — Show this message\n\n" +
      "Or just send any message and I'll respond as your coach."
    )
    return NextResponse.json({ ok: true })
  }

  // Find linked profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .single()

  if (!profile) {
    await bot.telegram.sendMessage(chatId,
      "I don't recognize this Telegram account. Link it in your Sana dashboard > Settings."
    )
    return NextResponse.json({ ok: true })
  }

  // Template ingestion — any video URL in the message
  const videoUrl = extractFirstVideoUrl(text)
  if (videoUrl) {
    await bot.telegram.sendMessage(chatId, 'Got it — extracting template…')
    try {
      const userContext = text.replace(videoUrl, '').trim()
      const extraction = await extractTemplateFromLink({ url: videoUrl, userContext, profile })
      const { data: row, error } = await supabase
        .from('templates')
        .insert({
          user_id: profile.user_id,
          source: 'manual',
          source_url: videoUrl,
          ...extraction,
        })
        .select('id')
        .single()
      if (error || !row) throw new Error(error?.message ?? 'Insert failed')

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const link = appUrl ? `${appUrl}/dashboard/templates/${row.id}` : `/dashboard/templates/${row.id}`
      await bot.telegram.sendMessage(chatId,
        `✅ Template saved: *${extraction.title}*\n\nHook: ${extraction.hook_formula ?? '—'}\nScenes: ${extraction.scenes.length}\n\nReview & edit: ${link}`,
        { parse_mode: 'Markdown' }
      )
    } catch (e) {
      await bot.telegram.sendMessage(chatId,
        `⚠️ Couldn't extract template: ${e instanceof Error ? e.message : 'unknown error'}`
      )
    }
    return NextResponse.json({ ok: true })
  }

  // /coach or plain text — AI response
  const coachMessage = text.startsWith('/coach') ? text.replace('/coach', '').trim() : text
  if (!coachMessage) {
    await bot.telegram.sendMessage(chatId, "What would you like to know? Just type your question.")
    return NextResponse.json({ ok: true })
  }

  // Load strategy and memories for context
  const [{ data: strategy }, { data: memories }] = await Promise.all([
    supabase.from('strategies').select('*').eq('user_id', profile.user_id).eq('status', 'completed').order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('memories').select('*').eq('user_id', profile.user_id).order('created_at', { ascending: false }).limit(20),
  ])

  const systemPrompt = buildCoachSystemPrompt({ profile, strategy, memories: memories ?? [] })

  // Get recent conversation for context
  const { data: recentMessages } = await supabase
    .from('coach_messages')
    .select('role, content')
    .eq('user_id', profile.user_id)
    .order('created_at', { ascending: false })
    .limit(10)

  const history = (recentMessages ?? []).reverse().map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // Save user message
  await supabase.from('coach_messages').insert({
    user_id: profile.user_id,
    role: 'user',
    content: coachMessage,
  })

  // Get Claude response (non-streaming for Telegram)
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      ...history,
      { role: 'user', content: coachMessage },
    ],
  })

  const assistantText = response.content[0].type === 'text' ? response.content[0].text : ''

  // Save assistant response
  await supabase.from('coach_messages').insert({
    user_id: profile.user_id,
    role: 'assistant',
    content: assistantText,
  })

  // Telegram has a 4096 char limit per message
  if (assistantText.length > 4000) {
    const chunks: string[] = []
    for (let i = 0; i < assistantText.length; i += 4000) {
      chunks.push(assistantText.slice(i, i + 4000))
    }
    for (const chunk of chunks) {
      await bot.telegram.sendMessage(chatId, chunk)
    }
  } else {
    await bot.telegram.sendMessage(chatId, assistantText)
  }

  return NextResponse.json({ ok: true })
}

function formatTime(iso?: string) {
  if (!iso) return 'soon'
  try {
    return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}
