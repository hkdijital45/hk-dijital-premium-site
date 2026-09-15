-- Analiz & Raporlama Merkezi (Unified Analytics Center) — metrics storage.
--
-- Deliberately does NOT add a new "connections" table: OAuth state and
-- selected assets per customer already live in public.customer_integrations
-- (customer-integration-onboarding migrations) via its integration_assets
-- jsonb array, populated by the existing oauthConnect/oauthCallback/
-- selectOAuthAccount flow in src/lib/customer-integration-oauth.ts. Reusing
-- that keeps ONE source of truth for connection state between this module
-- and the existing Entegrasyonlar / Müşteri Entegrasyonları screens, per the
-- project's explicit "no conflicting connection data" requirement.
--
-- Also does NOT add a new sync-log table: public.integration_sync_logs
-- already exists with the right shape (provider, company_id, result,
-- message, details jsonb, created_at). Its provider check constraint is
-- ('meta','google') — analytics syncs keep writing those same two values
-- and put the specific platform (instagram/facebook/youtube/google_ads/
-- google_business) in details.platform, so existing callers/constraints are
-- untouched.
--
-- What IS genuinely new: nowhere in the schema stores fetched platform
-- metrics. Three tables below cover that:
--   analytics_daily_metrics    — narrow (date, metric_key, value) rows so
--                                 adding/losing a provider metric never
--                                 needs a migration; unique per
--                                 (company, provider, asset, date, metric)
--                                 so a re-sync of today safely upserts
--                                 instead of duplicating.
--   analytics_content_metrics  — latest known snapshot per content item
--                                 (post/reel/video), metrics kept as jsonb
--                                 since availability varies by
--                                 provider/content type.
--   analytics_reports          — metadata for a generated report (period,
--                                 platforms, computed summary); the actual
--                                 PDF/DOCX file is stored the existing way,
--                                 via customer_documents + Supabase Storage,
--                                 and linked back with document_id.

create table if not exists public.analytics_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null check (provider in ('instagram', 'facebook', 'youtube', 'google_ads', 'google_business_profile')),
  asset_id text not null,
  metric_date date not null,
  metric_key text not null,
  metric_value numeric not null default 0,
  currency text,
  dimensions jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, provider, asset_id, metric_date, metric_key)
);

create index if not exists analytics_daily_metrics_company_provider_date_idx
  on public.analytics_daily_metrics(company_id, provider, metric_date desc);

create table if not exists public.analytics_content_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null check (provider in ('instagram', 'facebook', 'youtube')),
  asset_id text not null,
  content_id text not null,
  content_type text,
  caption text,
  title text,
  permalink text,
  thumbnail_url text,
  published_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, provider, content_id)
);

create index if not exists analytics_content_metrics_company_provider_idx
  on public.analytics_content_metrics(company_id, provider, published_at desc);

create table if not exists public.analytics_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  period_start date not null,
  period_end date not null,
  comparison_mode text not null default 'previous_period',
  platforms text[] not null default '{}',
  sections text[] not null default '{}',
  summary jsonb not null default '{}'::jsonb,
  document_id uuid references public.customer_documents(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists analytics_reports_company_idx
  on public.analytics_reports(company_id, created_at desc);

-- Same server-only access model as the rest of the app (see
-- 20260912_customer_portal_rls_hardening.sql for the full rationale):
-- service_role (used exclusively by server code via SUPABASE_SERVICE_ROLE_KEY)
-- bypasses RLS regardless, so this is a second, independent layer — it
-- closes these three tables to anon/authenticated direct Postgres access by
-- default, rather than leaving that as an unstated assumption.
alter table public.analytics_daily_metrics enable row level security;
alter table public.analytics_content_metrics enable row level security;
alter table public.analytics_reports enable row level security;

drop policy if exists service_role_full_access on public.analytics_daily_metrics;
create policy service_role_full_access on public.analytics_daily_metrics for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.analytics_content_metrics;
create policy service_role_full_access on public.analytics_content_metrics for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.analytics_reports;
create policy service_role_full_access on public.analytics_reports for all to service_role using (true) with check (true);
