-- Customer Discovery "Kayıtlı Aramalar" (Saved Searches) — genuinely absent
-- feature confirmed missing repo-wide (no saved_search/search_history table,
-- no localStorage persistence of filter state) before this migration.
--
-- Stores a named, reusable Google Maps / Müşteri Keşfi filter combination per
-- staff user, plus the last known result count/run time so the UI can show
-- "cached results" vs. "needs a fresh search" without silently re-calling the
-- Google Maps API on every open (that API call costs quota).
--
-- RLS follows the server-only model established in
-- supabase/migrations/20260719_rls_lockdown.sql — every read/write goes
-- through Next.js server code using SUPABASE_SERVICE_ROLE_KEY, so per-user
-- scoping (a user only sees their own saved searches) is enforced in the API
-- route (owner_user_id = session.profileId), not via Postgres RLS policies
-- keyed to a Supabase Auth JWT the server never presents.

create table if not exists public.customer_discovery_saved_searches (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  filters_json jsonb not null default '{}'::jsonb,
  result_count integer not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists customer_discovery_saved_searches_owner_name_unique
  on public.customer_discovery_saved_searches (owner_user_id, lower(name))
  where archived_at is null;

create index if not exists customer_discovery_saved_searches_owner_idx
  on public.customer_discovery_saved_searches (owner_user_id) where archived_at is null;

alter table public.customer_discovery_saved_searches enable row level security;

drop policy if exists service_role_full_access on public.customer_discovery_saved_searches;
create policy service_role_full_access on public.customer_discovery_saved_searches for all to service_role using (true) with check (true);

comment on table public.customer_discovery_saved_searches is
  'RLS: server-only, no anon/authenticated policies by design, consistent with 20260719_rls_lockdown.sql. Per-user saved Google Maps / Müşteri Keşfi filter presets ("Kayıtlı Aramalar" tab). owner_user_id scoping is enforced in the API route, not via Postgres policy, since the app never presents a Supabase Auth JWT to Postgres.';
