alter table if exists public.agency_tasks
  add column if not exists description text;

alter table if exists public.activity_logs
  add column if not exists status text not null default 'Görülmedi',
  add column if not exists is_seen boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists is_critical boolean not null default false,
  add column if not exists module text,
  add column if not exists action_type text,
  add column if not exists old_value jsonb,
  add column if not exists new_value jsonb,
  add column if not exists updated_at timestamptz;

create index if not exists agency_tasks_company_id_idx on public.agency_tasks(company_id);
create index if not exists agency_tasks_due_date_idx on public.agency_tasks(due_date);
create index if not exists payment_records_company_id_idx on public.payment_records(company_id);
create index if not exists payment_records_due_date_idx on public.payment_records(due_date);
create index if not exists payment_records_status_idx on public.payment_records(status);
create index if not exists activity_logs_deleted_at_idx on public.activity_logs(deleted_at);
create index if not exists activity_logs_archived_at_idx on public.activity_logs(archived_at);
create index if not exists activity_logs_status_idx on public.activity_logs(status);
create index if not exists activity_logs_module_idx on public.activity_logs(module);
create index if not exists activity_logs_action_type_idx on public.activity_logs(action_type);
create index if not exists activity_logs_is_critical_idx on public.activity_logs(is_critical);
