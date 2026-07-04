alter table if exists public.customer_integrations
  add column if not exists provider_account_id text,
  add column if not exists provider_account_name text,
  add column if not exists account_type text,
  add column if not exists connection_method text,
  add column if not exists scopes text[] default array[]::text[],
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists manual_payload jsonb default '{}'::jsonb,
  add column if not exists access_token_encrypted text,
  add column if not exists refresh_token_encrypted text,
  add column if not exists sync_error text;

create index if not exists customer_integrations_provider_account_idx
  on public.customer_integrations(provider_account_id);

create index if not exists customer_integrations_connection_method_idx
  on public.customer_integrations(connection_method);

notify pgrst, 'reload schema';
