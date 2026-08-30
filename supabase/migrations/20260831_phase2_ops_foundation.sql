-- Phase 2: Unified Communication Hub (AI layer), Capacity Planner, Client
-- Health Score, Dynamic Pricing, Smart Onboarding monitor.
--
-- Deliberately reuses existing tables instead of duplicating them:
--   - customer_conversations/customer_messages already ARE the unified
--     communication model (20260715_customer_communication_center.sql) —
--     this migration only adds an AI-insight companion table, not a second
--     ticketing system.
--   - agency_tasks is reused directly for capacity allocation (gets one new
--     estimated_hours column) instead of a separate allocations table.
--   - customer_risk_scores already exists for churn risk; this migration
--     adds the distinct customer_health_scores (relationship quality, not
--     churn likelihood) rather than overloading the risk table.

alter table if exists public.agency_tasks add column if not exists estimated_hours numeric;

create table if not exists public.communication_ai_insights (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.customer_conversations(id) on delete cascade,
  summary text,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative', 'urgent')),
  action_items jsonb not null default '[]'::jsonb,
  suggested_reply text,
  model text,
  generated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_capacity_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  weekly_hours numeric not null default 40 check (weekly_hours > 0),
  skills text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customer_health_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  score integer not null default 0 check (score between 0 and 100),
  health_level text not null default 'good' check (health_level in ('critical', 'at_risk', 'good', 'excellent')),
  factors_json jsonb not null default '{}'::jsonb,
  previous_score integer,
  trend text default 'stable' check (trend in ('improving', 'stable', 'worsening')),
  calculated_at timestamptz not null default timezone('utc', now()),
  source_version text not null default 'v1',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pricing_recommendations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  selected_services jsonb not null default '[]'::jsonb,
  recommended_price numeric not null default 0,
  recommended_range_min numeric,
  recommended_range_max numeric,
  expected_margin numeric,
  close_probability integer check (close_probability between 0 and 100),
  ai_rationale text,
  actual_outcome text default 'pending' check (actual_outcome in ('pending', 'won', 'lost')),
  actual_amount numeric,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.onboarding_reminder_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  step_key text not null,
  reminded_at timestamptz not null default timezone('utc', now()),
  cooldown_until timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (company_id, step_key)
);

create index if not exists communication_ai_insights_conversation_idx on public.communication_ai_insights (conversation_id, generated_at desc);
create index if not exists customer_health_scores_company_idx on public.customer_health_scores (company_id, calculated_at desc);
create index if not exists pricing_recommendations_lead_idx on public.pricing_recommendations (lead_id);
create index if not exists pricing_recommendations_company_idx on public.pricing_recommendations (company_id);
create index if not exists onboarding_reminder_log_company_idx on public.onboarding_reminder_log (company_id, step_key);

drop trigger if exists pricing_recommendations_set_updated_at on public.pricing_recommendations;
create trigger pricing_recommendations_set_updated_at before update on public.pricing_recommendations for each row execute function public.set_blog_updated_at();

drop trigger if exists user_capacity_profiles_set_updated_at on public.user_capacity_profiles;
create trigger user_capacity_profiles_set_updated_at before update on public.user_capacity_profiles for each row execute function public.set_blog_updated_at();

alter table public.communication_ai_insights enable row level security;
alter table public.user_capacity_profiles enable row level security;
alter table public.customer_health_scores enable row level security;
alter table public.pricing_recommendations enable row level security;
alter table public.onboarding_reminder_log enable row level security;

drop policy if exists "Staff can manage communication ai insights" on public.communication_ai_insights;
create policy "Staff can manage communication ai insights" on public.communication_ai_insights for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage capacity profiles" on public.user_capacity_profiles;
create policy "Staff can manage capacity profiles" on public.user_capacity_profiles for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage customer health scores" on public.customer_health_scores;
create policy "Staff can manage customer health scores" on public.customer_health_scores for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage pricing recommendations" on public.pricing_recommendations;
create policy "Staff can manage pricing recommendations" on public.pricing_recommendations for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage onboarding reminder log" on public.onboarding_reminder_log;
create policy "Staff can manage onboarding reminder log" on public.onboarding_reminder_log for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
