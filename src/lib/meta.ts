// Meta Graph API — direct posting for Trial Reels only.
// Trial Reels = IG Reels that Meta shows only to non-followers for testing.
// Two-step publish: create media container → publish.
// Docs: https://developers.facebook.com/docs/instagram-platform/content-publishing

export class MetaNotConfiguredError extends Error {
  constructor(missing: string) {
    super(`Meta Graph API not configured: missing ${missing}`)
    this.name = 'MetaNotConfiguredError'
  }
}

const GRAPH_VERSION = 'v21.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

function getToken() {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) throw new MetaNotConfiguredError('META_ACCESS_TOKEN')
  return token
}

type CreateTrialReelInput = {
  igUserId: string
  videoUrl: string
  caption?: string
}

export async function createTrialReel(input: CreateTrialReelInput): Promise<{
  creationId: string
  mediaId: string
}> {
  const token = getToken()
  if (!input.igUserId) throw new MetaNotConfiguredError('ig_business_account_id on profile')

  // Step 1: create media container with trial flag
  const containerRes = await fetch(
    `${GRAPH_BASE}/${input.igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: input.videoUrl,
        caption: input.caption ?? '',
        is_trial: true,
        access_token: token,
      }),
    }
  )

  if (!containerRes.ok) {
    throw new Error(`Meta createTrialReel container failed: ${containerRes.status} ${await containerRes.text()}`)
  }
  const { id: creationId } = await containerRes.json()

  // Poll container status until FINISHED (up to ~60s; typical reels process fast)
  await waitForContainer(creationId, token)

  // Step 2: publish
  const publishRes = await fetch(
    `${GRAPH_BASE}/${input.igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId, access_token: token }),
    }
  )

  if (!publishRes.ok) {
    throw new Error(`Meta createTrialReel publish failed: ${publishRes.status} ${await publishRes.text()}`)
  }
  const { id: mediaId } = await publishRes.json()
  return { creationId, mediaId }
}

async function waitForContainer(creationId: string, token: string) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(
      `${GRAPH_BASE}/${creationId}?fields=status_code&access_token=${token}`
    )
    if (res.ok) {
      const { status_code } = await res.json()
      if (status_code === 'FINISHED') return
      if (status_code === 'ERROR' || status_code === 'EXPIRED') {
        throw new Error(`Meta container ${status_code}`)
      }
    }
    await new Promise(r => setTimeout(r, 3000))
  }
  throw new Error('Meta container did not finish in time')
}

export async function getMediaInsights(mediaId: string): Promise<Record<string, number>> {
  const token = getToken()
  const metrics = 'plays,reach,likes,comments,shares,saved,total_interactions'
  const res = await fetch(
    `${GRAPH_BASE}/${mediaId}/insights?metric=${metrics}&access_token=${token}`
  )
  if (!res.ok) throw new Error(`Meta getMediaInsights failed: ${res.status}`)
  const data = await res.json()
  const out: Record<string, number> = {}
  for (const row of data.data ?? []) {
    out[row.name] = row.values?.[0]?.value ?? 0
  }
  return out
}
