-- Analysis result CRM saving workflow.
alter table public.leads
  add column if not exists city text,
  add column if not exists district text,
  add column if not exists sector text,
  add column if not exists source_url text;

create index if not exists leads_source_idx on public.leads(source);
