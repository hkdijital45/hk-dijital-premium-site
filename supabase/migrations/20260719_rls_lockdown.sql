-- RLS lockdown
--
-- Architecture note: this application never queries Supabase directly from the
-- browser. Every read/write goes through Next.js server code using
-- SUPABASE_SERVICE_ROLE_KEY (see src/lib/supabase.ts, src/lib/auth.ts). The
-- NEXT_PUBLIC_SUPABASE_ANON_KEY is only ever used against Supabase Auth
-- (sign-in / password reset), never against a table. That means `anon` and
-- `authenticated` intentionally get NO policies below: with RLS enabled and
-- zero matching policies, Postgres denies access by default. `service_role`
-- is unaffected either way (it has BYPASSRLS), so the policies added here are
-- about making that intent explicit and auditable, not about changing runtime
-- behavior for the server.
--
-- Scope: this migration audits supabase/schema.sql only (the tables created
-- there). The 70+ dated migration files under supabase/migrations/ (agent hub,
-- blog/SEO, competitor intelligence, communication centers, accounting, OAuth
-- integrations, etc.) were not individually audited for RLS coverage in this
-- pass — that would be a separate, larger review.
--
-- If a client component ever needs to query Supabase directly with the anon
-- key, add a narrowly-scoped SELECT policy for that one table instead of
-- widening this file.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run (all statements are
-- idempotent: `enable row level security` is a no-op if already enabled, and
-- every policy is dropped before it is recreated).

-- 1) Enable RLS on schema.sql tables that were created without it. Until this
--    runs, these tables are reachable by any Supabase client role that
--    Supabase grants access to by default (including anon), regardless of the
--    app's own cookie-based session checks. `api_settings` (holds
--    encrypted_or_masked_key), `customers` (holds name/email/phone) and
--    `ad_integrations` (ad platform credentials) are the highest-exposure ones.
alter table public.site_settings enable row level security;
alter table public.pages enable row level security;
alter table public.services enable row level security;
alter table public.packages enable row level security;
alter table public.certificates enable row level security;
alter table public.media_files enable row level security;
alter table public.api_settings enable row level security;
alter table public.customers enable row level security;
alter table public.ad_integrations enable row level security;

-- 2) Explicit service_role policy per table. Functionally a no-op (service_role
--    bypasses RLS regardless of policies), but it documents the "server-only"
--    access model on every table instead of leaving it implicit.
drop policy if exists service_role_full_access on public.users;
create policy service_role_full_access on public.users for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.companies;
create policy service_role_full_access on public.companies for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.site_settings;
create policy service_role_full_access on public.site_settings for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.pages;
create policy service_role_full_access on public.pages for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.services;
create policy service_role_full_access on public.services for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.packages;
create policy service_role_full_access on public.packages for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.certificates;
create policy service_role_full_access on public.certificates for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.leads;
create policy service_role_full_access on public.leads for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.media_files;
create policy service_role_full_access on public.media_files for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.campaigns;
create policy service_role_full_access on public.campaigns for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.campaign_metrics;
create policy service_role_full_access on public.campaign_metrics for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.customer_updates;
create policy service_role_full_access on public.customer_updates for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.customer_visibility_settings;
create policy service_role_full_access on public.customer_visibility_settings for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.customer_files;
create policy service_role_full_access on public.customer_files for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.api_settings;
create policy service_role_full_access on public.api_settings for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.reports;
create policy service_role_full_access on public.reports for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.report_interpretations;
create policy service_role_full_access on public.report_interpretations for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.report_updates;
create policy service_role_full_access on public.report_updates for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.contact_forms;
create policy service_role_full_access on public.contact_forms for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.customers;
create policy service_role_full_access on public.customers for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.activity_logs;
create policy service_role_full_access on public.activity_logs for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.preparation_notes;
create policy service_role_full_access on public.preparation_notes for all to service_role using (true) with check (true);

drop policy if exists service_role_full_access on public.ad_integrations;
create policy service_role_full_access on public.ad_integrations for all to service_role using (true) with check (true);

-- 3) Document the intent directly on the highest-risk tables so it shows up
--    in any schema inspector.
comment on table public.api_settings is
  'RLS: server-only, no anon/authenticated policies by design. Holds provider API keys (encrypted_or_masked_key) — only SUPABASE_SERVICE_ROLE_KEY on the server may read/write this table.';

comment on table public.customers is
  'RLS: server-only, no anon/authenticated policies by design. Holds customer PII (full_name, email, phone) — only SUPABASE_SERVICE_ROLE_KEY on the server may read/write this table.';

comment on table public.ad_integrations is
  'RLS: server-only, no anon/authenticated policies by design. Holds ad platform integration credentials — only SUPABASE_SERVICE_ROLE_KEY on the server may read/write this table.';
