-- Lead Pre-Review Pipeline — extends pre_audit_reports (built for
-- company-scoped analysis) to also support a lead-scoped pre-review queue
-- item, created the moment a Müşteri Keşfi discovery candidate is sent to
-- "Ön İncele" — before it is ever a customer, and often before it is even
-- worth becoming a lead-pipeline priority. Reuses public.leads (the
-- existing canonical pre-customer entity, already used by Müşteri Keşfi's
-- CRM save and by the existing lead→customer /convert route) rather than
-- inventing a second discovery/lead concept. No new table.

alter table public.pre_audit_reports
  alter column company_id drop not null;

alter table public.pre_audit_reports
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

alter table public.pre_audit_reports
  drop constraint if exists pre_audit_reports_company_or_lead_check;
alter table public.pre_audit_reports
  add constraint pre_audit_reports_company_or_lead_check
  check (company_id is not null or lead_id is not null);

create index if not exists pre_audit_reports_lead_idx on public.pre_audit_reports (lead_id);

notify pgrst, 'reload schema';
