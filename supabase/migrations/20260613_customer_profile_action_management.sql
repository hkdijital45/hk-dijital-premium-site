-- Customer profile action management support.
-- Adds safe archive/delete/status metadata to customer-facing records.

alter table if exists public.customer_documents
  add column if not exists status text default 'Aktif',
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table if exists public.customer_files
  add column if not exists status text default 'Aktif',
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table if exists public.reports
  add column if not exists status text default 'Taslak',
  add column if not exists ai_interpretation text,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

do $$
begin
  if to_regclass('public.customer_documents') is not null then
    create index if not exists customer_documents_status_idx on public.customer_documents(status);
    create index if not exists customer_documents_archived_at_idx on public.customer_documents(archived_at);
    create index if not exists customer_documents_deleted_at_idx on public.customer_documents(deleted_at);
  end if;

  if to_regclass('public.customer_files') is not null then
    create index if not exists customer_files_status_idx on public.customer_files(status);
    create index if not exists customer_files_archived_at_idx on public.customer_files(archived_at);
    create index if not exists customer_files_deleted_at_idx on public.customer_files(deleted_at);
  end if;

  if to_regclass('public.reports') is not null then
    create index if not exists reports_status_idx on public.reports(status);
    create index if not exists reports_archived_at_idx on public.reports(archived_at);
    create index if not exists reports_deleted_at_idx on public.reports(deleted_at);
  end if;
end $$;
