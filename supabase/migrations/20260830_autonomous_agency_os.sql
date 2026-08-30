-- HK Autonomous Agency OS — foundation tables for CEO Briefing, Customer
-- Risk Engine, Ad Optimizer approval workflow, and SEO Autopilot decay jobs.
--
-- Deliberately does NOT duplicate existing infrastructure:
--   - hk_risk_events / hk_recommendations / hk_intelligence_ceo_runs / etc.
--     (20260629_hk_intelligence_autonomous_os.sql) already form the risk
--     ALERT surface and CEO command-run history — this migration adds the
--     numeric risk-score history and daily-briefing tables that feed it,
--     not a second alert system. Crossing >70 writes an hk_risk_events row.
--   - agency_tasks is reused as-is for retention/follow-up tasks (no new
--     task table).
--   - action_result_logs / agent_runs remain the action+AI audit trail;
--     no new generic "ai_action_logs" table is created.

create table if not exists public.ceo_briefings (
  id uuid primary key default gen_random_uuid(),
  briefing_date date not null unique,
  summary_json jsonb not null default '{}'::jsonb,
  executive_summary text not null default '',
  ai_insights jsonb not null default '[]'::jsonb,
  risk_alerts jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz,
  delivery_status text not null default 'generated' check (delivery_status in ('generated', 'sent', 'failed')),
  delivery_channels jsonb not null default '[]'::jsonb,
  generation_version text not null default 'v1',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customer_risk_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  score integer not null default 0 check (score between 0 and 100),
  risk_level text not null default 'safe' check (risk_level in ('safe', 'attention', 'risky', 'critical')),
  factors_json jsonb not null default '{}'::jsonb,
  previous_score integer,
  trend text default 'stable' check (trend in ('improving', 'stable', 'worsening')),
  calculated_at timestamptz not null default timezone('utc', now()),
  alert_triggered boolean not null default false,
  source_version text not null default 'v1',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ad_optimization_suggestions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid references public.campaign_metrics(id) on delete set null,
  external_campaign_id text,
  platform text not null default 'meta' check (platform in ('meta', 'google', 'all')),
  issue_type text not null,
  current_value text,
  target_value text,
  suggested_action text not null,
  action_payload jsonb not null default '{}'::jsonb,
  ai_reasoning text,
  confidence integer default 0 check (confidence between 0 and 100),
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'applying', 'applied', 'failed', 'rolled_back')),
  generated_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  applied_at timestamptz,
  provider_response jsonb,
  rollback_payload jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.seo_autopilot_jobs (
  id uuid primary key default gen_random_uuid(),
  blog_post_id uuid references public.blog_posts(id) on delete set null,
  query text not null,
  url text not null,
  trigger_type text not null check (trigger_type in ('position_decline', 'impression_decline', 'ctr_decline', 'content_decay')),
  position_before numeric,
  position_after numeric,
  impressions_before integer,
  impressions_after integer,
  clicks_before integer,
  clicks_after integer,
  content_plan_item_id uuid references public.content_plan_items(id) on delete set null,
  ai_brief text,
  ai_draft text,
  status text not null default 'detected' check (status in ('detected', 'analyzing', 'draft_ready', 'awaiting_approval', 'approved', 'rejected', 'published', 'failed')),
  triggered_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists ceo_briefings_date_idx on public.ceo_briefings (briefing_date desc);
create index if not exists customer_risk_scores_company_idx on public.customer_risk_scores (company_id, calculated_at desc);
create index if not exists customer_risk_scores_alert_idx on public.customer_risk_scores (alert_triggered, calculated_at desc);
create index if not exists ad_optimization_suggestions_company_idx on public.ad_optimization_suggestions (company_id, status);
create index if not exists ad_optimization_suggestions_status_idx on public.ad_optimization_suggestions (status, generated_at desc);
create index if not exists seo_autopilot_jobs_status_idx on public.seo_autopilot_jobs (status, triggered_at desc);
create index if not exists seo_autopilot_jobs_post_idx on public.seo_autopilot_jobs (blog_post_id);

drop trigger if exists ad_optimization_suggestions_set_updated_at on public.ad_optimization_suggestions;
create trigger ad_optimization_suggestions_set_updated_at before update on public.ad_optimization_suggestions for each row execute function public.set_blog_updated_at();

drop trigger if exists seo_autopilot_jobs_set_updated_at on public.seo_autopilot_jobs;
create trigger seo_autopilot_jobs_set_updated_at before update on public.seo_autopilot_jobs for each row execute function public.set_blog_updated_at();

alter table public.ceo_briefings enable row level security;
alter table public.customer_risk_scores enable row level security;
alter table public.ad_optimization_suggestions enable row level security;
alter table public.seo_autopilot_jobs enable row level security;

drop policy if exists "Staff can manage ceo briefings" on public.ceo_briefings;
create policy "Staff can manage ceo briefings" on public.ceo_briefings for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage customer risk scores" on public.customer_risk_scores;
create policy "Staff can manage customer risk scores" on public.customer_risk_scores for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage ad optimization suggestions" on public.ad_optimization_suggestions;
create policy "Staff can manage ad optimization suggestions" on public.ad_optimization_suggestions for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage seo autopilot jobs" on public.seo_autopilot_jobs;
create policy "Staff can manage seo autopilot jobs" on public.seo_autopilot_jobs for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
