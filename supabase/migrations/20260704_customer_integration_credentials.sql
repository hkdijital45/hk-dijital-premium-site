alter table if exists public.customer_integrations
  add column if not exists status text default 'pending_review',
  add column if not exists source text default 'admin',
  add column if not exists connection_mode text default 'manual',
  add column if not exists admin_review_status text default 'waiting',
  add column if not exists integration_assets jsonb default '[]'::jsonb,
  add column if not exists login_email text,
  add column if not exists login_username text,
  add column if not exists login_password text,
  add column if not exists recovery_email text,
  add column if not exists two_factor_note text,
  add column if not exists access_note text,
  add column if not exists sensitive_metadata jsonb default '{}'::jsonb;

create index if not exists customer_integrations_status_idx
  on public.customer_integrations(status);

create index if not exists customer_integrations_admin_review_idx
  on public.customer_integrations(admin_review_status);

notify pgrst, 'reload schema';
