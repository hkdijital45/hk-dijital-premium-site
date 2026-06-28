alter table if exists public.data_import_logs
  add column if not exists created_by uuid;

alter table if exists public.data_export_logs
  add column if not exists created_by uuid;

notify pgrst, 'reload schema';
