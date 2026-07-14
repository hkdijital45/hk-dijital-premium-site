-- Customer Communication Center: tenant-safe conversations, messages and private attachments.

create table if not exists public.customer_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid references public.customer_branches(id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 160),
  category text not null default 'general' check (category in ('general', 'package_upgrade', 'advertising', 'report_question', 'content_revision', 'technical_support', 'finance', 'billing', 'new_service', 'account_access', 'other')),
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  status text not null default 'new' check (status in ('new', 'admin_reply_required', 'customer_reply_required', 'in_review', 'in_progress', 'resolved', 'closed', 'archived')),
  created_by uuid references public.users(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  source text not null default 'customer_portal',
  related_entity_type text,
  related_entity_id text,
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  archived_at timestamptz,
  customer_archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.customer_conversations(id) on delete cascade,
  sender_id uuid references public.users(id) on delete set null,
  sender_type text not null check (sender_type in ('customer', 'staff')),
  body text not null check (char_length(body) between 1 and 12000),
  idempotency_key text,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_reads (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.customer_conversations(id) on delete cascade,
  message_id uuid not null references public.customer_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.conversation_assignments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.customer_conversations(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  assigned_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_internal_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.customer_conversations(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 8000),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_activity (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.customer_conversations(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  activity_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.customer_conversations(id) on delete cascade,
  message_id uuid references public.customer_messages(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  storage_bucket text not null default 'communication-attachments',
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  created_at timestamptz not null default now()
);

create table if not exists public.communication_canned_responses (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  category text not null default 'general',
  body text not null check (char_length(body) between 1 and 8000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_conversations_company_idx on public.customer_conversations(company_id, last_message_at desc);
create index if not exists customer_conversations_branch_idx on public.customer_conversations(branch_id);
create index if not exists customer_conversations_status_idx on public.customer_conversations(status, priority, last_message_at desc);
create index if not exists customer_conversations_assigned_idx on public.customer_conversations(assigned_to, status);
create index if not exists customer_messages_conversation_idx on public.customer_messages(conversation_id, created_at);
create unique index if not exists customer_messages_idempotency_uidx on public.customer_messages(sender_id, idempotency_key) where idempotency_key is not null;
create index if not exists conversation_reads_user_idx on public.conversation_reads(user_id, conversation_id);
create index if not exists conversation_activity_conversation_idx on public.conversation_activity(conversation_id, created_at desc);
create index if not exists conversation_attachments_message_idx on public.conversation_attachments(message_id);

drop trigger if exists set_customer_conversations_updated_at on public.customer_conversations;
create trigger set_customer_conversations_updated_at before update on public.customer_conversations for each row execute function public.set_updated_at();
drop trigger if exists set_communication_canned_responses_updated_at on public.communication_canned_responses;
create trigger set_communication_canned_responses_updated_at before update on public.communication_canned_responses for each row execute function public.set_updated_at();

insert into public.communication_canned_responses (title, category, body, sort_order)
values
  ('Talebiniz alındı', 'general', 'Talebinizi aldık. İlgili ekip arkadaşımız inceleyerek bu konuşma üzerinden dönüş sağlayacak.', 10),
  ('Ek bilgi gerekli', 'technical_support', 'İncelemeyi tamamlayabilmemiz için konuya ilişkin ekran görüntüsü veya ek ayrıntı paylaşabilir misiniz?', 20),
  ('Rapor incelemesi', 'report_question', 'Rapor talebinizi incelemeye aldık. Bulguları ve önerilen aksiyonları bu konuşma üzerinden paylaşacağız.', 30),
  ('Çözüm teyidi', 'general', 'Gerekli düzenlemeyi tamamladık. Uygun olduğunuzda sonucu kontrol edip bize bilgi verebilir misiniz?', 40)
on conflict (title) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'communication-attachments',
  'communication-attachments',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.communication_actor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users
  where auth_user_id = auth.uid() and is_active and deleted_at is null
  limit 1
$$;

create or replace function public.communication_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where auth_user_id = auth.uid()
      and is_active and deleted_at is null
      and role in ('admin', 'yonetici', 'editor', 'sales')
  )
$$;

create or replace function public.communication_can_access(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.communication_is_staff() or exists (
    select 1
    from public.customer_conversations c
    join public.users actor on actor.auth_user_id = auth.uid()
    where c.id = p_conversation_id
      and actor.is_active and actor.deleted_at is null
      and actor.role in ('musteri', 'customer')
      and actor.company_id = c.company_id
      and (
        c.branch_id is null
        or actor.branch_access_mode = 'all'
        or exists (
          select 1 from public.customer_user_branches access
          where access.user_id = actor.id
            and access.company_id = c.company_id
            and access.branch_id = c.branch_id
        )
      )
  )
$$;

revoke all on function public.communication_actor_id() from public;
revoke all on function public.communication_is_staff() from public;
revoke all on function public.communication_can_access(uuid) from public;
grant execute on function public.communication_actor_id() to authenticated, service_role;
grant execute on function public.communication_is_staff() to authenticated, service_role;
grant execute on function public.communication_can_access(uuid) to authenticated, service_role;

alter table public.customer_conversations enable row level security;
alter table public.customer_messages enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.conversation_assignments enable row level security;
alter table public.conversation_internal_notes enable row level security;
alter table public.conversation_activity enable row level security;
alter table public.conversation_attachments enable row level security;
alter table public.communication_canned_responses enable row level security;

drop policy if exists customer_conversations_read on public.customer_conversations;
create policy customer_conversations_read on public.customer_conversations for select using (public.communication_can_access(id));
drop policy if exists customer_conversations_customer_create on public.customer_conversations;
create policy customer_conversations_customer_create on public.customer_conversations for insert with check (
  created_by = public.communication_actor_id()
  and exists (
    select 1 from public.users actor
    where actor.id = created_by and actor.company_id = customer_conversations.company_id
      and actor.role in ('musteri', 'customer')
      and (customer_conversations.branch_id is null or actor.branch_access_mode = 'all' or exists (
        select 1 from public.customer_user_branches access
        where access.user_id = actor.id and access.company_id = customer_conversations.company_id and access.branch_id = customer_conversations.branch_id
      ))
  )
);
drop policy if exists customer_conversations_staff_manage on public.customer_conversations;
create policy customer_conversations_staff_manage on public.customer_conversations for all using (public.communication_is_staff()) with check (public.communication_is_staff());

drop policy if exists customer_messages_read on public.customer_messages;
create policy customer_messages_read on public.customer_messages for select using (deleted_at is null and public.communication_can_access(conversation_id));
drop policy if exists customer_messages_create on public.customer_messages;
create policy customer_messages_create on public.customer_messages for insert with check (
  public.communication_can_access(conversation_id)
  and sender_id = public.communication_actor_id()
  and ((public.communication_is_staff() and sender_type = 'staff') or (not public.communication_is_staff() and sender_type = 'customer'))
);

drop policy if exists conversation_reads_own on public.conversation_reads;
create policy conversation_reads_own on public.conversation_reads for all using (user_id = public.communication_actor_id() and public.communication_can_access(conversation_id)) with check (user_id = public.communication_actor_id() and public.communication_can_access(conversation_id));

drop policy if exists conversation_assignments_staff on public.conversation_assignments;
create policy conversation_assignments_staff on public.conversation_assignments for all using (public.communication_is_staff()) with check (public.communication_is_staff());
drop policy if exists conversation_notes_staff on public.conversation_internal_notes;
create policy conversation_notes_staff on public.conversation_internal_notes for all using (public.communication_is_staff()) with check (public.communication_is_staff());
drop policy if exists conversation_activity_staff on public.conversation_activity;
create policy conversation_activity_staff on public.conversation_activity for select using (public.communication_is_staff());
drop policy if exists conversation_activity_staff_create on public.conversation_activity;
create policy conversation_activity_staff_create on public.conversation_activity for insert with check (public.communication_is_staff());

drop policy if exists conversation_attachments_read on public.conversation_attachments;
create policy conversation_attachments_read on public.conversation_attachments for select using (public.communication_can_access(conversation_id));
drop policy if exists conversation_attachments_create on public.conversation_attachments;
create policy conversation_attachments_create on public.conversation_attachments for insert with check (uploaded_by = public.communication_actor_id() and public.communication_can_access(conversation_id));

drop policy if exists communication_canned_responses_staff_read on public.communication_canned_responses;
create policy communication_canned_responses_staff_read on public.communication_canned_responses for select using (public.communication_is_staff());
drop policy if exists communication_canned_responses_admin_manage on public.communication_canned_responses;
create policy communication_canned_responses_admin_manage on public.communication_canned_responses for all using (
  exists (select 1 from public.users where auth_user_id = auth.uid() and is_active and deleted_at is null and role in ('admin', 'yonetici'))
) with check (
  exists (select 1 from public.users where auth_user_id = auth.uid() and is_active and deleted_at is null and role in ('admin', 'yonetici'))
);

drop policy if exists communication_storage_read on storage.objects;
create policy communication_storage_read on storage.objects for select using (
  bucket_id = 'communication-attachments'
  and exists (
    select 1 from public.conversation_attachments attachment
    where attachment.storage_path = name
      and public.communication_can_access(attachment.conversation_id)
  )
);
