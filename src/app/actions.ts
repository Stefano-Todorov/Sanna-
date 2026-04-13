'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendTelegramMessageWithButtons } from '@/lib/telegram'
import { schedulePost as metricoolSchedulePost, MetricoolNotConfiguredError } from '@/lib/metricool'

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

type DraftInput = {
  draftText: string
  platforms: string[]
  mediaUrls?: string[]
  scheduledAt?: string
}

export async function createDraft(input: DraftInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const service = createServiceClient()

  const { data: queued, error } = await service
    .from('content_queue')
    .insert({
      user_id: user.id,
      draft_text: input.draftText,
      platforms: input.platforms,
      media_urls: input.mediaUrls ?? [],
      scheduled_at: input.scheduledAt ?? null,
      status: 'pending_approval',
    })
    .select('id')
    .single()

  if (error || !queued) return { error: error?.message ?? 'Insert failed' }

  const { data: profile } = await service
    .from('profiles')
    .select('telegram_chat_id')
    .eq('user_id', user.id)
    .single()

  if (profile?.telegram_chat_id) {
    const preview = input.draftText.length > 500 ? input.draftText.slice(0, 500) + '…' : input.draftText
    const text = `📝 *New draft ready*\n\nPlatforms: ${input.platforms.join(', ')}\n\n${preview}`
    try {
      const msg = await sendTelegramMessageWithButtons(profile.telegram_chat_id, text, [
        { label: '✅ Approve', callbackData: `approve:${queued.id}` },
        { label: '❌ Reject', callbackData: `reject:${queued.id}` },
      ])
      await service
        .from('content_queue')
        .update({ approval_message_id: String(msg.message_id) })
        .eq('id', queued.id)
    } catch (e) {
      console.error('Failed to send approval message', e)
    }
  }

  revalidatePath('/dashboard/queue')
  return { success: true, id: queued.id }
}

type TrialReelInput = {
  userId: string
  draftText: string
  mediaUrls?: string[]
  hypothesis?: string
  scheduledAt?: string
}

export async function queueTrialReel(input: TrialReelInput) {
  const service = createServiceClient()
  const { data: row, error } = await service
    .from('trial_reel_queue')
    .insert({
      user_id: input.userId,
      draft_text: input.draftText,
      media_urls: input.mediaUrls ?? [],
      hypothesis: input.hypothesis ?? null,
      scheduled_at: input.scheduledAt ?? new Date().toISOString(),
      status: 'pending_approval',
    })
    .select('id')
    .single()

  if (error || !row) return { error: error?.message ?? 'Insert failed' }

  const { data: profile } = await service
    .from('profiles')
    .select('telegram_chat_id')
    .eq('user_id', input.userId)
    .single()

  if (profile?.telegram_chat_id) {
    const text = `🧪 *Trial Reel proposal*\n\n${input.hypothesis ? `_${input.hypothesis}_\n\n` : ''}${input.draftText.slice(0, 400)}`
    try {
      const msg = await sendTelegramMessageWithButtons(profile.telegram_chat_id, text, [
        { label: '✅ Run experiment', callbackData: `approve_trial:${row.id}` },
        { label: '❌ Skip', callbackData: `reject_trial:${row.id}` },
      ])
      await service
        .from('trial_reel_queue')
        .update({ approval_message_id: String(msg.message_id) })
        .eq('id', row.id)
    } catch (e) {
      console.error('Failed to send trial approval message', e)
    }
  }

  return { success: true, id: row.id }
}

export async function approveQueuedPost(queueId: string) {
  const service = createServiceClient()

  const { data: row, error: readErr } = await service
    .from('content_queue')
    .select('*')
    .eq('id', queueId)
    .single()

  if (readErr || !row) return { error: 'Queue row not found' }
  if (row.status !== 'pending_approval' && row.status !== 'approved') {
    return { error: `Cannot approve — status is ${row.status}` }
  }

  const { data: profile } = await service
    .from('profiles')
    .select('metricool_brand_id')
    .eq('user_id', row.user_id)
    .single()

  try {
    const scheduled = await metricoolSchedulePost({
      brandId: profile?.metricool_brand_id ?? '',
      draftText: row.draft_text,
      mediaUrls: row.media_urls ?? [],
      platforms: row.platforms ?? [],
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
      smart: !row.scheduled_at,
    })

    await service
      .from('content_queue')
      .update({
        status: 'scheduled',
        metricool_post_id: scheduled.postId,
        scheduled_at: scheduled.scheduledAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', queueId)

    return { success: true, scheduledAt: scheduled.scheduledAt }
  } catch (e) {
    const notConfigured = e instanceof MetricoolNotConfiguredError
    const message = e instanceof Error ? e.message : String(e)
    await service
      .from('content_queue')
      .update({
        status: notConfigured ? 'approved' : 'failed',
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', queueId)
    return { error: message, notConfigured }
  }
}

export async function rejectQueuedPost(queueId: string) {
  const service = createServiceClient()
  const { error } = await service
    .from('content_queue')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', queueId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function approveTrialReel(id: string) {
  const service = createServiceClient()
  const { error } = await service
    .from('trial_reel_queue')
    .update({
      status: 'approved',
      scheduled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function rejectTrialReel(id: string) {
  const service = createServiceClient()
  const { error } = await service
    .from('trial_reel_queue')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function createTemplate(data: Record<string, unknown>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: row, error } = await supabase
    .from('templates')
    .insert({ user_id: user.id, ...data })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard/templates')
  revalidatePath('/dashboard')
  return { id: row.id }
}

export async function updateTemplate(id: string, fields: Record<string, unknown>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('templates')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/templates')
  revalidatePath(`/dashboard/templates/${id}`)
  return { success: true }
}

export async function recordTemplateUse(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: row } = await supabase
    .from('templates')
    .select('times_used')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!row) return { error: 'Not found' }

  const { error } = await supabase
    .from('templates')
    .update({ times_used: row.times_used + 1, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/templates')
  revalidatePath(`/dashboard/templates/${id}`)
  return { success: true }
}

export async function rateTemplate(id: string, direction: 'up' | 'down') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const column = direction === 'up' ? 'thumbs_up' : 'thumbs_down'
  const { data: row } = await supabase
    .from('templates')
    .select(column)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!row) return { error: 'Not found' }

  const current = (row as Record<string, number>)[column] ?? 0
  const { error } = await supabase
    .from('templates')
    .update({ [column]: current + 1, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/templates')
  revalidatePath(`/dashboard/templates/${id}`)
  return { success: true }
}

export async function setTemplateArchived(id: string, archived: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('templates')
    .update({ archived, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/templates')
  revalidatePath(`/dashboard/templates/${id}`)
  return { success: true }
}

export async function deleteTemplate(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/templates')
  return { success: true }
}

export async function listTemplates(filters?: { platform?: string; source?: string; archived?: boolean }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  let query = supabase
    .from('templates')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (filters?.platform) query = query.eq('platform', filters.platform)
  if (filters?.source) query = query.eq('source', filters.source)
  if (typeof filters?.archived === 'boolean') query = query.eq('archived', filters.archived)

  const { data, error } = await query
  if (error) return { error: error.message }
  return { templates: data }
}

export async function listRecentBriefings(limit = 4) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('trend_briefings')
    .select('*')
    .eq('user_id', user.id)
    .order('week_start', { ascending: false })
    .limit(limit)

  if (error) return { error: error.message }
  return { briefings: data }
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
