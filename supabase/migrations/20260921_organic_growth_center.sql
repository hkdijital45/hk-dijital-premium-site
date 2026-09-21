-- Organik Büyüme Merkezi (HK Organic Growth Center)
-- Canonical monthly-strategy → content-plan → brief → article pipeline,
-- replacing the old Blog & SEO Center's content_plans/content_plan_items
-- (left untouched/deprecated in place, not dropped — production-safety;
-- see final report). Reuses public.blog_posts as the canonical article
-- store (extended here with GEO/refresh fields) rather than creating a
-- parallel article table. New table names are prefixed "organic_" to
-- avoid the pre-existing content_plans/content_plan_items and
-- social_content_plan_items naming collisions documented in the audit.

create extension if not exists pgcrypto;

-- Reuses the same generic updated_at trigger function blog_seo_center
-- already created (public.set_blog_updated_at) — no redefinition needed.

create table if not exists public.topic_clusters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  target_service text,
  search_intents text[] not null default '{}',
  geography text,
  pillar_article_id uuid references public.blog_posts(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.organic_monthly_strategies (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  business_objective text not null default '',
  target_services text[] not null default '{}',
  target_geography text not null default '',
  target_audience text not null default '',
  publishing_frequency text not null default '',
  strategic_notes text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  created_by text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (month)
);

create table if not exists public.organic_content_plan_items (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid references public.organic_monthly_strategies(id) on delete set null,
  topic_cluster_id uuid references public.topic_clusters(id) on delete set null,
  blog_post_id uuid references public.blog_posts(id) on delete set null,
  planned_publication_date date,
  working_title text not null,
  primary_topic text not null default '',
  search_intent text not null default '',
  funnel_stage text not null default '',
  target_service text not null default '',
  target_geography text not null default '',
  target_audience text not null default '',
  pillar_or_supporting text check (pillar_or_supporting in ('pillar', 'supporting')),
  article_type text not null default '',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  rationale text not null default '',
  cta_objective text not null default '',
  internal_link_targets text[] not null default '{}',
  status text not null default 'PLANNED' check (status in (
    'PLANNED', 'BRIEF_READY', 'WAITING_FOR_CLAUDE', 'DRAFT', 'REVIEW',
    'APPROVED', 'SCHEDULED', 'PUBLISHED', 'UPDATE_REQUIRED'
  )),
  why_this_article text not null default '',
  primary_question text not null default '',
  secondary_questions text[] not null default '{}',
  related_concepts text[] not null default '{}',
  must_cover_points text[] not null default '{}',
  existing_related_content text[] not null default '{}',
  content_angle text not null default '',
  seo_requirements text not null default '',
  geo_requirements text not null default '',
  facts_sources text not null default '',
  editorial_notes text not null default '',
  claude_prompt_cache text,
  created_by text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.blog_posts add column if not exists geo_score integer not null default 0 check (geo_score between 0 and 100);
alter table public.blog_posts add column if not exists geo_factors jsonb not null default '[]'::jsonb;
alter table public.blog_posts add column if not exists seo_factors jsonb not null default '[]'::jsonb;
alter table public.blog_posts add column if not exists update_required boolean not null default false;
alter table public.blog_posts add column if not exists last_reviewed_at timestamptz;

create index if not exists topic_clusters_target_service_idx on public.topic_clusters (target_service);
create index if not exists organic_monthly_strategies_month_idx on public.organic_monthly_strategies (month desc);
create index if not exists organic_content_plan_items_strategy_idx on public.organic_content_plan_items (strategy_id);
create index if not exists organic_content_plan_items_cluster_idx on public.organic_content_plan_items (topic_cluster_id);
create index if not exists organic_content_plan_items_status_idx on public.organic_content_plan_items (status);
create index if not exists organic_content_plan_items_date_idx on public.organic_content_plan_items (planned_publication_date);
create index if not exists blog_posts_update_required_idx on public.blog_posts (update_required) where update_required = true;

drop trigger if exists topic_clusters_set_updated_at on public.topic_clusters;
create trigger topic_clusters_set_updated_at before update on public.topic_clusters for each row execute function public.set_blog_updated_at();

drop trigger if exists organic_monthly_strategies_set_updated_at on public.organic_monthly_strategies;
create trigger organic_monthly_strategies_set_updated_at before update on public.organic_monthly_strategies for each row execute function public.set_blog_updated_at();

drop trigger if exists organic_content_plan_items_set_updated_at on public.organic_content_plan_items;
create trigger organic_content_plan_items_set_updated_at before update on public.organic_content_plan_items for each row execute function public.set_blog_updated_at();

alter table public.topic_clusters enable row level security;
alter table public.organic_monthly_strategies enable row level security;
alter table public.organic_content_plan_items enable row level security;

-- Purely internal planning data — staff-only, no public policy (mirrors
-- the "Staff can manage blog posts" pattern from 20260715_blog_seo_center.sql).
-- Real access-boundary enforcement is Next.js route-level requireModuleAccess();
-- these policies are defense-in-depth for any non-service-role access path.

drop policy if exists "Staff can manage topic clusters" on public.topic_clusters;
create policy "Staff can manage topic clusters" on public.topic_clusters for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage monthly strategies" on public.organic_monthly_strategies;
create policy "Staff can manage monthly strategies" on public.organic_monthly_strategies for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage content plan items" on public.organic_content_plan_items;
create policy "Staff can manage content plan items" on public.organic_content_plan_items for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);
