-- Native desktop admin application sync support.
-- Stores registered devices, sync logs and safe offline draft records.

create table if not exists public.desktop_sync_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  device_name text not null,
  client_id text not null unique,
  app_version text,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists desktop_sync_devices_user_id_idx on public.desktop_sync_devices(user_id);
create index if not exists desktop_sync_devices_client_id_idx on public.desktop_sync_devices(client_id);
create index if not exists desktop_sync_devices_last_seen_at_idx on public.desktop_sync_devices(last_seen_at);

create table if not exists public.desktop_sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  device_id uuid references public.desktop_sync_devices(id) on delete set null,
  direction text not null check (direction in ('pull', 'push', 'sync', 'local')),
  entity_type text not null,
  entity_id text,
  status text not null,
  message text,
  created_at timestamptz default now()
);

create index if not exists desktop_sync_log_user_id_idx on public.desktop_sync_log(user_id);
create index if not exists desktop_sync_log_device_id_idx on public.desktop_sync_log(device_id);
create index if not exists desktop_sync_log_created_at_idx on public.desktop_sync_log(created_at);

create table if not exists public.desktop_local_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  customer_id uuid references public.companies(id) on delete set null,
  draft_type text not null check (draft_type in (
    'customer_note',
    'task',
    'proposal_draft',
    'report_draft',
    'ad_comment_draft',
    'package_price_note',
    'admin_note'
  )),
  title text not null,
  content jsonb not null default '{}'::jsonb,
  sync_status text not null default 'synced',
  conflict_status text not null default 'none',
  source text not null default 'macos_desktop',
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists desktop_local_drafts_user_id_idx on public.desktop_local_drafts(user_id);
create index if not exists desktop_local_drafts_customer_id_idx on public.desktop_local_drafts(customer_id);
create index if not exists desktop_local_drafts_draft_type_idx on public.desktop_local_drafts(draft_type);
create index if not exists desktop_local_drafts_updated_at_idx on public.desktop_local_drafts(updated_at);

alter table public.desktop_sync_devices enable row level security;
alter table public.desktop_sync_log enable row level security;
alter table public.desktop_local_drafts enable row level security;

drop policy if exists desktop_sync_devices_owner_select on public.desktop_sync_devices;
create policy desktop_sync_devices_owner_select on public.desktop_sync_devices
  for select using (
    exists (
      select 1 from public.users u
      where u.id = desktop_sync_devices.user_id
        and u.auth_user_id = auth.uid()
        and u.role in ('admin', 'yonetici', 'editor', 'sales')
    )
  );

drop policy if exists desktop_sync_log_owner_select on public.desktop_sync_log;
create policy desktop_sync_log_owner_select on public.desktop_sync_log
  for select using (
    exists (
      select 1 from public.users u
      where u.id = desktop_sync_log.user_id
        and u.auth_user_id = auth.uid()
        and u.role in ('admin', 'yonetici', 'editor', 'sales')
    )
  );

drop policy if exists desktop_local_drafts_owner_select on public.desktop_local_drafts;
create policy desktop_local_drafts_owner_select on public.desktop_local_drafts
  for select using (
    exists (
      select 1 from public.users u
      where u.id = desktop_local_drafts.user_id
        and u.auth_user_id = auth.uid()
        and u.role in ('admin', 'yonetici', 'editor', 'sales')
    )
  );
