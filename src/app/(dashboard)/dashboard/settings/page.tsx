import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TelegramLink } from '@/components/settings/telegram-link'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-[15px] mt-1">Manage your profile and connections</p>
      </div>

      {/* Profile Info */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-4">Profile</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Name</p>
            <p className="text-foreground">{profile?.name ?? 'Not set'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Email</p>
            <p className="text-foreground">{profile?.email ?? user.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Niche</p>
            <p className="text-foreground">{profile?.niche ?? 'Not set'}{profile?.sub_niche ? ` > ${profile.sub_niche}` : ''}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Brand Voice</p>
            <p className="text-foreground capitalize">{profile?.brand_voice ?? 'Not set'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Product/Service</p>
            <p className="text-foreground">{profile?.product_or_service ?? 'Not set'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Platforms</p>
            <p className="text-foreground">{profile?.platforms?.join(', ') || 'None'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Posting Target</p>
            <p className="text-foreground">{profile?.posting_target ?? 3}x per week</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Target Audience</p>
            <p className="text-foreground">{profile?.target_audience?.description ?? 'Not set'}</p>
          </div>
        </div>
      </div>

      {/* Telegram Connection */}
      <TelegramLink
        isLinked={!!profile?.telegram_chat_id}
        chatId={profile?.telegram_chat_id ?? null}
      />
    </div>
  )
}
