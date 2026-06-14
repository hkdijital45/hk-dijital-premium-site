alter table if exists public.ad_integrations
  add column if not exists app_id text,
  add column if not exists system_user_id text,
  add column if not exists mcc_id text,
  add column if not exists client_id text,
  add column if not exists client_secret_encrypted text,
  add column if not exists developer_token_encrypted text,
  add column if not exists settings jsonb default '{}'::jsonb;

create table if not exists public.integration_sync_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('meta', 'google')),
  company_id uuid references public.companies(id) on delete set null,
  integration_id uuid references public.ad_integrations(id) on delete set null,
  source text,
  result text not null default 'Uyarı',
  message text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists integration_sync_logs_provider_created_idx on public.integration_sync_logs(provider, created_at desc);
create index if not exists integration_sync_logs_company_idx on public.integration_sync_logs(company_id, created_at desc);

alter table public.integration_sync_logs enable row level security;
