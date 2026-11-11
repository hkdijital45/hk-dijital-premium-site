-- Ön İnceleme Hazırlığı — "Ön incelemeyi kim talep etti?" field. Separate
-- from public.leads.source (the existing CRM lead-source field) — a lead's
-- original acquisition channel and who specifically asked for THIS
-- pre-audit are two different facts and must never be conflated.
alter table public.lead_pre_audit_preparations
  add column if not exists requested_by text not null default '' check (requested_by in ('', 'customer', 'hk_dijital', 'business_owner', 'referral', 'other')),
  add column if not exists requested_by_detail text not null default '';

notify pgrst, 'reload schema';
