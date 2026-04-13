-- Module 7 — Scheduling & Auto-Posting
-- Content queue (Metricool path), Trial Reel queue (Meta Graph direct), posting history

-- Profile extensions for integration IDs
alter table public.profiles add column if not exists metricool_brand_id text;
alter table public.profiles add column if not exists ig_business_account_id text;
alter table public.profiles add column if not exists meta_page_id text;

-- User-created content routed through Metricool
create table if not exists public.content_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  draft_text text not null,
  media_urls text[] default '{}',
  platforms text[] default '{}',
  status text not null default 'draft' check (status in (
    'draft','pending_approval','approved','scheduled','posted','failed','rejected'
  )),
  metricool_post_id text,
  scheduled_at timestamptz,
  posted_at timestamptz,
  approval_message_id text,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_content_queue_scan on public.content_queue(status, scheduled_at);
create index if not exists idx_content_queue_user on public.content_queue(user_id, created_at desc);

-- Agent-generated Trial Reels via Meta Graph API
create table if not exists public.trial_reel_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  draft_text text not null,
  media_urls text[] default '{}',
  platform text not null default 'instagram',
  hypothesis text,
  status text not null default 'pending_approval' check (status in (
    'pending_approval','approved','scheduled','posted','failed','rejected'
  )),
  meta_creation_id text,
  meta_media_id text,
  scheduled_at timestamptz,
  posted_at timestamptz,
  results_check_at timestamptz,
  approval_message_id text,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_trial_reel_queue_scan on public.trial_reel_queue(status, scheduled_at);
create index if not exists idx_trial_reel_queue_user on public.trial_reel_queue(user_id, created_at desc);

-- Flat audit log for both paths
create table if not exists public.posting_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source text not null check (source in ('metricool','meta_direct')),
  platform text not null,
  external_post_id text,
  posted_at timestamptz default now(),
  payload jsonb default '{}'
);

create index if not exists idx_posting_history_user on public.posting_history(user_id, posted_at desc);

-- RLS — users can read their own rows; writes happen via service role (server actions + cron)
alter table public.content_queue enable row level security;
alter table public.trial_reel_queue enable row level security;
alter table public.posting_history enable row level security;

create policy "Users read own content_queue" on public.content_queue
  for select using (auth.uid() = user_id);

create policy "Users read own trial_reel_queue" on public.trial_reel_queue
  for select using (auth.uid() = user_id);

create policy "Users read own posting_history" on public.posting_history
  for select using (auth.uid() = user_id);
