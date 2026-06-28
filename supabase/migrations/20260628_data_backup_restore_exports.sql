create table if not exists public.data_import_logs (
  id uuid primary key default gen_random_uuid(),
  import_type text,
  file_name text,
  status text,
  summary jsonb default '{}'::jsonb,
  error_message text,
  created_by uuid nullable,
  created_at timestamptz default now()
);

create table if not exists public.data_export_logs (
  id uuid primary key default gen_random_uuid(),
  export_type text,
  format text,
  summary jsonb default '{}'::jsonb,
  created_by uuid nullable,
  created_at timestamptz default now()
);

create index if not exists data_import_logs_created_at_idx
  on public.data_import_logs(created_at desc);

create index if not exists data_export_logs_created_at_idx
  on public.data_export_logs(created_at desc);

create index if not exists data_import_logs_import_type_idx
  on public.data_import_logs(import_type);

create index if not exists data_export_logs_export_type_idx
  on public.data_export_logs(export_type);

notify pgrst, 'reload schema';
