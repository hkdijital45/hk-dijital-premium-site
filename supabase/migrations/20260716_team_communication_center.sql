-- Internal team communication center.
-- Isolated from customer_conversations to keep customer RLS and API responses separate.

create table if not exists public.team_conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  conversation_type text not null default 'general',
  company_id uuid references public.companies(id) on delete set null,
  branch_id uuid references public.customer_branches(id) on delete set null,
  related_entity_type text,
  related_entity_id uuid,
  source_customer_conversation_id uuid references public.customer_conversations(id) on delete set null,
  priority text not null default 'normal',
  status text not null default 'active',
  created_by uuid references public.users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_conversations_type_check check (conversation_type in ('direct', 'group', 'customer_operation', 'project', 'task', 'advertising', 'content', 'finance', 'sales', 'technical', 'announcement', 'general')),
  constraint team_conversations_priority_check check (priority in ('normal', 'important', 'urgent')),
  constraint team_conversations_status_check check (status in ('active', 'waiting', 'resolved', 'archived'))
);

create table if not exists public.team_conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.team_conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  added_by uuid references public.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_read_at timestamptz,
  muted_at timestamptz,
  archived_at timestamptz,
  constraint team_participants_role_check check (role in ('owner', 'moderator', 'member')),
  constraint team_participants_unique unique (conversation_id, user_id)
);

create table if not exists public.team_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.team_conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint team_messages_idempotency_unique unique (sender_id, idempotency_key)
);

create table if not exists public.team_message_reads (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.team_conversations(id) on delete cascade,
  message_id uuid not null references public.team_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  constraint team_message_reads_unique unique (message_id, user_id)
);

create table if not exists public.team_message_mentions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.team_conversations(id) on delete cascade,
  message_id uuid not null references public.team_messages(id) on delete cascade,
  mentioned_user_id uuid not null references public.users(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint team_message_mentions_unique unique (message_id, mentioned_user_id)
);

create table if not exists public.team_message_pins (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.team_conversations(id) on delete cascade,
  message_id uuid not null references public.team_messages(id) on delete cascade,
  pinned_by uuid references public.users(id) on delete set null,
  pinned_at timestamptz not null default now(),
  unpinned_at timestamptz,
  constraint team_message_pins_unique unique (message_id)
);

