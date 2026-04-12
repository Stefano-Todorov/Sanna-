import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoachChat } from '@/components/coach/coach-chat'

export default async function CoachPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: history } = await supabase
    .from('coach_messages')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(50)

  // Check if user has a completed strategy
  const { data: strategy } = await supabase
    .from('strategies')
    .select('status')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .limit(1)
    .single()

  const hasStrategy = !!strategy

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 sm:px-6 pt-6 pb-4 border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">
          {hasStrategy ? 'AI Coach' : 'Strategy Session'}
        </h1>
        <p className="text-muted-foreground text-[15px] mt-1">
          {hasStrategy
            ? 'Your AI marketing strategist — content ideas, hooks, scripts, and growth advice.'
            : "Let's build your content strategy. I'll ask you questions, then create your plan."}
        </p>
      </div>
      <CoachChat
        initialHistory={history ?? []}
        mode={hasStrategy ? 'coach' : 'strategy'}
      />
    </div>
  )
}
