-- Customer Notes: structured multi-note manager for the Customer 360 "Notlar" tab.
--
-- Context: the tab previously edited a single `companies.notes` text column
-- (one blob, no author, no timestamps, no categories, no pin/archive). This
-- migration adds a real per-note table without touching or deleting the
-- legacy column — `companies.notes` stays exactly as-is and is surfaced
-- read-only in the UI as "Eski not (taşınmış)" migrated content.
--
-- RLS follows the server-only model established in
-- supabase/migrations/20260719_rls_lockdown.sql: this app never queries
-- Supabase directly from the browser, every read/write goes through Next.js
-- server code using SUPABASE_SERVICE_ROLE_KEY. So `anon`/`authenticated` get
-- no policies (default-deny), and `service_role` gets one explicit
-- documenting policy (functionally a no-op since service_role bypasses RLS,
-- but keeps the audit trail consistent with every other table in this repo).

create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 8000),
  category text not null default 'Genel',
  is_pinned boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_by_name text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_notes_company_id_idx on public.customer_notes (company_id);
create index if not exists customer_notes_company_pinned_idx on public.customer_notes (company_id, is_pinned) where archived_at is null;
create index if not exists customer_notes_company_category_idx on public.customer_notes (company_id, category);

alter table public.customer_notes enable row level security;

drop policy if exists service_role_full_access on public.customer_notes;
create policy service_role_full_access on public.customer_notes for all to service_role using (true) with check (true);

comment on table public.customer_notes is
  'RLS: server-only, no anon/authenticated policies by design, consistent with 20260719_rls_lockdown.sql. Structured multi-note manager for the Customer 360 "Notlar" tab (search/category/pin/archive). The legacy companies.notes text column is preserved unmodified and shown read-only in the UI as migrated content.';
