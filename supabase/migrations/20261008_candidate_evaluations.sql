-- Aday Değerlendirme (Candidate Evaluation) — "is this prospect worth
-- pursuing?" qualification reports, deliberately SEPARATE from Ön İnceleme
-- (pre_audit_reports, a much deeper pre-sales digital audit). Mirrors
-- pre_audit_reports' polymorphic company_id/lead_id linkage (exactly one
-- of the two, same as that table) and its insert-only history model —
-- never overwrites a prior evaluation, a real re-evaluation always adds a
-- new row. A prospect is never, by this table's existence alone, turned
-- into a customer: company_id/lead_id are only ever foreign keys to rows
-- that already exist through the application's own flows.

create extension if not exists pgcrypto;

create table if not exists public.candidate_evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  title text not null default '',
  report_date date not null default (timezone('utc', now()))::date,

  recommendation text not null default '',
  priority text not null default '',
  score integer check (score is null or score between 0 and 100),
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  digital_opportunities text[] not null default '{}',
  suggested_next_action text not null default '',
  report_content text not null default '',
  sources jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint candidate_evaluations_exactly_one_owner check (
    (company_id is not null and lead_id is null) or (company_id is null and lead_id is not null)
  )
);

create or replace function public.set_candidate_evaluation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists candidate_evaluations_set_updated_at on public.candidate_evaluations;
create trigger candidate_evaluations_set_updated_at before update on public.candidate_evaluations for each row execute function public.set_candidate_evaluation_updated_at();

create index if not exists candidate_evaluations_company_idx on public.candidate_evaluations (company_id);
create index if not exists candidate_evaluations_lead_idx on public.candidate_evaluations (lead_id);
create index if not exists candidate_evaluations_report_date_idx on public.candidate_evaluations (report_date desc);

alter table public.candidate_evaluations enable row level security;

drop policy if exists "Staff can manage candidate evaluations" on public.candidate_evaluations;
create policy "Staff can manage candidate evaluations" on public.candidate_evaluations for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);
