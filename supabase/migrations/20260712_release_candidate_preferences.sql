-- Per-user admin UI preferences for favorites and dashboard visibility.
create table if not exists public.admin_user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  favorite_modules jsonb not null default '[]'::jsonb,
  dashboard_widgets jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_user_preferences_user_key unique (user_id),
  constraint admin_user_preferences_favorites_array_check
    check (jsonb_typeof(favorite_modules) = 'array'),
  constraint admin_user_preferences_widgets_object_check
    check (jsonb_typeof(dashboard_widgets) = 'object')
);

create index if not exists admin_user_preferences_user_id_idx
  on public.admin_user_preferences(user_id);

drop trigger if exists set_admin_user_preferences_updated_at on public.admin_user_preferences;
create trigger set_admin_user_preferences_updated_at
before update on public.admin_user_preferences
for each row execute function public.set_updated_at();

alter table public.admin_user_preferences enable row level security;

drop policy if exists admin_user_preferences_own_read on public.admin_user_preferences;
create policy admin_user_preferences_own_read
on public.admin_user_preferences
for select
using (
  exists (
    select 1 from public.users actor
    where actor.id = admin_user_preferences.user_id
      and actor.auth_user_id = auth.uid()
      and actor.is_active
      and actor.deleted_at is null
  )
);

drop policy if exists admin_user_preferences_own_update on public.admin_user_preferences;
create policy admin_user_preferences_own_update
on public.admin_user_preferences
for update
using (
  exists (
    select 1 from public.users actor
    where actor.id = admin_user_preferences.user_id
      and actor.auth_user_id = auth.uid()
      and actor.is_active
      and actor.deleted_at is null
  )
)
with check (
  exists (
    select 1 from public.users actor
    where actor.id = admin_user_preferences.user_id
      and actor.auth_user_id = auth.uid()
      and actor.is_active
      and actor.deleted_at is null
  )
);

comment on table public.admin_user_preferences is
  'User-specific admin favorites and dashboard visibility preferences.';

notify pgrst, 'reload schema';
