import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  scheduled: 'Scheduled',
  posted: 'Posted',
  failed: 'Failed',
  rejected: 'Rejected',
}

const STATUS_COLOR: Record<string, string> = {
  pending_approval: 'bg-amber-500/15 text-amber-300',
  approved: 'bg-teal-500/15 text-teal-300',
  scheduled: 'bg-cyan-500/15 text-cyan-300',
  posted: 'bg-emerald-500/15 text-emerald-300',
  failed: 'bg-red-500/15 text-red-300',
  rejected: 'bg-muted text-muted-foreground',
  draft: 'bg-muted text-muted-foreground',
}

export default async function QueuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: content }, { data: trials }] = await Promise.all([
    supabase.from('content_queue').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('trial_reel_queue').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
  ])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Queue</h1>
        <p className="text-muted-foreground text-[15px] mt-1">Approve drafts from Telegram. Status syncs every 15 min.</p>
      </div>

      <section>
        <h2 className="font-semibold text-foreground mb-3">Content queue (Metricool)</h2>
        {content && content.length > 0 ? (
          <div className="space-y-2">
            {content.map(row => (
              <QueueRow
                key={row.id}
                status={row.status}
                text={row.draft_text}
                meta={[
                  row.platforms?.join(', '),
                  row.scheduled_at && `scheduled ${formatDate(row.scheduled_at)}`,
                  row.posted_at && `posted ${formatDate(row.posted_at)}`,
                  row.error,
                ].filter(Boolean) as string[]}
              />
            ))}
          </div>
        ) : (
          <EmptyHint text="No drafts yet — Sana will queue your approved content here." />
        )}
      </section>

      <section>
        <h2 className="font-semibold text-foreground mb-3">Trial Reels (agent experiments)</h2>
        {trials && trials.length > 0 ? (
          <div className="space-y-2">
            {trials.map(row => (
              <QueueRow
                key={row.id}
                status={row.status}
                text={row.draft_text}
                meta={[
                  row.hypothesis && `hypothesis: ${row.hypothesis}`,
                  row.posted_at && `posted ${formatDate(row.posted_at)}`,
                  row.results_check_at && `insights ${formatDate(row.results_check_at)}`,
                  row.error,
                ].filter(Boolean) as string[]}
              />
            ))}
          </div>
        ) : (
          <EmptyHint text="No Trial Reels yet — the agent will propose experiments here." />
        )}
      </section>
    </div>
  )
}

function QueueRow({ status, text, meta }: { status: string; text: string; meta: string[] }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap flex-1">{text}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLOR[status] ?? STATUS_COLOR.draft}`}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>
      {meta.length > 0 && (
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
          {meta.map((m, i) => <span key={i}>{m}</span>)}
        </div>
      )}
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground bg-card border border-dashed border-border rounded-xl p-6 text-center">{text}</p>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
}
