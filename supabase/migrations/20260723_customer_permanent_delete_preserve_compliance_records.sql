-- Customer permanent-delete fix (see fix in src/app/api/admin/companies/[id]/route.ts):
-- the DELETE handler now actually removes the companies row instead of only
-- patching its status. Everything company-scoped that is NOT explicitly listed
-- below already cascade-deletes automatically and is correctly wiped with the
-- customer (agency_tasks, customer_integrations, campaigns, customers, etc.).
--
-- These specific tables are financial/legal/audit records that must survive a
-- customer's permanent deletion (accounting/tax retention, dispute history).
-- Detach them (company_id -> null) instead of cascading them away.
alter table if exists public.reports
  alter column company_id drop not null;

alter table if exists public.reports
  drop constraint if exists reports_company_id_fkey,
  add constraint reports_company_id_fkey foreign key (company_id) references public.companies(id) on delete set null;

alter table if exists public.monthly_reports
  drop constraint if exists monthly_reports_company_id_fkey,
  add constraint monthly_reports_company_id_fkey foreign key (company_id) references public.companies(id) on delete set null;

alter table if exists public.customer_documents
  drop constraint if exists customer_documents_company_id_fkey,
  add constraint customer_documents_company_id_fkey foreign key (company_id) references public.companies(id) on delete set null;

alter table if exists public.payment_records
  drop constraint if exists payment_records_company_id_fkey,
  add constraint payment_records_company_id_fkey foreign key (company_id) references public.companies(id) on delete set null;

alter table if exists public.customer_files
  drop constraint if exists customer_files_company_id_fkey,
  add constraint customer_files_company_id_fkey foreign key (company_id) references public.companies(id) on delete set null;

alter table if exists public.activity_logs
  drop constraint if exists activity_logs_company_id_fkey,
  add constraint activity_logs_company_id_fkey foreign key (company_id) references public.companies(id) on delete set null;
