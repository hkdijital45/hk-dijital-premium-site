-- Manual Lead + Ön İnceleme Hazırlığı — adds the one genuinely missing
-- piece (structured preparation notes + a prep-specific status, kept
-- separate from leads.status/the sales pipeline and separate from the
-- existing Müşteri Keşfi pre-review queue status) on top of already-
-- existing infrastructure: public.leads already has source/status/
-- next_action/next_action_at, and pre_audit_reports already supports
-- lead_id (20260921_pre_audit_lead_support.sql) — neither is touched or
-- duplicated here.

alter table public.leads
  add column if not exists next_action_note text,
  add column if not exists source_detail text;

create table if not exists public.lead_pre_audit_preparations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  social_observations text not null default '',
  business_notes text not null default '',
  advertising_status text not null default 'unknown' check (advertising_status in ('yes', 'no', 'unknown')),
  potential_reason text not null default '',
  focus_notes text not null default '',
  competitor_reference text not null default '',
  status text not null default 'not_prepared' check (status in ('not_prepared', 'preparing', 'ready', 'sent_to_claude', 'completed', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists lead_pre_audit_preparations_lead_idx on public.lead_pre_audit_preparations (lead_id);

drop trigger if exists lead_pre_audit_preparations_set_updated_at on public.lead_pre_audit_preparations;
create trigger lead_pre_audit_preparations_set_updated_at
  before update on public.lead_pre_audit_preparations
  for each row execute function public.set_updated_at();

alter table public.lead_pre_audit_preparations enable row level security;

drop policy if exists "Staff can manage lead_pre_audit_preparations" on public.lead_pre_audit_preparations;
create policy "Staff can manage lead_pre_audit_preparations" on public.lead_pre_audit_preparations for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
