alter table if exists public.agency_tasks
  add column if not exists completed_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table if exists public.payment_records
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists cancelled_at timestamptz;

create index if not exists agency_tasks_status_idx on public.agency_tasks(status);
create index if not exists agency_tasks_completed_at_idx on public.agency_tasks(completed_at);
create index if not exists agency_tasks_archived_at_idx on public.agency_tasks(archived_at);
create index if not exists agency_tasks_deleted_at_idx on public.agency_tasks(deleted_at);
create index if not exists agency_tasks_cancelled_at_idx on public.agency_tasks(cancelled_at);

create index if not exists payment_records_archived_at_idx on public.payment_records(archived_at);
create index if not exists payment_records_deleted_at_idx on public.payment_records(deleted_at);
create index if not exists payment_records_cancelled_at_idx on public.payment_records(cancelled_at);
