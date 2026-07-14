-- Optional username login identity for public user profiles.
alter table public.users
  add column if not exists username text;

update public.users
set username = null
where username is not null and btrim(username) = '';

create unique index if not exists users_username_lower_uidx
  on public.users (lower(username))
  where username is not null;

alter table public.users
  drop constraint if exists users_username_format_check;

alter table public.users
  add constraint users_username_format_check
  check (
    username is null
    or username ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  );

comment on column public.users.username is
  'Optional case-insensitive login name; authentication still resolves to the existing Supabase Auth email server-side.';

notify pgrst, 'reload schema';
