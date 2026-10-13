-- Teklif Motoru (Premium Proposal Engine) — a lead/customer-scoped
-- commercial proposal, built the same way every other Claude-assisted
-- module this session already uses: HK Admin generates a prompt, a human
-- runs it in a real Claude Project (no AI API key anywhere in this app),
-- pastes the structured HK_PROPOSAL_V1 JSON result back, HK Admin
-- validates and imports it as an editable draft. financials is always
-- computed deterministically by this app's own code — never trusted from
-- Claude's own arithmetic.
--
-- Same polymorphic company_id/lead_id ownership as candidate_evaluations/
-- pre_audit_reports (at most one, a pure prospect identified by
-- target_label alone is also valid — never forces a fake company/lead
-- row to exist). Sending a proposal never overwrites it: a new revision
-- is a NEW row with previous_proposal_id pointing at the sent one and
-- version bumped — enforced at the application layer (a sent proposal is
-- treated as read-only going forward), not by a DB trigger, matching the
-- existing codebase's own "insert-only history" convention elsewhere.
create extension if not exists pgcrypto;

create sequence if not exists public.proposal_number_seq;

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  target_label text not null default '',

  proposal_number text not null unique default ('TKL-' || to_char(timezone('utc', now()), 'YYYY') || '-' || lpad(nextval('public.proposal_number_seq')::text, 4, '0')),
  title text not null default '',
  status text not null default 'Taslak' check (status in (
    'Taslak', 'Analiz Bekleniyor', 'Analiz İçe Aktarıldı', 'Düzenleniyor',
    'Gönderime Hazır', 'Gönderildi', 'Revize Ediliyor', 'Kabul Edildi',
    'Reddedildi', 'Süresi Doldu'
  )),
  version integer not null default 1,
  previous_proposal_id uuid references public.proposals(id) on delete set null,

  -- Section A-I questionnaire answers (business/platforms/objectives/
  -- audience/budget/fees/strategy/research/review) — the raw input the
  -- Claude prompt is built from.
  questionnaire jsonb not null default '{}'::jsonb,
  -- HK_PROPOSAL_V1-shaped content: business, market_analysis, competitors,
  -- google_ads_strategy, meta_ads_strategy, audience_strategy,
  -- budget_scenarios, recommended_services, implementation_plan,
  -- roadmap_90_days, risks, assumptions, sources, customer_proposal,
  -- internal_recommendations. Populated either by manual editing or by a
  -- validated Claude import — always fully editable afterward either way.
  data jsonb not null default '{}'::jsonb,
  -- Deterministic financial totals (google/meta/other ad budget, agency
  -- fee, setup fee, tax treatment, first/subsequent-month, contract
  -- total) — computed by this app's own code, never Claude's arithmetic.
  financials jsonb not null default '{}'::jsonb,

  source text not null default 'manual' check (source in ('manual', 'claude_import')),
  -- Original pasted/uploaded Claude text preserved verbatim for audit,
  -- same pattern as manual_evaluations.claude_import.
  claude_import jsonb,

  valid_until date,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,

  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint proposals_not_both_owner check (not (company_id is not null and lead_id is not null))
);

create index if not exists proposals_company_idx on public.proposals (company_id);
create index if not exists proposals_lead_idx on public.proposals (lead_id);
create index if not exists proposals_status_idx on public.proposals (status);
create index if not exists proposals_created_idx on public.proposals (created_at desc);

drop trigger if exists proposals_set_updated_at on public.proposals;
create trigger proposals_set_updated_at
  before update on public.proposals
  for each row execute function public.set_updated_at();

alter table public.proposals enable row level security;

drop policy if exists "Staff can manage proposals" on public.proposals;
create policy "Staff can manage proposals" on public.proposals for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
