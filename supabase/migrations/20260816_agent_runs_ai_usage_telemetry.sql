-- HK AI Smart Router (OpenAI Luna/Terra/Sol) usage telemetry.
--
-- agent_runs already captures selected_provider/tokens_used/response_ms for
-- every AI execution — this adds the small set of OpenAI-Responses-API-
-- specific fields it doesn't have yet, rather than creating a new table.
-- Additive/backward compatible only: nullable columns, no drops, no data
-- rewritten. Server-side writes only (createAgentRunLog uses the service
-- role key); no direct client insert privilege is granted by this
-- migration, matching the table's existing RLS model.
alter table public.agent_runs
  add column if not exists model text,
  add column if not exists reasoning_effort text,
  add column if not exists input_tokens integer,
  add column if not exists cached_input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists error_code text;

create index if not exists agent_runs_model_idx on public.agent_runs (model);
