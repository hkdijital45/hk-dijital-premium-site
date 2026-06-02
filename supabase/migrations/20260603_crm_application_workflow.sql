-- CRM application edit, reject and soft delete workflow.
alter table public.leads
  add column if not exists deleted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists status text default 'Yeni';

create index if not exists leads_deleted_at_idx on public.leads(deleted_at);
create index if not exists leads_rejected_at_idx on public.leads(rejected_at);
create index if not exists leads_status_workflow_idx on public.leads(status);
