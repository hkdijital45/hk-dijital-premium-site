-- Customer lifecycle status fields for archive, soft delete and active/passive management.
alter table if exists public.companies
  add column if not exists is_active boolean default true,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz default now();

update public.companies
set is_active = false
where lower(coalesce(status, '')) in ('pasif', 'inactive', 'arşivli', 'arsivli', 'silindi')
  and is_active is distinct from false;

create index if not exists companies_archived_at_idx on public.companies(archived_at);
create index if not exists companies_deleted_at_idx on public.companies(deleted_at);
create index if not exists companies_status_idx on public.companies(status);
create index if not exists companies_is_active_idx on public.companies(is_active);

comment on column public.companies.archived_at is 'Soft archive timestamp for customer records.';
comment on column public.companies.deleted_at is 'Soft delete timestamp for customer records; records are not hard-deleted.';
comment on column public.companies.is_active is 'Administrative active/passive customer flag.';

notify pgrst, 'reload schema';
