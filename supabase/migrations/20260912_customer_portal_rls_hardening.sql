-- Customer portal RLS hardening — closes the gap the 20260719_rls_lockdown.sql
-- migration explicitly flagged as out of scope: "this migration audits
-- supabase/schema.sql only... The 70+ dated migration files under
-- supabase/migrations/ ... were not individually audited for RLS coverage in
-- this pass — that would be a separate, larger review."
--
-- Architecture note (same as 20260719_rls_lockdown.sql, restated because this
-- migration extends it): this application never queries Supabase directly
-- from the browser. Every read/write goes through Next.js server code using
-- SUPABASE_SERVICE_ROLE_KEY (see src/lib/supabase.ts, src/lib/auth.ts).
-- `service_role` has BYPASSRLS, so nothing below changes server behavior —
-- application-level company_id/session scoping (already audited: every real
-- /api/customer/** route filters by session.companyId) remains the actual
-- isolation mechanism. What RLS adds here is a second, independent layer:
-- until this runs, the 8 tables below are reachable by any Supabase client
-- role Supabase grants access to by default (including `anon`) with ZERO
-- row-level restriction, if that role/key were ever used directly against
-- Postgres/PostgREST instead of through this app's server routes — whether
-- by a future bug, a misconfigured endpoint, or key exposure.
--
-- Audit method: cross-referenced every table name queried by
-- src/app/api/customer/** and src/lib/customer*.ts against every
-- `enable row level security` statement in supabase/schema.sql and every
-- file under supabase/migrations/. These 8 were the only customer-portal
-- tables with no RLS statement anywhere in either.
--
-- Safe to re-run: `enable row level security` is a no-op if already enabled,
-- and every policy is dropped before it is recreated.

alter table public.customer_branding enable row level security;
alter table public.customer_documents enable row level security;
alter table public.customer_report_visibility enable row level security;
alter table public.meta_ad_metrics enable row level security;
alter table public.meta_adset_metrics enable row level security;
alter table public.meta_analysis_snapshots enable row level security;
alter table public.meta_conversion_events enable row level security;
alter table public.monthly_reports enable row level security;

-- Explicit service_role policy per table, matching 20260719_rls_lockdown.sql
-- exactly. Functionally a no-op for the server (service_role bypasses RLS
-- regardless of policies) — it documents the server-only access model on
-- every table instead of leaving it implicit, and is what actually makes
-- the "no anon/authenticated policy = default deny" state intentional
-- rather than an oversight a future migration might "fix" by adding a
-- permissive policy.
drop policy if exists service_role_full_access on public.customer_branding;
create policy service_role_full_access on public.customer_branding for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.customer_documents;
create policy service_role_full_access on public.customer_documents for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.customer_report_visibility;
create policy service_role_full_access on public.customer_report_visibility for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.meta_ad_metrics;
create policy service_role_full_access on public.meta_ad_metrics for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.meta_adset_metrics;
create policy service_role_full_access on public.meta_adset_metrics for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.meta_analysis_snapshots;
create policy service_role_full_access on public.meta_analysis_snapshots for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.meta_conversion_events;
create policy service_role_full_access on public.meta_conversion_events for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.monthly_reports;
create policy service_role_full_access on public.monthly_reports for all to service_role using (true) with check (true);

comment on table public.customer_documents is
  'RLS: server-only, no anon/authenticated policies by design. Holds customer-uploaded/generated documents (contracts, proposals, reports) — only SUPABASE_SERVICE_ROLE_KEY on the server may read/write this table.';

comment on table public.monthly_reports is
  'RLS: server-only, no anon/authenticated policies by design. Holds customer-facing performance reports — only SUPABASE_SERVICE_ROLE_KEY on the server may read/write this table.';
