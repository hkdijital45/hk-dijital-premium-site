-- Additive academy tables. Application uses existing Supabase Auth profiles.
-- RLS denies browser Data API access; each Next.js request verifies membership.
begin;
create table if not exists public.academy_memberships (
 user_id uuid primary key references public.users(id) on delete cascade,
 role text not null check (role in ('academy_admin','academy_user')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.academy_learning_state (
 user_id uuid not null references public.academy_memberships(user_id) on delete cascade,
 content_id text not null check (length(content_id) between 1 and 120),
 kind text not null check (kind in ('progress','draft','submission','result','assessment','review','note','bookmark','attempt','simulation')),
 value jsonb not null default '{}'::jsonb check (jsonb_typeof(value)='object'),
 updated_at timestamptz not null default now(),
 primary key(user_id,content_id,kind)
);
alter table public.academy_memberships enable row level security;
alter table public.academy_learning_state enable row level security;
revoke all on public.academy_memberships,public.academy_learning_state from public,anon,authenticated;
grant select,insert,update,delete on public.academy_memberships,public.academy_learning_state to service_role;
create index if not exists academy_state_user_updated_idx on public.academy_learning_state(user_id,updated_at desc);
commit;
-- Rollback: export both tables first; remove application deployment before
-- dropping academy_learning_state, then academy_memberships. Do not cascade
-- drops into existing users/auth tables. No existing profile role is changed.
-- Enrollment is explicit: no public signup and no automatic admin enrollment.
