import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendTelegramMessage } from '@/lib/telegram'
import { getPostStatus, MetricoolNotConfiguredError } from '@/lib/metricool'
import { createTrialReel, MetaNotConfiguredError } from '@/lib/meta'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()
  const summary = {
    trialReelsFired: 0,
    trialReelsFailed: 0,
    metricoolSynced: 0,
    metricoolPosted: 0,
  }

  // --- Pass 1: fire Trial Reels that are approved & due ---
  const { data: dueTrials } = await supabase
    .from('trial_reel_queue')
    .select('*')
    .eq('status', 'approved')
    .lte('scheduled_at', now.toISOString())
    .limit(10)

  for (const row of dueTrials ?? []) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('ig_business_account_id, telegram_chat_id')
      .eq('user_id', row.user_id)
      .single()

    try {
      const videoUrl = row.media_urls?.[0]
      if (!videoUrl) throw new Error('No media_url on trial reel row')

      const { creationId, mediaId } = await createTrialReel({
        igUserId: profile?.ig_business_account_id ?? '',
        videoUrl,
        caption: row.draft_text,
      })

      const postedAt = new Date().toISOString()
      await supabase
        .from('trial_reel_queue')
        .update({
          status: 'posted',
          meta_creation_id: creationId,
          meta_media_id: mediaId,
          posted_at: postedAt,
          results_check_at: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
          updated_at: postedAt,
        })
        .eq('id', row.id)

      await supabase.from('posting_history').insert({
        user_id: row.user_id,
        source: 'meta_direct',
        platform: row.platform,
        external_post_id: mediaId,
        posted_at: postedAt,
        payload: { hypothesis: row.hypothesis, creationId },
      })

      if (profile?.telegram_chat_id) {
        await sendTelegramMessage(
          profile.telegram_chat_id,
          '🧪 Agent posted Trial Reel — watch for results in 6hrs'
        )
      }
      summary.trialReelsFired++
    } catch (e) {
      const notConfigured = e instanceof MetaNotConfiguredError
      const message = e instanceof Error ? e.message : String(e)
      console.error('[cron] trial reel failed', row.id, message)
      if (!notConfigured) {
        await supabase
          .from('trial_reel_queue')
          .update({ status: 'failed', error: message, updated_at: now.toISOString() })
          .eq('id', row.id)
      }
      summary.trialReelsFailed++
    }
  }

  // --- Pass 2: sync Metricool queue for scheduled posts ---
  const { data: scheduled } = await supabase
    .from('content_queue')
    .select('*')
    .eq('status', 'scheduled')
    .not('metricool_post_id', 'is', null)
    .limit(50)

  for (const row of scheduled ?? []) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('metricool_brand_id, telegram_chat_id')
      .eq('user_id', row.user_id)
      .single()

    if (!profile?.metricool_brand_id) continue

    try {
      const status = await getPostStatus(row.metricool_post_id!, profile.metricool_brand_id)
      summary.metricoolSynced++

      if (status.status === 'posted' && row.status !== 'posted') {
        const postedAt = status.postedAt ?? new Date().toISOString()
        await supabase
          .from('content_queue')
          .update({ status: 'posted', posted_at: postedAt, updated_at: postedAt })
          .eq('id', row.id)

        await supabase.from('posting_history').insert({
          user_id: row.user_id,
          source: 'metricool',
          platform: status.platform ?? row.platforms?.[0] ?? 'unknown',
          external_post_id: status.externalId ?? row.metricool_post_id,
          posted_at: postedAt,
          payload: { metricool_post_id: row.metricool_post_id },
        })

        if (profile.telegram_chat_id) {
          const platformLabel = status.platform ?? row.platforms?.[0] ?? 'channel'
          const timeLabel = new Date(postedAt).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit',
          })
          await sendTelegramMessage(
            profile.telegram_chat_id,
            `✅ Posted to ${capitalize(platformLabel)} via Metricool — ${timeLabel}`
          )
        }
        summary.metricoolPosted++
      } else if (status.status === 'failed') {
        await supabase
          .from('content_queue')
          .update({ status: 'failed', error: 'Metricool reported failure', updated_at: now.toISOString() })
          .eq('id', row.id)
      }
    } catch (e) {
      const notConfigured = e instanceof MetricoolNotConfiguredError
      if (notConfigured) continue
      console.error('[cron] metricool sync failed', row.id, e)
    }
  }

  return NextResponse.json({ ok: true, summary })
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
