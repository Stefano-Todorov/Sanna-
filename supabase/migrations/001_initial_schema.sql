-- Project Sana — Initial Schema
-- Phase 1: Profiles, Strategies, Coach Messages, Memories

-- Profiles (extended for Sana)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  niche text,
  sub_niche text,
  brand_voice text,
  target_audience jsonb default '{}',
  product_or_service text,
  platforms text[] default '{}',
  posting_target integer default 3,
  brand_kit_storage_path text,
  telegram_chat_id text,
  telegram_link_code text,
  timezone text default 'UTC',
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Strategies (Module 2 coaching output)
create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  status text default 'in_progress' check (status in ('in_progress', 'completed', 'archived')),
  pillars jsonb default '[]',
  hooks_playbook jsonb default '[]',
  platform_breakdown jsonb default '{}',
  seven_day_plan jsonb default '[]',
  session_messages jsonb default '[]',
  exchange_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Coach messages (general chat history)
create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Memories (replaces Mem0 — AI-generated insights about the user)
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null check (category in ('preference', 'insight', 'friction', 'strength')),
  content text not null,
  source text check (source in ('coaching', 'telegram', 'agent', 'strategy')),
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.strategies enable row level security;
alter table public.coach_messages enable row level security;
alter table public.memories enable row level security;

create policy "Users own their profiles" on public.profiles
  for all using (auth.uid() = user_id);

create policy "Users own their strategies" on public.strategies
  for all using (auth.uid() = user_id);

create policy "Users own their coach messages" on public.coach_messages
  for all using (auth.uid() = user_id);

create policy "Users own their memories" on public.memories
  for all using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_strategies_user on public.strategies(user_id);
create index if not exists idx_coach_messages_user on public.coach_messages(user_id, created_at);
create index if not exists idx_memories_user on public.memories(user_id);

-- Storage bucket for brand kits
insert into storage.buckets (id, name, public)
values ('brand-kits', 'brand-kits', false)
on conflict do nothing;

-- Storage RLS
create policy "Users can upload brand kits" on storage.objects
  for insert with check (bucket_id = 'brand-kits' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view their brand kits" on storage.objects
  for select using (bucket_id = 'brand-kits' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their brand kits" on storage.objects
  for delete using (bucket_id = 'brand-kits' and auth.uid()::text = (storage.foldername(name))[1]);
