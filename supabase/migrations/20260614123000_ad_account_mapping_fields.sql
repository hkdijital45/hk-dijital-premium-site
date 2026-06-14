alter table if exists public.ad_integrations
  add column if not exists account_name text,
  add column if not exists account_id text,
  add column if not exists business_id text,
  add column if not exists google_customer_id text,
  add column if not exists google_analytics_id text,
  add column if not exists sync_status text,
  add column if not exists sync_message text,
  add column if not exists settings jsonb default '{}'::jsonb;

create index if not exists ad_integrations_provider_company_idx
  on public.ad_integrations(provider, company_id);

create index if not exists ad_integrations_account_id_idx
  on public.ad_integrations(account_id);

create index if not exists ad_integrations_google_customer_id_idx
  on public.ad_integrations(google_customer_id);
