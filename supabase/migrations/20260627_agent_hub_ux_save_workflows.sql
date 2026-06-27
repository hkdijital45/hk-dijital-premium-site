-- HK Agent Hub UX save workflow fields.

alter table if exists public.agent_runs
  add column if not exists saved_at timestamptz,
  add column if not exists saved_by uuid,
  add column if not exists saved_title text;

create index if not exists agent_runs_saved_at_idx on public.agent_runs(saved_at);

notify pgrst, 'reload schema';
