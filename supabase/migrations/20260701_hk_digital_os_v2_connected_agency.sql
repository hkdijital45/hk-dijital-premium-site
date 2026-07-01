create table if not exists public.agency_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  branch_id uuid references public.customer_branches(id) on delete set null,
  notification_type text not null,
  title text not null,
  message text,
  priority text default 'normal',
  source_module text,
  source_entity_type text,
  source_entity_id uuid,
  action_url text,
  is_read boolean default false,
  archived_at timestamptz,
  show_to_customer boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists agency_notifications_company_idx on public.agency_notifications(company_id);
create index if not exists agency_notifications_branch_idx on public.agency_notifications(branch_id);
create index if not exists agency_notifications_type_idx on public.agency_notifications(notification_type);
create index if not exists agency_notifications_priority_idx on public.agency_notifications(priority);
create index if not exists agency_notifications_read_idx on public.agency_notifications(is_read);
create index if not exists agency_notifications_archived_idx on public.agency_notifications(archived_at);
create index if not exists agency_notifications_customer_visible_idx on public.agency_notifications(show_to_customer);
create index if not exists agency_notifications_created_at_idx on public.agency_notifications(created_at desc);
create index if not exists agency_notifications_source_idx on public.agency_notifications(source_module, source_entity_type);

alter table public.agency_notifications enable row level security;
