-- Reklam Değerlendirme — evaluates an ALREADY-RUNNING Meta Ads campaign's
-- real performance against its approved ad_strategies record, not a new
-- strategy. Distinct entity from ad_strategies/ad_creative_reports (one
-- campaign -> many evaluations over time, one per review cycle), same
-- proven "structured columns for what's filtered, JSONB for the rest,
-- internal vs. client report split" pattern as those two tables.
-- Immutable-snapshot by design: metrics_snapshot/prompt_text/reports are
-- captured at generation time and never rewritten when live Meta data
-- changes later — only parsed_at/decision/next_review/storage fields and
-- the report content itself (on a deliberate regenerate) are ever updated.
create table if not exists public.ad_evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  -- Optional local campaign link — a Meta campaign not yet mirrored into
  -- the local campaigns table (see 20260927/campaign sync) must never
  -- block an evaluation; meta_campaign_id is the real source of truth.
  campaign_id uuid references public.campaigns(id) on delete set null,
  meta_campaign_id text,
  ad_account_id text,
  strategy_id uuid references public.ad_strategies(id) on delete set null,
  creative_strategy_id uuid references public.ad_creative_reports(id) on delete set null,
  previous_evaluation_id uuid references public.ad_evaluations(id) on delete set null,

  evaluation_period_start date,
  evaluation_period_end date,
  campaign_age_hours numeric,

  -- { campaign: {...}, adsets: [...], ads: [...], syncedAt } — the exact
  -- Meta data this evaluation was generated from, frozen at generation
  -- time; later live syncs never touch this row.
  metrics_snapshot jsonb not null default '{}'::jsonb,

  prompt_text text not null default '',
  claude_raw_response text,
  -- { executiveSummary, sections: [{ title, content }] } — same shape as
  -- ad_strategies/ad_creative_reports' own internal/client report fields.
  internal_report jsonb not null default '{}'::jsonb,
  client_report jsonb not null default '{}'::jsonb,

  decision text check (decision in (
    'OBSERVE', 'CONTINUE', 'NO_CHANGE', 'MONITOR', 'CREATIVE_TEST', 'CREATIVE_CHANGE',
    'AUDIENCE_TEST', 'BUDGET_OPTIMIZATION', 'ADSET_OPTIMIZATION', 'REMARKETING',
    'TECHNICAL_ISSUE', 'SALES_PROCESS_REVIEW', 'INSUFFICIENT_DATA'
  )),
  next_review_at date,
  next_review_note text,

  status text not null default 'draft' check (status in ('draft', 'evaluated', 'archived')),

  -- Private Storage paths (bucket: ad-evaluation-reports, see below) —
  -- never a public URL; read back only through a signed-URL route that
  -- checks staff access, same pattern as team_attachments.
  internal_pdf_path text,
  internal_docx_path text,
  client_pdf_path text,
  client_docx_path text,

  source text not null default 'hk_admin',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists ad_evaluations_company_idx on public.ad_evaluations (company_id);
create index if not exists ad_evaluations_company_created_idx on public.ad_evaluations (company_id, created_at desc);
create index if not exists ad_evaluations_campaign_idx on public.ad_evaluations (campaign_id);
create index if not exists ad_evaluations_meta_campaign_idx on public.ad_evaluations (meta_campaign_id);
create index if not exists ad_evaluations_strategy_idx on public.ad_evaluations (strategy_id);

drop trigger if exists ad_evaluations_set_updated_at on public.ad_evaluations;
create trigger ad_evaluations_set_updated_at
  before update on public.ad_evaluations
  for each row execute function public.set_updated_at();

alter table public.ad_evaluations enable row level security;

drop policy if exists "Staff can manage ad_evaluations" on public.ad_evaluations;
create policy "Staff can manage ad_evaluations" on public.ad_evaluations for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

-- Private report-file storage, same private-bucket pattern already used
-- for team_attachments/communication-attachments (raw storage REST
-- upload + a staff-gated signed-URL route — see that route for the
-- read pattern this feature reuses). Never public: these PDFs/DOCX
-- contain real customer performance data.
insert into storage.buckets (id, name, public)
values ('ad-evaluation-reports', 'ad-evaluation-reports', false)
on conflict (id) do nothing;

drop policy if exists "Staff can manage ad-evaluation-reports objects" on storage.objects;
create policy "Staff can manage ad-evaluation-reports objects" on storage.objects for all using (
  bucket_id = 'ad-evaluation-reports' and exists (
    select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null
  )
) with check (
  bucket_id = 'ad-evaluation-reports' and exists (
    select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null
  )
);

notify pgrst, 'reload schema';
