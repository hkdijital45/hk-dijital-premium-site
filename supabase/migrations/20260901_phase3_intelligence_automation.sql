-- Phase 3: GEO visibility observations, cash flow forecasting, upsell
-- engine, sales call analysis (shared with the meeting summarizer — one
-- transcript-backed table, not two), and creative asset management.
--
-- Competitive Intelligence Radar (spec Feature 14) already has a mature,
-- real implementation (competitor_watchlist/competitor_signals with real
-- scoring, resolve workflow, customer-facing summaries) — this migration
-- adds nothing for it; only a "convert to task" route was added elsewhere.

create table if not exists public.geo_visibility_observations (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  platform text not null default 'manual' check (platform in ('chatgpt', 'perplexity', 'gemini', 'manual')),
  brand_mentioned boolean not null default false,
  competitor_mentions jsonb not null default '[]'::jsonb,
  cited_url text,
  confidence integer default 50 check (confidence between 0 and 100),
  source text not null default 'manual' check (source in ('manual', 'provider')),
  notes text,
  observed_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cash_flow_forecasts (
  id uuid primary key default gen_random_uuid(),
  forecast_date date not null default current_date,
  period_months integer not null default 3 check (period_months between 1 and 12),
  scenario text not null check (scenario in ('conservative', 'base', 'optimistic')),
  projected_revenue numeric not null default 0,
  projected_expenses numeric not null default 0,
  projected_net numeric not null default 0,
  breakdown jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.upsell_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  trigger_type text not null,
  recommended_service text not null,
  estimated_value numeric default 0,
  probability integer default 0 check (probability between 0 and 100),
  evidence jsonb not null default '{}'::jsonb,
  ai_pitch text,
  status text not null default 'new' check (status in ('new', 'approved', 'proposal_sent', 'dismissed')),
  proposal_reference_id uuid references public.pricing_recommendations(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sales_call_analyses (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  record_type text not null default 'sales_call' check (record_type in ('sales_call', 'meeting')),
  transcript_source text not null default 'manual_text' check (transcript_source in ('manual_text', 'audio_upload')),
  raw_transcript text not null,
  occurred_at timestamptz not null default timezone('utc', now()),
  summary text,
  decisions jsonb not null default '[]'::jsonb,
  action_items jsonb not null default '[]'::jsonb,
  objections jsonb not null default '[]'::jsonb,
  sentiment text,
  closing_probability integer check (closing_probability between 0 and 100),
  coaching_feedback text,
  next_steps text,
  tasks_synced boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid references public.campaign_metrics(id) on delete set null,
  asset_type text not null default 'image' check (asset_type in ('image', 'video', 'copy', 'other')),
  storage_path text not null,
  version integer not null default 1,
  parent_asset_id uuid references public.creative_assets(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'awaiting_approval', 'approved', 'live', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ab_tests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid references public.campaign_metrics(id) on delete set null,
  name text not null,
  variant_a_asset_id uuid references public.creative_assets(id) on delete set null,
  variant_b_asset_id uuid references public.creative_assets(id) on delete set null,
  start_date date,
  end_date date,
  status text not null default 'running' check (status in ('running', 'completed', 'insufficient_data')),
  outcome_metrics jsonb not null default '{}'::jsonb,
  winner text check (winner in ('a', 'b', 'inconclusive')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists geo_visibility_observations_query_idx on public.geo_visibility_observations (query, observed_at desc);
create index if not exists cash_flow_forecasts_date_idx on public.cash_flow_forecasts (forecast_date desc, scenario);
create index if not exists upsell_opportunities_company_idx on public.upsell_opportunities (company_id, status);
create index if not exists sales_call_analyses_company_idx on public.sales_call_analyses (company_id, occurred_at desc);
create index if not exists sales_call_analyses_lead_idx on public.sales_call_analyses (lead_id);
create index if not exists creative_assets_company_idx on public.creative_assets (company_id, status);
create index if not exists ab_tests_company_idx on public.ab_tests (company_id, status);

drop trigger if exists upsell_opportunities_set_updated_at on public.upsell_opportunities;
create trigger upsell_opportunities_set_updated_at before update on public.upsell_opportunities for each row execute function public.set_blog_updated_at();

alter table public.geo_visibility_observations enable row level security;
alter table public.cash_flow_forecasts enable row level security;
alter table public.upsell_opportunities enable row level security;
alter table public.sales_call_analyses enable row level security;
alter table public.creative_assets enable row level security;
alter table public.ab_tests enable row level security;

drop policy if exists "Staff can manage geo visibility observations" on public.geo_visibility_observations;
create policy "Staff can manage geo visibility observations" on public.geo_visibility_observations for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage cash flow forecasts" on public.cash_flow_forecasts;
create policy "Staff can manage cash flow forecasts" on public.cash_flow_forecasts for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage upsell opportunities" on public.upsell_opportunities;
create policy "Staff can manage upsell opportunities" on public.upsell_opportunities for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage sales call analyses" on public.sales_call_analyses;
create policy "Staff can manage sales call analyses" on public.sales_call_analyses for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage creative assets" on public.creative_assets;
create policy "Staff can manage creative assets" on public.creative_assets for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage ab tests" on public.ab_tests;
create policy "Staff can manage ab tests" on public.ab_tests for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
