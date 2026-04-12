# Sana

Autonomous AI marketing agent — coaching, content production, auto-posting, and autonomous Trial Reels.
Next.js 16 (App Router) + Supabase + Anthropic Claude SDK + Tailwind v4 + shadcn/ui.

## Working Style
IMPORTANT: Think thoroughly before responding. Provide complete, detailed answers the first time. If you can do a task, DO IT — don't give the user manual steps.

## Tech Stack
- **Runtime**: Next.js 16 App Router, TypeScript, React 19
- **Database & Auth**: Supabase (Postgres + RLS + Auth + Storage)
- **AI**: Anthropic Claude SDK (`claude-sonnet-4-6`) — `src/lib/claude.ts`
- **Bot**: Telegraf (Telegram bot) — `src/lib/telegram.ts`
- **Styling**: Tailwind CSS v4 + shadcn/ui (teal/cyan accent, dark theme)
- **Deployment**: Vercel Hobby (free tier)

## Architecture

### Route structure
- `(auth)/` — login, signup
- `(dashboard)/dashboard/*` — main app (coach, strategy, settings)
- `onboarding/` — 6-step wizard
- `api/` — coach, coach/strategy, telegram/webhook, auth/callback

### Critical Patterns

**All mutations go through server actions** (`src/app/actions.ts`).

**Profile UPSERT, not UPDATE:**
```ts
supabase.from('profiles').upsert(
  { user_id: user.id, email: user.email ?? '', ...fields },
  { onConflict: 'user_id' }
)
```

**Supabase clients:**
- Server (cookies): `src/lib/supabase/server.ts`
- Browser (anon key): `src/lib/supabase/client.ts`
- Service role: `src/lib/supabase/service.ts`

## Development
- `npm run dev` — local server
- DB schema: `supabase/migrations/001_initial_schema.sql`
- Brand color: teal (#14b8a6) — NOT purple (that's Orianna)
