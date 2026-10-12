-- Manuel Değerlendirme (Phase 7/8 of the Reklam Doktoru Pro 2.0 /
-- Instagram Intelligence brief) — a single, module-agnostic table backing
-- the "+ Manuel Değerlendirme" button added to every Reklam Doktoru Pro
-- tab (ad-doctor, ads-strategy, ad-creative, ad-evaluation,
-- candidate-evaluation, instagram). One table instead of six near-
-- identical ones: `module` + the JSONB `data` column carry the
-- module-specific schema (field configs live in
-- src/lib/manual-evaluations.ts, not in the database), everything else
-- (ownership, source tracking, draft/submit lifecycle, derived metrics,
-- Claude-import preservation) is shared.
--
-- Deliberately separate from instagram_profile_audits (that table is
-- Claude-MCP-write-only, approved analysis of an existing customer's real
-- connected Instagram — this table is always human-entered or
-- human-pasted, and must support a prospect that is NOT an existing
-- customer without ever fabricating a company row for them).
create extension if not exists pgcrypto;

create table if not exists public.manual_evaluations (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('ad-doctor', 'ads-strategy', 'ad-creative', 'ad-evaluation', 'candidate-evaluation', 'instagram')),

  -- At most one real-record owner — a prospect that is neither an existing
  -- customer nor an existing lead is still allowed (target_label alone
  -- identifies it); this table never creates a company or lead row itself.
  company_id uuid references public.companies(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  target_label text not null default '',

  title text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted')),

  -- Module-specific structured input, shaped per src/lib/manual-evaluations.ts
  -- MODULE_FIELD_GROUPS for this row's `module`.
  data jsonb not null default '{}'::jsonb,
  -- Recomputed server-side on every save from `data` — never trusted from
  -- client input, never fabricated when a required input is missing.
  derived_metrics jsonb not null default '{}'::jsonb,

  -- Phase 13 data-reliability source tag. 'manual' = typed in by a human
  -- through this form. 'claude_import' = a Claude analysis pasted back in
  -- (Phase 9/10) — claude_import below preserves the original text.
  source text not null default 'manual' check (source in ('manual', 'claude_import')),
  claude_import jsonb,
  notes text not null default '',

  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint manual_evaluations_not_both_owner check (not (company_id is not null and lead_id is not null))
);

create index if not exists manual_evaluations_module_idx on public.manual_evaluations (module);
create index if not exists manual_evaluations_company_idx on public.manual_evaluations (company_id);
create index if not exists manual_evaluations_lead_idx on public.manual_evaluations (lead_id);
create index if not exists manual_evaluations_module_company_idx on public.manual_evaluations (module, company_id, created_at desc);

drop trigger if exists manual_evaluations_set_updated_at on public.manual_evaluations;
create trigger manual_evaluations_set_updated_at
  before update on public.manual_evaluations
  for each row execute function public.set_updated_at();

alter table public.manual_evaluations enable row level security;

drop policy if exists "Staff can manage manual evaluations" on public.manual_evaluations;
create policy "Staff can manage manual evaluations" on public.manual_evaluations for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
