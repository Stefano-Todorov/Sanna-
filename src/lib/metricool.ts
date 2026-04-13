// Metricool API wrapper — user-approved content scheduling.
// Metricool's public API uses a userId + brand id (blogId) + userToken combo.
// Docs: https://developers.metricool.com/api/

export class MetricoolNotConfiguredError extends Error {
  constructor(missing: string) {
    super(`Metricool not configured: missing ${missing}`)
    this.name = 'MetricoolNotConfiguredError'
  }
}

const API_BASE = 'https://app.metricool.com/api'

function getConfig() {
  const userToken = process.env.METRICOOL_API_KEY
  const userId = process.env.METRICOOL_USER_ID
  if (!userToken) throw new MetricoolNotConfiguredError('METRICOOL_API_KEY')
  if (!userId) throw new MetricoolNotConfiguredError('METRICOOL_USER_ID')
  return { userToken, userId }
}

type SchedulePostInput = {
  brandId: string
  draftText: string
  mediaUrls: string[]
  platforms: string[]
  scheduledAt?: Date
  smart?: boolean
}

export type MetricoolPostStatus = 'scheduled' | 'posted' | 'failed' | 'unknown'

export async function schedulePost(input: SchedulePostInput): Promise<{ postId: string; scheduledAt: string }> {
  const { userToken, userId } = getConfig()
  if (!input.brandId) throw new MetricoolNotConfiguredError('metricool_brand_id on profile')

  const body = {
    text: input.draftText,
    media: input.mediaUrls,
    providers: input.platforms.map(normalizePlatform).filter(Boolean),
    publicationDate: input.scheduledAt?.toISOString(),
    autoPublish: true,
    smartPublish: input.smart ?? true,
  }

  const res = await fetch(
    `${API_BASE}/v2/scheduler/posts?blogId=${input.brandId}&userId=${userId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mc-Auth': userToken },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    throw new Error(`Metricool schedulePost failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  return {
    postId: String(data.id ?? data.postId ?? ''),
    scheduledAt: data.publicationDate ?? new Date().toISOString(),
  }
}

export async function getPostStatus(postId: string, brandId: string): Promise<{
  status: MetricoolPostStatus
  postedAt?: string
  platform?: string
  externalId?: string
}> {
  const { userToken, userId } = getConfig()

  const res = await fetch(
    `${API_BASE}/v2/scheduler/posts/${postId}?blogId=${brandId}&userId=${userId}`,
    { headers: { 'X-Mc-Auth': userToken } }
  )

  if (!res.ok) {
    throw new Error(`Metricool getPostStatus failed: ${res.status}`)
  }

  const data = await res.json()
  const raw = String(data.status ?? '').toLowerCase()
  let status: MetricoolPostStatus = 'unknown'
  if (raw === 'published' || raw === 'posted') status = 'posted'
  else if (raw === 'scheduled' || raw === 'pending') status = 'scheduled'
  else if (raw === 'failed' || raw === 'error') status = 'failed'

  return {
    status,
    postedAt: data.publishedDate ?? data.publicationDate,
    platform: data.providers?.[0],
    externalId: data.externalPostId,
  }
}

function normalizePlatform(p: string): string {
  const k = p.toLowerCase()
  if (k.includes('tiktok')) return 'tiktok'
  if (k.includes('instagram')) return 'instagram'
  if (k.includes('youtube')) return 'youtube'
  if (k.includes('facebook')) return 'facebook'
  return k
}
