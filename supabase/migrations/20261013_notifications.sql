-- Bildirim Merkezi (Notification Center) + iPhone Web Push infrastructure.
-- Broadcast design: an event that concerns multiple staff (e.g. "new lead
-- created") fans out to ONE admin_notifications row PER recipient at
-- creation time, rather than a single shared row with per-viewer read
-- state — this keeps "mark as read" and RLS ("a user only sees their own
-- notifications") simple and matches every other per-user table in this
-- codebase. Idempotency is enforced per (recipient, idempotency_key), not
-- globally, since the same logical event legitimately produces one row
-- per recipient.
create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id) where is_active;

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  push_enabled boolean not null default true,
  categories jsonb not null default '{"lead": true, "customer": true, "proposal": true, "campaign": true, "reminder": true, "system": true}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.users(id) on delete cascade,
  category text not null check (category in ('lead', 'customer', 'proposal', 'campaign', 'reminder', 'system')),
  title text not null,
  message text not null default '',
  related_type text,
  related_id uuid,
  deep_link text,
  idempotency_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),

  constraint admin_notifications_recipient_idempotency_unique unique (recipient_profile_id, idempotency_key)
);

create index if not exists admin_notifications_recipient_idx on public.admin_notifications (recipient_profile_id, created_at desc);
create index if not exists admin_notifications_unread_idx on public.admin_notifications (recipient_profile_id) where read_at is null;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  status text not null check (status in ('accepted', 'failed', 'skipped_preference', 'skipped_no_subscription')),
  error_category text,
  attempted_at timestamptz not null default timezone('utc', now())
);

create index if not exists notification_deliveries_notification_idx on public.notification_deliveries (notification_id);

alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;
create policy "Users manage their own push subscriptions" on public.push_subscriptions for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.id = push_subscriptions.user_id)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.id = push_subscriptions.user_id)
);

drop policy if exists "Users manage their own notification preferences" on public.notification_preferences;
create policy "Users manage their own notification preferences" on public.notification_preferences for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.id = notification_preferences.user_id)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.id = notification_preferences.user_id)
);

drop policy if exists "Users read and update their own notifications" on public.admin_notifications;
create policy "Users read and update their own notifications" on public.admin_notifications for select using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.id = admin_notifications.recipient_profile_id)
);
drop policy if exists "Users mark their own notifications read" on public.admin_notifications;
create policy "Users mark their own notifications read" on public.admin_notifications for update using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.id = admin_notifications.recipient_profile_id)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.id = admin_notifications.recipient_profile_id)
);
drop policy if exists "Staff can insert notifications" on public.admin_notifications;
create policy "Staff can insert notifications" on public.admin_notifications for insert with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can view delivery logs" on public.notification_deliveries;
create policy "Staff can view delivery logs" on public.notification_deliveries for select using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);
drop policy if exists "Staff can record delivery logs" on public.notification_deliveries;
create policy "Staff can record delivery logs" on public.notification_deliveries for insert with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
