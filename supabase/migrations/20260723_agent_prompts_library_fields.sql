-- Prompt Kütüphanesi (Final Development Sprint B) — the "Prompt Merkezi" tab
-- in HK Agent Hub previously rendered a fully static, hardcoded table and
-- never queried public.agent_prompts at all (confirmed: no list/create/
-- update/delete route existed for this table, only the already-shipped
-- versions/restore routes). This migration adds the small set of columns a
-- real prompt-library UI needs that the existing schema doesn't cover —
-- everything else (category via task_type, recommended provider via
-- provider_key, active/archive via is_active) already exists and is reused
-- as-is.

alter table if exists public.agent_prompts
  add column if not exists description text,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists created_by uuid references public.users(id) on delete set null;

create index if not exists agent_prompts_is_favorite_idx on public.agent_prompts (is_favorite) where is_favorite = true;

comment on column public.agent_prompts.description is
  'Short usage note shown in the Prompt Kütüphanesi list — optional, nullable for existing seeded rows.';
comment on column public.agent_prompts.is_favorite is
  'Shared/global favorite flag (this table has no per-user ownership model), toggled from the Prompt Kütüphanesi UI.';

-- RLS already enabled on this table (supabase/migrations/20260627_agent_hub_v1.sql);
-- no policy change needed since all access continues to go through
-- SUPABASE_SERVICE_ROLE_KEY server-side routes, consistent with
-- supabase/migrations/20260719_rls_lockdown.sql's server-only model.
