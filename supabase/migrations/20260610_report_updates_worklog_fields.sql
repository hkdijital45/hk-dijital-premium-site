alter table public.report_updates
  add column if not exists category text,
  add column if not exists status text;
