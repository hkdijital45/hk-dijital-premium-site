-- Organik Büyüme Merkezi — autonomous SEO/GEO content generation.
-- Adds the minimum new state needed for a real scheduled/manual generation
-- pipeline on top of the existing organic_content_plan_items/blog_posts
-- tables (20260921_organic_growth_center.sql) — no parallel article/plan
-- schema, no destructive change, all additive and idempotent.

create extension if not exists pgcrypto;

-- One row per generation attempt (cron or manual). Doubles as the
-- idempotency lock for the scheduled job: a unique partial index on
-- (run_date) for trigger='cron' means a second cron invocation on the
-- same calendar day can never start a second run, even under a rare
-- duplicate Vercel Cron trigger.
create table if not exists public.organic_generation_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('cron', 'manual')),
  run_date date not null default (timezone('utc', now()))::date,
  status text not null default 'running' check (status in ('running', 'success', 'failed', 'skipped')),
  step text not null default '',
  content_plan_item_id uuid references public.organic_content_plan_items(id) on delete set null,
  blog_post_id uuid references public.blog_posts(id) on delete set null,
  provider text,
  model text,
  reasoning text not null default '',
  error text,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  created_by text
);

create unique index if not exists organic_generation_runs_one_cron_per_day
  on public.organic_generation_runs (run_date)
  where trigger = 'cron';

create index if not exists organic_generation_runs_status_idx on public.organic_generation_runs (status);
create index if not exists organic_generation_runs_started_idx on public.organic_generation_runs (started_at desc);

-- Single-row settings (no settings table existed for this center). Mirrors
-- the "one fixed row" convention — simplest safe shape for a handful of
-- scalar toggles nobody needs to query by filter.
create table if not exists public.organic_growth_settings (
  id text primary key default 'default',
  automation_enabled boolean not null default true,
  generation_days text[] not null default array['mon', 'thu'],
  default_language text not null default 'tr',
  min_word_count integer not null default 500,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text
);
insert into public.organic_growth_settings (id) values ('default') on conflict (id) do nothing;

alter table public.organic_generation_runs enable row level security;
alter table public.organic_growth_settings enable row level security;

drop policy if exists "Staff can manage generation runs" on public.organic_generation_runs;
create policy "Staff can manage generation runs" on public.organic_generation_runs for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage organic growth settings" on public.organic_growth_settings;
create policy "Staff can manage organic growth settings" on public.organic_growth_settings for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);
