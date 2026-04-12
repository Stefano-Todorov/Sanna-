import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL, buildStrategySystemPrompt } from '@/lib/claude'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`${user.id}:strategy`, RATE_LIMITS.strategy)
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await request.json()
  const message = typeof body.message === 'string' ? body.message.slice(0, 10000) : ''
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const rawHistory = Array.isArray(body.history) ? body.history.slice(-100) : []
  const history = rawHistory.filter(
    (m: unknown): m is { role: 'user' | 'assistant'; content: string } =>
      !!m && typeof m === 'object' &&
      'role' in m && (m.role === 'user' || m.role === 'assistant') &&
      'content' in m && typeof m.content === 'string'
  ).map((m: { role: 'user' | 'assistant'; content: string }) => ({
    role: m.role,
    content: m.content.slice(0, 10000),
  }))

  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const systemPrompt = buildStrategySystemPrompt({ profile })

  // Save user message to coach_messages
  await supabase.from('coach_messages').insert({
    user_id: user.id,
    role: 'user',
    content: message,
  })

  // Ensure an in-progress strategy exists
  const { data: existingStrategy } = await supabase
    .from('strategies')
    .select('id, exchange_count')
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .single()

  let strategyId = existingStrategy?.id
  const exchangeCount = (existingStrategy?.exchange_count ?? 0) + 1

  if (!strategyId) {
    const { data: newStrategy } = await supabase
      .from('strategies')
      .insert({ user_id: user.id, status: 'in_progress', exchange_count: 1 })
      .select('id')
      .single()
    strategyId = newStrategy?.id
  } else {
    await supabase
      .from('strategies')
      .update({ exchange_count: exchangeCount, updated_at: new Date().toISOString() })
      .eq('id', strategyId)
  }

  const messages = [
    ...history,
    { role: 'user' as const, content: message },
  ]

  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  })

  let fullText = ''
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text
          fullText += text
          controller.enqueue(encoder.encode(text))
        }
      }

      // Save assistant response
      await supabase.from('coach_messages').insert({
        user_id: user.id,
        role: 'assistant',
        content: fullText,
      })

      // Check if strategy is ready
      if (fullText.includes('STRATEGY_READY')) {
        const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/)
        if (jsonMatch && strategyId) {
          try {
            const strategyData = JSON.parse(jsonMatch[1])
            await supabase
              .from('strategies')
              .update({
                status: 'completed',
                pillars: strategyData.pillars ?? [],
                hooks_playbook: strategyData.hooks_playbook ?? [],
                platform_breakdown: strategyData.platform_breakdown ?? {},
                seven_day_plan: strategyData.seven_day_plan ?? [],
                session_messages: [...history, { role: 'user', content: message }, { role: 'assistant', content: fullText }],
                updated_at: new Date().toISOString(),
              })
              .eq('id', strategyId)
          } catch {
            // JSON parse failed — strategy stays in_progress
          }
        }
      }

      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
