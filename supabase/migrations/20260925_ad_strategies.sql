-- Reklam Stratejisi Operasyon Sistemi — turns Claude's ad strategy output
-- (Meta/Google Ads) from a single JSONB patch on a generic Claude-activity
-- log row (hk_intelligence_ceo_runs.final_report.ads_strategy) into a real,
-- versioned, status-tracked, editable operational record: draft → approved
-- → active → updated → archived, with a dedicated internal report and a
-- separate client-safe report, so HK Admin can edit, export (PDF/DOCX),
-- and Meta/Google setup can reliably resolve "the current approved/active
-- strategy" for a company.
--
-- hk_intelligence_ceo_runs is unaffected and keeps recording general
-- Claude activity — only the ads-strategy write path moves here. Older
-- hk_intelligence_ceo_runs rows with final_report.activity_type =
-- 'ADS_STRATEGY_CREATED' are NOT migrated/deleted — they stay readable,
-- read-only, as "legacy" strategies (see ad-strategies.ts) for companies
-- that have no row in this new table yet.
create table if not exists public.ad_strategies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,

  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'approved', 'active', 'updated', 'archived')),
  strategy_title text not null default '',

  primary_platform text not null default '',
  primary_goal text not null default '',
  monthly_ad_budget numeric,
  daily_budget_estimate numeric,
  meta_budget numeric,
  google_budget numeric,
  primary_kpi text not null default '',

  -- [{ order, name, objective, conversionLocation, dailyBudget, purpose, transitionCondition }]
  campaign_sequence jsonb not null default '[]'::jsonb,
  -- { required, status: 'not_ready'|'ready'|'active', condition }
  remarketing jsonb not null default '{}'::jsonb,

  -- Each report: { executiveSummary, sections: [{ title, content }] } — kept
  -- as flexible JSONB rather than one fixed DB column per report section,
  -- since the real section set varies and is user-editable free text.
  internal_report jsonb not null default '{}'::jsonb,
  client_report jsonb not null default '{}'::jsonb,
  -- The raw structured input Claude submitted (save_ads_strategy_plan) —
  -- source data behind the normalized columns/reports above, kept for
  -- traceability/debugging, never shown to the customer.
  full_strategy_payload jsonb not null default '{}'::jsonb,

  -- Version chain — resolved server-side at save time from this company's
  -- own current latest row, never trusted from client input (same pattern
  -- as instagram_profile_audits.previous_audit_id).
  previous_strategy_id uuid references public.ad_strategies(id) on delete set null,
  source text not null default 'claude_mcp',

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  activated_at timestamptz,
  archived_at timestamptz
);

create index if not exists ad_strategies_company_idx on public.ad_strategies (company_id);
create index if not exists ad_strategies_company_status_idx on public.ad_strategies (company_id, status);
create index if not exists ad_strategies_company_created_idx on public.ad_strategies (company_id, created_at desc);

drop trigger if exists ad_strategies_set_updated_at on public.ad_strategies;
create trigger ad_strategies_set_updated_at
  before update on public.ad_strategies
  for each row execute function public.set_updated_at();

-- Row Level Security — same staff-role predicate as instagram_profile_audits
-- / pre_audit_reports / social_content_plan_items. Server routes use the
-- service-role key (bypasses RLS); this only guards client-side/anon-key
-- access.
alter table public.ad_strategies enable row level security;

drop policy if exists "Staff can manage ad_strategies" on public.ad_strategies;
create policy "Staff can manage ad_strategies" on public.ad_strategies for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
