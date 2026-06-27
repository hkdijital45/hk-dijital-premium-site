alter table public.agent_runs
  add column if not exists actual_provider text,
  add column if not exists provider_mode text,
  add column if not exists provider_error text,
  add column if not exists provider_health_snapshot jsonb default '{}'::jsonb,
  add column if not exists router_decision jsonb default '{}'::jsonb;

alter table public.agent_runs
  add column if not exists requested_provider text;

create index if not exists agent_runs_actual_provider_idx
  on public.agent_runs(actual_provider);

create index if not exists agent_runs_requested_provider_idx
  on public.agent_runs(requested_provider);

notify pgrst, 'reload schema';
