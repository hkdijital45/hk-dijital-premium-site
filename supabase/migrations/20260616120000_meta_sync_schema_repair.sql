create table if not exists public.campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  company_id uuid references public.companies(id) on delete cascade,
  meta_campaign_id text,
  campaign_name text,
  source text default 'Manuel',
  date date default current_date,
  period text,
  impressions numeric default 0,
  reach numeric default 0,
  clicks numeric default 0,
  spend numeric default 0,
  spent numeric default 0,
  cpc numeric default 0,
  cpm numeric default 0,
  ctr numeric default 0,
  leads numeric default 0,
  results numeric default 0,
  messages numeric default 0,
  conversions numeric default 0,
  cost_per_lead numeric default 0,
  visible_to_customer boolean default true,
  raw_data jsonb default '{}'::jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ad_integrations (
  id uuid primary key default gen_random_uuid(),
  provider text,
  company_id uuid references public.companies(id) on delete cascade,
  account_name text,
  account_id text,
  ad_account_id text,
  business_account_id text,
  business_id text,
  page_id text,
  instagram_account_id text,
  google_customer_id text,
  google_analytics_id text,
  mcc_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  auto_sync boolean default false,
  status text default 'Eksik bilgi',
  last_sync_at timestamptz,
  sync_status text,
  sync_message text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists public.campaign_metrics
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists meta_campaign_id text,
  add column if not exists campaign_name text,
  add column if not exists source text default 'Manuel',
  add column if not exists date date default current_date,
  add column if not exists period text,
  add column if not exists impressions numeric default 0,
  add column if not exists reach numeric default 0,
  add column if not exists clicks numeric default 0,
  add column if not exists spend numeric default 0,
  add column if not exists spent numeric default 0,
  add column if not exists cpc numeric default 0,
  add column if not exists cpm numeric default 0,
  add column if not exists ctr numeric default 0,
  add column if not exists leads numeric default 0,
  add column if not exists results numeric default 0,
  add column if not exists messages numeric default 0,
  add column if not exists conversions numeric default 0,
  add column if not exists cost_per_lead numeric default 0,
  add column if not exists visible_to_customer boolean default true,
  add column if not exists raw_data jsonb default '{}'::jsonb,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.ad_integrations
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists provider text,
  add column if not exists account_name text,
  add column if not exists account_id text,
  add column if not exists ad_account_id text,
  add column if not exists business_account_id text,
  add column if not exists business_id text,
  add column if not exists page_id text,
  add column if not exists instagram_account_id text,
  add column if not exists google_customer_id text,
  add column if not exists google_analytics_id text,
  add column if not exists mcc_id text,
  add column if not exists status text default 'Eksik bilgi',
  add column if not exists last_sync_at timestamptz,
  add column if not exists sync_status text,
  add column if not exists sync_message text,
  add column if not exists settings jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.integration_sync_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  company_id uuid references public.companies(id) on delete set null,
  integration_id uuid references public.ad_integrations(id) on delete set null,
  source text,
  result text not null default 'Uyarı',
  message text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table if exists public.integration_sync_logs
  add column if not exists provider text,
  add column if not exists company_id uuid references public.companies(id) on delete set null,
  add column if not exists integration_id uuid references public.ad_integrations(id) on delete set null,
  add column if not exists source text,
  add column if not exists result text default 'Uyarı',
  add column if not exists message text,
  add column if not exists details jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

create index if not exists campaign_metrics_company_date_idx on public.campaign_metrics(company_id, date desc);
create index if not exists campaign_metrics_campaign_idx on public.campaign_metrics(campaign_id);
create index if not exists campaign_metrics_source_idx on public.campaign_metrics(source);
create index if not exists campaign_metrics_meta_campaign_idx on public.campaign_metrics(meta_campaign_id);
create index if not exists ad_integrations_provider_company_idx on public.ad_integrations(provider, company_id);
create index if not exists integration_sync_logs_company_created_idx on public.integration_sync_logs(company_id, created_at desc);
create index if not exists integration_sync_logs_provider_created_idx on public.integration_sync_logs(provider, created_at desc);
