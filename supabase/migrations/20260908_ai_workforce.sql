-- HK AI Workforce — additive schema only.
--
-- This deliberately does NOT create a new agent roster, task table, memory
-- table, or cost ledger: hk_virtual_agents, agency_tasks, agent_memories,
-- agent_scheduled_tasks and agent_runs (with its existing cost/token
-- telemetry columns) already cover those. This migration adds exactly the
-- two pieces that were genuinely missing:
--   1. agent_key on agent_runs, so a run can be attributed to one of the
--      named hk_virtual_agents roster entries (needed to show "last run" /
--      success-rate per agent instead of only per task-type/provider).
--   2. ai_approval_requests + ai_activity_log, the human-in-the-loop and
--      audit-trail layer that did not exist anywhere in the codebase.
-- Idempotent and non-destructive, following the project convention (see
-- 20260629_hk_intelligence_autonomous_os.sql, 20260719_rls_lockdown.sql).

alter table public.agent_runs
  add column if not exists agent_key text references public.hk_virtual_agents(agent_key) on delete set null;

create index if not exists agent_runs_agent_key_idx on public.agent_runs(agent_key);

create table if not exists public.ai_approval_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  action_type text not null default 'internal_write'
    check (action_type in ('read', 'suggest', 'draft', 'internal_write', 'external_write', 'destructive')),
  risk_level text not null default 'low'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  agent_key text references public.hk_virtual_agents(agent_key) on delete set null,
  company_id uuid references public.companies(id) on delete cascade,
  source_type text not null default 'manual'
    check (source_type in ('agent_run', 'recommendation', 'risk', 'manual')),
  source_id uuid,
  proposed_change jsonb default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  decision_note text,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  execution_status text not null default 'pending'
    check (execution_status in ('not_applicable', 'pending', 'executed', 'execution_unavailable')),
  expires_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists ai_approval_requests_status_idx on public.ai_approval_requests(status, created_at desc);
create index if not exists ai_approval_requests_company_idx on public.ai_approval_requests(company_id);

create table if not exists public.ai_activity_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  summary text not null,
  agent_key text references public.hk_virtual_agents(agent_key) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  run_id uuid references public.agent_runs(id) on delete set null,
  approval_id uuid references public.ai_approval_requests(id) on delete set null,
  task_id uuid references public.agency_tasks(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists ai_activity_log_created_idx on public.ai_activity_log(created_at desc);
create index if not exists ai_activity_log_company_idx on public.ai_activity_log(company_id);

-- Server-only access model (see 20260719_rls_lockdown.sql): enable RLS with
-- zero policies for anon/authenticated so both are denied by default.
-- service_role (used by all Next.js server code) bypasses RLS regardless.
alter table public.ai_approval_requests enable row level security;
alter table public.ai_activity_log enable row level security;
