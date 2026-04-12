import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, Target, Settings, Send } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const { data: strategy } = await supabase
    .from('strategies')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const hasStrategy = !!strategy
  const hasTelegram = !!profile?.telegram_chat_id

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {profile?.name ? `Hey ${profile.name.split(' ')[0]}` : 'Welcome to Sana'}
        </h1>
        <p className="text-muted-foreground text-[15px] mt-1">
          Your autonomous marketing agent is ready.
        </p>
      </div>

      {/* Quick status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/dashboard/coach"
          className="bg-card border border-border rounded-xl p-5 hover:border-teal-500/40 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-teal-600/15 flex items-center justify-center">
              <MessageSquare size={18} className="text-teal-500" />
            </div>
            <h3 className="font-semibold text-foreground">AI Coach</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {hasStrategy ? 'Ask anything about your strategy' : 'Start a strategy session to build your content plan'}
          </p>
        </Link>

        <Link href="/dashboard/strategy"
          className="bg-card border border-border rounded-xl p-5 hover:border-teal-500/40 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-teal-600/15 flex items-center justify-center">
              <Target size={18} className="text-teal-500" />
            </div>
            <h3 className="font-semibold text-foreground">Strategy</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {hasStrategy
              ? `${strategy.pillars?.length ?? 0} pillars, ${strategy.seven_day_plan?.length ?? 0}-day plan`
              : 'No strategy yet — start a coaching session'}
          </p>
        </Link>

        <Link href="/dashboard/settings"
          className="bg-card border border-border rounded-xl p-5 hover:border-teal-500/40 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-teal-600/15 flex items-center justify-center">
              {hasTelegram ? <Send size={18} className="text-teal-500" /> : <Settings size={18} className="text-teal-500" />}
            </div>
            <h3 className="font-semibold text-foreground">Telegram</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {hasTelegram ? 'Connected — Sana can message you' : 'Connect Telegram to get briefs and reminders'}
          </p>
        </Link>
      </div>

      {/* Profile summary */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-3">Your Profile</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Niche</p>
            <p className="text-foreground font-medium">{profile?.niche ?? 'Not set'}{profile?.sub_niche ? ` > ${profile.sub_niche}` : ''}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Voice</p>
            <p className="text-foreground font-medium capitalize">{profile?.brand_voice ?? 'Not set'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Platforms</p>
            <p className="text-foreground font-medium">{profile?.platforms?.join(', ') || 'None'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Posting Goal</p>
            <p className="text-foreground font-medium">{profile?.posting_target}x / week</p>
          </div>
        </div>
      </div>
    </div>
  )
}
