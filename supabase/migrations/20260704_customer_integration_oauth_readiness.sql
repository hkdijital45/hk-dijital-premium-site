alter table if exists public.customer_integrations
  add column if not exists provider text,
  add column if not exists oauth_status text default 'not_configured',
  add column if not exists oauth_account_id text,
  add column if not exists oauth_asset_id text,
  add column if not exists oauth_asset_type text,
  add column if not exists oauth_scopes text[] default array[]::text[],
  add column if not exists token_expires_at timestamptz,
  add column if not exists connection_error text,
  add column if not exists last_tested_at timestamptz,
  add column if not exists last_sync_status text,
  add column if not exists last_sync_message text,
  add column if not exists auto_discovered boolean default false;

create index if not exists customer_integrations_provider_idx
  on public.customer_integrations(provider);

create index if not exists customer_integrations_oauth_status_idx
  on public.customer_integrations(oauth_status);

create index if not exists customer_integrations_auto_discovered_idx
  on public.customer_integrations(auto_discovered);

notify pgrst, 'reload schema';
