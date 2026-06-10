alter table if exists public.users
  add column if not exists is_active boolean default true,
  add column if not exists deleted_at timestamptz;

create index if not exists users_deleted_at_idx on public.users(deleted_at);
create index if not exists users_active_admin_idx on public.users(role, is_active) where deleted_at is null;
