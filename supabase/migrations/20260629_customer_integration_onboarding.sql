create table if not exists public.customer_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid unique references public.companies(id) on delete cascade,
  domain text,
  website_url text,
  cms_provider text,
  hosting_notes text,
  meta_business_id text,
  meta_ad_account_id text,
  meta_pixel_id text,
  meta_dataset_id text,
  meta_page_id text,
  instagram_business_id text,
  meta_access_token_masked text,
  ga4_measurement_id text,
  ga4_property_id text,
  google_ads_customer_id text,
  search_console_site_url text,
  gtm_container_id text,
  google_service_account_email text,
  google_service_account_status text default 'not_configured',
  clarity_project_id text,
  hotjar_site_id text,
  preferred_ai_provider text default 'auto',
  ai_notes text,
  setup_status jsonb default '{}'::jsonb,
  setup_progress integer default 0,
  last_checked_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.customer_integrations
  add column if not exists domain text,
  add column if not exists website_url text,
  add column if not exists cms_provider text,
  add column if not exists hosting_notes text,
  add column if not exists meta_business_id text,
  add column if not exists meta_ad_account_id text,
  add column if not exists meta_pixel_id text,
  add column if not exists meta_dataset_id text,
  add column if not exists meta_page_id text,
  add column if not exists instagram_business_id text,
  add column if not exists meta_access_token_masked text,
  add column if not exists ga4_measurement_id text,
  add column if not exists ga4_property_id text,
  add column if not exists google_ads_customer_id text,
  add column if not exists search_console_site_url text,
  add column if not exists gtm_container_id text,
  add column if not exists google_service_account_email text,
  add column if not exists google_service_account_status text default 'not_configured',
  add column if not exists clarity_project_id text,
  add column if not exists hotjar_site_id text,
  add column if not exists preferred_ai_provider text default 'auto',
  add column if not exists ai_notes text,
  add column if not exists setup_status jsonb default '{}'::jsonb,
  add column if not exists setup_progress integer default 0,
  add column if not exists last_checked_at timestamptz,
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists updated_by uuid references public.users(id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists customer_integrations_company_idx
  on public.customer_integrations(company_id);

create index if not exists customer_integrations_setup_progress_idx
  on public.customer_integrations(setup_progress);

create index if not exists customer_integrations_preferred_ai_idx
  on public.customer_integrations(preferred_ai_provider);

drop trigger if exists set_customer_integrations_updated_at on public.customer_integrations;
create trigger set_customer_integrations_updated_at
  before update on public.customer_integrations
  for each row execute function public.set_updated_at();

alter table public.customer_integrations enable row level security;

notify pgrst, 'reload schema';
