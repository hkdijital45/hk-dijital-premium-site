-- Secret Access Control Center: a hidden pre-authentication gate in front of
-- /digital-center, /hk-admin and /musteri-paneli. This is a SEPARATE layer
-- in front of the existing hk_auth_session login system, not a replacement
-- for it — role/module authorization continues to work exactly as before.
--
-- RLS follows the same server-only model as 20260719_rls_lockdown.sql: this
-- app never queries Supabase directly from the browser, so anon/authenticated
-- get NO policies (default-deny once RLS is enabled); service_role bypasses
-- RLS and is the only caller (via Next.js server code / edge middleware).
--
-- Delete behavior is designed to never lose audit history: keys are only
-- ever soft-archived (archived_at), never hard-deleted, so
-- hidden_access_sessions.key_id and hidden_access_logs.key_id/session_id
-- stay valid indefinitely. Foreign keys use `on delete set null` rather than
-- cascade, so even in the hypothetical case a key row is removed, existing
-- session/log rows are preserved for audit purposes rather than vanishing.

create table if not exists public.hidden_access_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  secret_hash text not null,
  is_active boolean not null default true,
  expires_at timestamptz,
  usage_count integer not null default 0,
  last_used_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists hidden_access_keys_is_active_idx on public.hidden_access_keys(is_active) where archived_at is null;

create table if not exists public.hidden_access_sessions (
  id uuid primary key default gen_random_uuid(),
  key_id uuid references public.hidden_access_keys(id) on delete set null,
  session_token_hash text not null unique,
  device_id text,
  device_name text,
  ip_address text,
  user_agent text,
  device_type text,
  operating_system text,
  browser text,
  trigger_method text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  authenticated_user_id uuid references public.users(id) on delete set null,
  authenticated_at timestamptz
);

create index if not exists hidden_access_sessions_token_hash_idx on public.hidden_access_sessions(session_token_hash);
create index if not exists hidden_access_sessions_key_id_idx on public.hidden_access_sessions(key_id);
create index if not exists hidden_access_sessions_expires_at_idx on public.hidden_access_sessions(expires_at);

create table if not exists public.hidden_access_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  key_id uuid references public.hidden_access_keys(id) on delete set null,
  session_id uuid references public.hidden_access_sessions(id) on delete set null,
  authenticated_user_id uuid references public.users(id) on delete set null,
  ip_address text,
  user_agent text,
  device_type text,
  operating_system text,
  browser text,
  device_id text,
  device_name text,
  trigger_method text,
  reason_code text,
  created_at timestamptz not null default now()
);

create index if not exists hidden_access_logs_created_at_idx on public.hidden_access_logs(created_at desc);
create index if not exists hidden_access_logs_key_id_idx on public.hidden_access_logs(key_id);
create index if not exists hidden_access_logs_ip_address_idx on public.hidden_access_logs(ip_address);
create index if not exists hidden_access_logs_event_type_idx on public.hidden_access_logs(event_type);

alter table public.hidden_access_keys enable row level security;
alter table public.hidden_access_sessions enable row level security;
alter table public.hidden_access_logs enable row level security;

comment on table public.hidden_access_keys is 'Secret Access Control Center: named access keys gating /digital-center, /hk-admin, /musteri-paneli ahead of normal login. RLS: server-only (service_role), no anon/authenticated policies by design.';
comment on table public.hidden_access_sessions is 'Secret Access Control Center: 1-hour gate sessions. session_token_hash is a SHA-256 hash of the opaque bearer token stored in the HttpOnly cookie — the raw token is never persisted.';
comment on table public.hidden_access_logs is 'Secret Access Control Center: audit trail for every verification attempt (success/failed/blocked) and session lifecycle event. Never stores the attempted secret or its hash.';

notify pgrst, 'reload schema';
