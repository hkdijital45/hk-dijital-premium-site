-- HK AI Smart Router Gemini migration: Gemini reports a distinct "thoughts"
-- token count (usageMetadata.thoughtsTokenCount) that the existing
-- input/cached/output token columns (added in
-- 20260816_agent_runs_ai_usage_telemetry.sql) don't represent. Everything
-- else telemetry needs already exists on agent_runs — in particular
-- provider identity is already captured by the existing
-- selected_provider/actual_provider columns, so no new "provider" column is
-- added here (avoids a duplicate column).
--
-- Additive/backward compatible only: one nullable column, no drops, no data
-- rewritten. Server-side writes only (createAgentRunLog uses the service
-- role key); no direct client insert privilege is granted by this
-- migration, matching the table's existing RLS model.
alter table public.agent_runs
  add column if not exists thinking_tokens integer;
