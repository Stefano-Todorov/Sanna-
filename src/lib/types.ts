export type Platform = 'tiktok' | 'instagram' | 'youtube'

export interface Profile {
  user_id: string
  email: string
  name: string | null
  niche: string | null
  sub_niche: string | null
  brand_voice: string | null
  target_audience: TargetAudience
  product_or_service: string | null
  platforms: Platform[]
  posting_target: number
  brand_kit_storage_path: string | null
  telegram_chat_id: string | null
  telegram_link_code: string | null
  timezone: string
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface TargetAudience {
  age_range?: string
  pain_points?: string
  where_they_hang_out?: string
  description?: string
}

export interface Strategy {
  id: string
  user_id: string
  status: 'in_progress' | 'completed' | 'archived'
  pillars: ContentPillar[]
  hooks_playbook: HookFormula[]
  platform_breakdown: Record<string, PlatformPlan>
  seven_day_plan: DayPlan[]
  session_messages: StrategyMessage[]
  exchange_count: number
  created_at: string
  updated_at: string
}

export interface ContentPillar {
  name: string
  percentage: number
  example_topics: string[]
}

export interface HookFormula {
  formula: string
  example: string
  when_to_use: string
}

export interface PlatformPlan {
  frequency: number
  best_formats: string[]
  ideal_length: string
}

export interface DayPlan {
  day: string
  pillar: string
  topic: string
  platform: string
}

export interface StrategyMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface CoachMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Memory {
  id: string
  user_id: string
  category: 'preference' | 'insight' | 'friction' | 'strength'
  content: string
  source: string | null
  created_at: string
}
