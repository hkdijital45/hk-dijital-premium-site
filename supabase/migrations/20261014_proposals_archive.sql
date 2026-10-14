-- Reversible archiving for Teklif Merkezi (requested: remove the two
-- Abdulmalik test proposals, TKL-2026-0001/TKL-2026-0002, from the
-- active list WITHOUT deleting them or any related Lead/analysis data).
-- Same archived_at convention already used by campaigns/agency_tasks/
-- payment_records/activity_logs in this project (see
-- 20260612_campaign_management_module.sql,
-- 20260612_task_payment_history_fields.sql).
alter table public.proposals
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id) on delete set null;

create index if not exists proposals_archived_at_idx on public.proposals (archived_at);

-- Archives exactly the two specific, already-verified records (real IDs
-- confirmed via a direct read before writing this migration: both
-- lead_id = ae298378-783c-48e2-be92-764e8060a512, the real Abdulmalik
-- Beyaz Eşya Teknik Servis lead). Fully reversible — run
-- `update public.proposals set archived_at = null, archived_by = null
-- where id in (...)` to restore either one at any time. Touches only
-- these two rows: no other proposal, the lead itself, its notes,
-- pre_audit_reports, instagram_profile_audits, or ad_evaluations are
-- affected by this statement.
update public.proposals
set archived_at = timezone('utc', now())
where id in ('ce4187fc-b531-4adf-957e-ab8c78d84387', '9f5ce810-71a5-4bda-85d1-6883f0579176')
  and archived_at is null;

notify pgrst, 'reload schema';
