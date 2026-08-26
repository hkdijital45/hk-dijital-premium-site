-- HK Growth Intelligence: SEO/GEO opportunity scoring, automation settings,
-- automation run logs, and IndexNow submission tracking.
--
-- This module deliberately reuses the existing blog_posts/content_plans/
-- content_plan_items tables (see 20260715_blog_seo_center.sql and
-- 20260715_blog_content_operations.sql) for actual content — it does not
-- duplicate them. These four tables are the new, previously-missing layer:
-- raw Search Console signal (growth_opportunities), automation configuration
-- (growth_settings), automation observability (growth_automation_runs), and
-- IndexNow submission history (growth_indexnow_submissions).

create table if not exists public.growth_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null unique default 'hk-dijital',
  automation_mode text not null default 'manual' check (automation_mode in ('manual', 'assisted', 'semi_automatic', 'fully_automatic')),
  min_opportunity_score integer not null default 60 check (min_opportunity_score between 0 and 100),
  min_quality_score integer not null default 75 check (min_quality_score between 0 and 100),
  min_word_count integer not null default 650 check (min_word_count >= 0),
  require_review boolean not null default true,
  indexnow_enabled boolean not null default false,
  sitemap_ping_enabled boolean not null default true,
  gsc_sync_frequency_hours integer not null default 24 check (gsc_sync_frequency_hours >= 1),
  target_service_pages text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.growth_opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  query text not null,
  page text not null default '',
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric not null default 0,
  avg_position numeric not null default 0,
  opportunity_type text not null default 'new_content' check (opportunity_type in ('new_content', 'refresh_content', 'service_page', 'internal_link', 'geo_gap', 'technical')),
  opportunity_score integer not null default 0 check (opportunity_score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  recommended_action text not null default '',
  related_blog_post_id uuid references public.blog_posts(id) on delete set null,
  related_content_plan_item_id uuid references public.content_plan_items(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'reviewing', 'converted', 'dismissed')),
  source text not null default 'search_console' check (source in ('search_console', 'manual')),
  synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, query, page)
);

create table if not exists public.growth_automation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  run_type text not null check (run_type in ('sync', 'scoring', 'generation', 'publish', 'indexing', 'full_cycle')),
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error text,
  affected_count integer not null default 0,
  triggered_by text not null default 'cron' check (triggered_by in ('cron', 'manual'))
);

create table if not exists public.growth_indexnow_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  url text not null,
  batch_id uuid,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'failed')),
  response_code integer,
  response_body text,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists growth_opportunities_score_idx on public.growth_opportunities (workspace_id, status, opportunity_score desc);
create index if not exists growth_opportunities_synced_idx on public.growth_opportunities (synced_at desc);
create index if not exists growth_automation_runs_started_idx on public.growth_automation_runs (workspace_id, started_at desc);
create index if not exists growth_indexnow_submissions_batch_idx on public.growth_indexnow_submissions (batch_id);

drop trigger if exists growth_settings_set_updated_at on public.growth_settings;
create trigger growth_settings_set_updated_at before update on public.growth_settings for each row execute function public.set_blog_updated_at();

drop trigger if exists growth_opportunities_set_updated_at on public.growth_opportunities;
create trigger growth_opportunities_set_updated_at before update on public.growth_opportunities for each row execute function public.set_blog_updated_at();

alter table public.growth_settings enable row level security;
alter table public.growth_opportunities enable row level security;
alter table public.growth_automation_runs enable row level security;
alter table public.growth_indexnow_submissions enable row level security;

drop policy if exists "Staff can manage growth settings" on public.growth_settings;
create policy "Staff can manage growth settings" on public.growth_settings for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage growth opportunities" on public.growth_opportunities;
create policy "Staff can manage growth opportunities" on public.growth_opportunities for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage growth automation runs" on public.growth_automation_runs;
create policy "Staff can manage growth automation runs" on public.growth_automation_runs for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage growth indexnow submissions" on public.growth_indexnow_submissions;
create policy "Staff can manage growth indexnow submissions" on public.growth_indexnow_submissions for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

insert into public.growth_settings (workspace_id) values ('hk-dijital') on conflict (workspace_id) do nothing;

notify pgrst, 'reload schema';
