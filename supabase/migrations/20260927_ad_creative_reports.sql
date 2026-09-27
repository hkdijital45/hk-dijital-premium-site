-- Reklam Kreatif Raporu — the creative-production follow-on to a
-- customer's ad_strategies record: Reklam Stratejisi → Kreatif Brief →
-- Reklam Kreatif Raporu. Own dedicated table (not squeezed into
-- ad_strategies, a different concern — one strategic plan vs. many
-- concrete creative executions per strategy), following the exact same
-- versioned/status-tracked/internal-vs-client-report pattern already
-- proven for ad_strategies (see 20260925_ad_strategies.sql). Heterogeneous
-- per-format creative fields (video scenes, static design notes, carousel
-- slides, story fields, ad copy) live in flexible JSONB rather than a
-- separate table per format — the same "structured columns for what's
-- filtered/queried, JSONB for what's just displayed" split already used
-- there, not 8-10 tables for a single-entity concept.
create table if not exists public.ad_creative_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  -- Optional — a company with no ad strategy yet must never break this
  -- feature; the link is set-null on strategy deletion, never cascades.
  ad_strategy_id uuid references public.ad_strategies(id) on delete set null,
  ad_strategy_version integer,

  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'approved', 'active', 'archived')),
  report_title text not null default '',

  -- { campaignGoal, creativeRole, targetAudience, funnelStage,
  --   awarenessLevel, keyMessage, primaryCta, creativeAngles: string[] }
  strategy_summary jsonb not null default '{}'::jsonb,
  -- [{ order, format ('reels'|'video'|'story'|'static'|'carousel'|...),
  --    title, funnelStage, angle, hook, cta, priority, adCopy: {
  --    primaryText, headline, description, cta }, videoScenes: [...],
  --    staticFields: {...}, carouselSlides: [...], storyFields: {...},
  --    details, internalNotes }] — format-specific sub-shapes are
  --    themselves flexible JSONB (never hard-coded to today's format list).
  creatives jsonb not null default '[]'::jsonb,
  -- [{ hypothesis, variable, constants, expectedBehavior, evaluationCriteria }]
  ab_test_plan jsonb not null default '[]'::jsonb,
  -- [{ name, description, quantity, format, instructions }]
  required_materials jsonb not null default '[]'::jsonb,
  -- [{ label, checked }] — dynamic per report, never a fixed 10-item list.
  production_checklist jsonb not null default '[]'::jsonb,

  -- Each report: { executiveSummary, sections: [{ title, content }] } —
  -- same flexible shape as ad_strategies.internal_report/client_report.
  internal_report jsonb not null default '{}'::jsonb,
  client_report jsonb not null default '{}'::jsonb,
  full_payload jsonb not null default '{}'::jsonb,

  previous_report_id uuid references public.ad_creative_reports(id) on delete set null,
  source text not null default 'hk_admin',

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  activated_at timestamptz,
  archived_at timestamptz
);

create index if not exists ad_creative_reports_company_idx on public.ad_creative_reports (company_id);
create index if not exists ad_creative_reports_company_status_idx on public.ad_creative_reports (company_id, status);
create index if not exists ad_creative_reports_company_created_idx on public.ad_creative_reports (company_id, created_at desc);
create index if not exists ad_creative_reports_strategy_idx on public.ad_creative_reports (ad_strategy_id);

drop trigger if exists ad_creative_reports_set_updated_at on public.ad_creative_reports;
create trigger ad_creative_reports_set_updated_at
  before update on public.ad_creative_reports
  for each row execute function public.set_updated_at();

alter table public.ad_creative_reports enable row level security;

drop policy if exists "Staff can manage ad_creative_reports" on public.ad_creative_reports;
create policy "Staff can manage ad_creative_reports" on public.ad_creative_reports for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
