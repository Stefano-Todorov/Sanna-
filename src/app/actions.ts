'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateProfile(fields: Record<string, unknown>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('profiles').upsert(
    { user_id: user.id, email: user.email ?? '', ...fields },
    { onConflict: 'user_id' }
  )

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings')
  return { success: true }
}

export async function saveCoachMessage(role: 'user' | 'assistant', content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('coach_messages').insert({
    user_id: user.id,
    role,
    content,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function saveStrategy(strategyData: Record<string, unknown>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Check if there's an existing in-progress strategy
  const { data: existing } = await supabase
    .from('strategies')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .single()

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('strategies')
      .update({ ...strategyData, updated_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    // Create new
    const { error } = await supabase
      .from('strategies')
      .insert({ user_id: user.id, ...strategyData })

    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/strategy')
  return { success: true }
}

export async function generateTelegramLinkCode() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const code = Math.random().toString(36).substring(2, 8).toUpperCase()

  const { error } = await supabase.from('profiles').upsert(
    { user_id: user.id, email: user.email ?? '', telegram_link_code: code },
    { onConflict: 'user_id' }
  )

  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return { code }
}

export async function unlinkTelegram() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ telegram_chat_id: null, telegram_link_code: null })
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return { success: true }
}

export async function addMemory(category: string, content: string, source: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('memories').insert({
    user_id: user.id,
    category,
    content,
    source,
  })

  if (error) return { error: error.message }
  return { success: true }
}
