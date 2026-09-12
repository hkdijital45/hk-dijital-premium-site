-- HK Lead Intelligence Engine ("Müşteri İstihbarat Motoru") persistence.
--
-- A genuinely new concept, not a duplicate of anything existing: it stores
-- a structured, evidence-based, multi-specialist sales-intelligence report
-- per discovered business, keyed by business identity (Google Place ID or
-- a normalized name+phone+city+district fingerprint) rather than by
-- lead_id, because analysis can happen BEFORE a business is ever saved as
-- a lead (see the discovery workflow). lead_id is populated once/if the
-- business is saved.
--
-- This is deliberately separate from the existing leads.ai_analysis
-- column, which backs a different, already-working feature (the simple
-- free-text "AI ile Analiz Et" button in the lead detail drawer) — that
-- feature and its column are untouched by this migration.
--
-- Idempotent: safe to re-run.

create table if not exists public.lead_intelligence_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  lead_id uuid references public.leads(id) on delete set null,
  google_place_id text,
  business_fingerprint text not null,
  business_name text not null,
  sector text,
  city text,
  district text,

  analysis_level text not null default 'level1' check (analysis_level in ('level0', 'level1', 'level2')),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),

  -- The authoritative, deterministic HK Opportunity Score (0-100, same
  -- calculateHkOpportunityScore() every other module uses) — the AI never
  -- overrides this number, only adds qualitative context around it.
  opportunity_score integer,
  confidence integer,
  priority text check (priority in ('very_high', 'high', 'medium', 'low')),

  summary text,
  recommended_services text[] not null default '{}',
  final_recommendation text,
  red_flags text[] not null default '{}',

  -- Full six-specialist structured breakdown (leadQualifier,
  -- digitalPresence, market, growth, sales) — genuinely flexible/nested,
  -- JSONB is the right fit here rather than a wall of columns.
  result jsonb not null default '{}'::jsonb,

  -- Cache/staleness keys: business_fingerprint identifies WHICH business;
  -- evidence_fingerprint identifies the exact evidence snapshot that
  -- produced this specific result, so a manual re-analyze only calls the
  -- AI again when the real evidence actually changed.
  evidence_fingerprint text,
  schema_version integer not null default 1,

  ai_provider text,
  ai_model text,
  ai_used boolean not null default false,
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_analyzed_at timestamptz
);

-- One current profile per business per workspace; re-analysis upserts this
-- same row rather than creating a growing history table (see migration
-- header — a full run-history table was deliberately not built for V1).
create unique index if not exists lead_intelligence_profiles_business_unique
  on public.lead_intelligence_profiles (workspace_id, business_fingerprint);

create index if not exists lead_intelligence_profiles_lead_idx
  on public.lead_intelligence_profiles (lead_id);
create index if not exists lead_intelligence_profiles_place_idx
  on public.lead_intelligence_profiles (google_place_id);
create index if not exists lead_intelligence_profiles_priority_idx
  on public.lead_intelligence_profiles (workspace_id, priority);
create index if not exists lead_intelligence_profiles_updated_idx
  on public.lead_intelligence_profiles (workspace_id, updated_at desc);

alter table public.lead_intelligence_profiles enable row level security;

drop policy if exists service_role_full_access on public.lead_intelligence_profiles;
create policy service_role_full_access on public.lead_intelligence_profiles
  for all to service_role using (true) with check (true);

comment on table public.lead_intelligence_profiles is
  'RLS: server-only, no anon/authenticated policies by design. Admin-only sales intelligence — only SUPABASE_SERVICE_ROLE_KEY on the server may read/write this table.';
