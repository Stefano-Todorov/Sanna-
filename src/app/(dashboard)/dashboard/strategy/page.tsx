import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { ContentPillar, HookFormula, DayPlan } from '@/lib/types'

export default async function StrategyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: strategy } = await supabase
    .from('strategies')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!strategy) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Strategy</h1>
        <p className="text-muted-foreground mb-6">You haven&apos;t built a strategy yet.</p>
        <Link href="/dashboard/coach"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors">
          Start Strategy Session
        </Link>
      </div>
    )
  }

  const pillars: ContentPillar[] = strategy.pillars ?? []
  const hooks: HookFormula[] = strategy.hooks_playbook ?? []
  const plan: DayPlan[] = strategy.seven_day_plan ?? []
  const platformBreakdown = strategy.platform_breakdown ?? {}

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your Strategy</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Built from {strategy.exchange_count} coaching exchanges
          </p>
        </div>
        <Link href="/dashboard/coach"
          className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          Refine with Coach
        </Link>
      </div>

      {/* Content Pillars */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-4">Content Pillars</h2>
        <div className="space-y-3">
          {pillars.map((pillar, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-600/15 flex items-center justify-center text-teal-500 font-bold text-sm shrink-0">
                {pillar.percentage}%
              </div>
              <div>
                <p className="font-medium text-foreground">{pillar.name}</p>
                {pillar.example_topics?.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Examples: {pillar.example_topics.join(', ')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hook Playbook */}
      {hooks.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Hook Playbook</h2>
          <div className="space-y-3">
            {hooks.map((hook, i) => (
              <div key={i} className="border border-border rounded-lg p-3">
                <p className="font-medium text-foreground text-sm">{hook.formula}</p>
                <p className="text-sm text-muted-foreground mt-1">&ldquo;{hook.example}&rdquo;</p>
                <p className="text-xs text-muted-foreground mt-1">When: {hook.when_to_use}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform Breakdown */}
      {Object.keys(platformBreakdown).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Platform Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(platformBreakdown).map(([platform, plan]) => {
              const p = plan as { frequency?: number; best_formats?: string[]; ideal_length?: string }
              return (
                <div key={platform} className="border border-border rounded-lg p-3">
                  <p className="font-medium text-foreground capitalize">{platform}</p>
                  <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                    {p.frequency && <p>{p.frequency}x per week</p>}
                    {p.best_formats && <p>Formats: {p.best_formats.join(', ')}</p>}
                    {p.ideal_length && <p>Length: {p.ideal_length}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 7-Day Plan */}
      {plan.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">7-Day Content Plan</h2>
          <div className="space-y-2">
            {plan.map((day, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className="w-20 text-xs font-semibold text-teal-500 uppercase">{day.day}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{day.topic}</p>
                  <p className="text-xs text-muted-foreground">{day.pillar} &middot; {day.platform}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