create table if not exists public.team_conversation_activity (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.team_conversations(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  activity_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.team_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.team_conversations(id) on delete cascade,
  message_id uuid references public.team_messages(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  storage_bucket text not null default 'communication-attachments',
  storage_path text not null,
  original_name text not null,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists team_conversations_last_message_idx on public.team_conversations(last_message_at desc);
create index if not exists team_conversations_company_idx on public.team_conversations(company_id);
create index if not exists team_conversations_source_customer_conversation_idx on public.team_conversations(source_customer_conversation_id);
create index if not exists team_conversation_participants_user_idx on public.team_conversation_participants(user_id, left_at);
create index if not exists team_messages_conversation_idx on public.team_messages(conversation_id, created_at);
create index if not exists team_message_reads_user_idx on public.team_message_reads(user_id, read_at);
create index if not exists team_message_mentions_user_idx on public.team_message_mentions(mentioned_user_id, created_at);
create index if not exists team_message_pins_conversation_idx on public.team_message_pins(conversation_id, unpinned_at);
create index if not exists team_conversation_activity_conversation_idx on public.team_conversation_activity(conversation_id, created_at desc);
create index if not exists team_attachments_message_idx on public.team_attachments(message_id);

drop trigger if exists set_team_conversations_updated_at on public.team_conversations;
create trigger set_team_conversations_updated_at before update on public.team_conversations
  for each row execute function public.set_updated_at();

create or replace function public.team_communication_actor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where auth_user_id = auth.uid()
    and is_active
    and deleted_at is null
    and role in ('admin', 'yonetici', 'editor', 'sales')
  limit 1
$$;

create or replace function public.team_communication_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where auth_user_id = auth.uid()
      and is_active
      and deleted_at is null
      and role in ('admin', 'yonetici', 'editor', 'sales')
  )
$$;

create or replace function public.team_communication_can_access(conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users actor
    where actor.auth_user_id = auth.uid()
      and actor.is_active
      and actor.deleted_at is null
      and actor.role in ('admin', 'yonetici')
  )
  or exists (
    select 1
    from public.team_conversation_participants participant
    join public.users actor on actor.id = participant.user_id
    where participant.conversation_id = conversation
      and participant.left_at is null
      and actor.auth_user_id = auth.uid()
      and actor.is_active
      and actor.deleted_at is null
      and actor.role in ('admin', 'yonetici', 'editor', 'sales')
  )
$$;

alter table public.team_conversations enable row level security;
alter table public.team_conversation_participants enable row level security;
alter table public.team_messages enable row level security;
alter table public.team_message_reads enable row level security;
alter table public.team_message_mentions enable row level security;
alter table public.team_message_pins enable row level security;
alter table public.team_conversation_activity enable row level security;
alter table public.team_attachments enable row level security;

drop policy if exists team_conversations_read on public.team_conversations;
create policy team_conversations_read on public.team_conversations for select using (public.team_communication_can_access(id));
drop policy if exists team_conversations_create on public.team_conversations;
create policy team_conversations_create on public.team_conversations for insert with check (created_by = public.team_communication_actor_id());
drop policy if exists team_conversations_update on public.team_conversations;
create policy team_conversations_update on public.team_conversations for update using (public.team_communication_can_access(id)) with check (public.team_communication_can_access(id));

drop policy if exists team_participants_read on public.team_conversation_participants;
create policy team_participants_read on public.team_conversation_participants for select using (public.team_communication_can_access(conversation_id));
drop policy if exists team_participants_create on public.team_conversation_participants;
create policy team_participants_create on public.team_conversation_participants for insert with check (public.team_communication_can_access(conversation_id));
drop policy if exists team_participants_update on public.team_conversation_participants;
create policy team_participants_update on public.team_conversation_participants for update using (public.team_communication_can_access(conversation_id)) with check (public.team_communication_can_access(conversation_id));

drop policy if exists team_messages_read on public.team_messages;
create policy team_messages_read on public.team_messages for select using (public.team_communication_can_access(conversation_id));
drop policy if exists team_messages_create on public.team_messages;
create policy team_messages_create on public.team_messages for insert with check (sender_id = public.team_communication_actor_id() and public.team_communication_can_access(conversation_id));

drop policy if exists team_reads_read on public.team_message_reads;
create policy team_reads_read on public.team_message_reads for select using (public.team_communication_can_access(conversation_id));
drop policy if exists team_reads_create on public.team_message_reads;
create policy team_reads_create on public.team_message_reads for insert with check (user_id = public.team_communication_actor_id() and public.team_communication_can_access(conversation_id));
drop policy if exists team_reads_update on public.team_message_reads;
create policy team_reads_update on public.team_message_reads for update using (user_id = public.team_communication_actor_id()) with check (user_id = public.team_communication_actor_id());

drop policy if exists team_mentions_read on public.team_message_mentions;
create policy team_mentions_read on public.team_message_mentions for select using (public.team_communication_can_access(conversation_id));
drop policy if exists team_mentions_create on public.team_message_mentions;
create policy team_mentions_create on public.team_message_mentions for insert with check (created_by = public.team_communication_actor_id() and public.team_communication_can_access(conversation_id));

drop policy if exists team_pins_read on public.team_message_pins;
create policy team_pins_read on public.team_message_pins for select using (public.team_communication_can_access(conversation_id));
drop policy if exists team_pins_create on public.team_message_pins;
create policy team_pins_create on public.team_message_pins for insert with check (public.team_communication_can_access(conversation_id));
drop policy if exists team_pins_update on public.team_message_pins;
create policy team_pins_update on public.team_message_pins for update using (public.team_communication_can_access(conversation_id)) with check (public.team_communication_can_access(conversation_id));

drop policy if exists team_activity_read on public.team_conversation_activity;
create policy team_activity_read on public.team_conversation_activity for select using (public.team_communication_can_access(conversation_id));
drop policy if exists team_activity_create on public.team_conversation_activity;
create policy team_activity_create on public.team_conversation_activity for insert with check (actor_id = public.team_communication_actor_id() and public.team_communication_can_access(conversation_id));

drop policy if exists team_attachments_read on public.team_attachments;
create policy team_attachments_read on public.team_attachments for select using (public.team_communication_can_access(conversation_id));
drop policy if exists team_attachments_create on public.team_attachments;
create policy team_attachments_create on public.team_attachments for insert with check (uploaded_by = public.team_communication_actor_id() and public.team_communication_can_access(conversation_id));

notify pgrst, 'reload schema';
