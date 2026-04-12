import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL, buildCoachSystemPrompt } from '@/lib/claude'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`${user.id}:coach`, RATE_LIMITS.coach)
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

  // Load profile, strategy, and memories for context
  const [{ data: profile }, { data: strategy }, { data: memories }] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('strategies').select('*').eq('user_id', user.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('memories').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
  ])

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const systemPrompt = buildCoachSystemPrompt({
    profile,
    strategy,
    memories: memories ?? [],
  })

  // Save user message
  await supabase.from('coach_messages').insert({
    user_id: user.id,
    role: 'user',
    content: message,
  })

  const messages = [
    ...history,
    { role: 'user' as const, content: message },
  ]

  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: 1024,
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
