create extension if not exists "pgcrypto";

create table if not exists public.ad_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  account_name text,
  account_id text,
  pixel_id text,
  dataset_id text,
  conversion_api_token_encrypted text,
  test_event_code text,
  capi_enabled boolean not null default false,
  pixel_enabled boolean not null default false,
  pixel_status text,
  capi_status text,
  last_pixel_test_at timestamptz,
  last_capi_test_at timestamptz,
  last_event_at timestamptz,
  last_sync_at timestamptz,
  sync_message text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, provider)
);

alter table if exists public.ad_integrations
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists provider text,
  add column if not exists account_name text,
  add column if not exists account_id text,
  add column if not exists pixel_id text,
  add column if not exists dataset_id text,
  add column if not exists conversion_api_token_encrypted text,
  add column if not exists test_event_code text,
  add column if not exists capi_enabled boolean not null default false,
  add column if not exists pixel_enabled boolean not null default false,
  add column if not exists pixel_status text,
  add column if not exists capi_status text,
  add column if not exists last_pixel_test_at timestamptz,
  add column if not exists last_capi_test_at timestamptz,
  add column if not exists last_event_at timestamptz,
  add column if not exists last_sync_at timestamptz,
  add column if not exists sync_message text,
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists ad_integrations_company_provider_uidx
  on public.ad_integrations(company_id, provider);
create index if not exists ad_integrations_company_idx
  on public.ad_integrations(company_id);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  amount numeric not null default 0,
  status text not null default 'Bekliyor',
  due_date date,
  payment_date date,
  service_period text,
  description text,
  pdf_url text,
  visible_to_customer boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists payment_records_company_status_idx
  on public.payment_records(company_id, status);
create index if not exists payment_records_due_date_idx
  on public.payment_records(due_date);

create table if not exists public.agency_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'Yapılacak',
  priority text not null default 'Normal',
  due_date date,
  assigned_user_id uuid references public.users(id) on delete set null,
  visible_to_customer boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists agency_tasks_company_status_idx
  on public.agency_tasks(company_id, status);
create index if not exists agency_tasks_due_date_idx
  on public.agency_tasks(due_date);

create table if not exists public.integration_sync_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  provider text not null,
  source text,
  result text not null,
  message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists integration_sync_logs_company_provider_idx
  on public.integration_sync_logs(company_id, provider, created_at desc);

alter table if exists public.customer_visibility_settings
  add column if not exists show_payments boolean not null default true,
  add column if not exists show_tasks boolean not null default false,
  add column if not exists show_meta_status boolean not null default false;

drop trigger if exists set_ad_integrations_updated_at on public.ad_integrations;
create trigger set_ad_integrations_updated_at before update on public.ad_integrations
for each row execute function public.set_updated_at();

drop trigger if exists set_payment_records_updated_at on public.payment_records;
create trigger set_payment_records_updated_at before update on public.payment_records
for each row execute function public.set_updated_at();

drop trigger if exists set_agency_tasks_updated_at on public.agency_tasks;
create trigger set_agency_tasks_updated_at before update on public.agency_tasks
for each row execute function public.set_updated_at();

alter table public.ad_integrations enable row level security;
alter table public.payment_records enable row level security;
alter table public.agency_tasks enable row level security;
alter table public.integration_sync_logs enable row level security;
