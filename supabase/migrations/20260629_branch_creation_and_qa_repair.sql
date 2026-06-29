-- Branch Creation Fix + QA Center Repair Intelligence
-- Ensures customer_branches exists and supports branch create/edit/passive flows.

create table if not exists public.customer_branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  branch_name text not null,
  city text,
  district text,
  address text,
  meta_ad_account_id text,
  google_ads_customer_id text,
  ga4_property_id text,
  setup_status jsonb default '{}'::jsonb,
  kpi_snapshot jsonb default '{}'::jsonb,
  ai_notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists public.customer_branches
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists google_maps_url text,
  add column if not exists website_url text,
  add column if not exists landing_page_url text,
  add column if not exists search_console_site_url text,
  add column if not exists gtm_container_id text,
  add column if not exists monthly_ad_budget numeric,
  add column if not exists monthly_service_fee numeric,
  add column if not exists responsible_person text,
  add column if not exists status text default 'active',
  add column if not exists notes text,
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists updated_by uuid references public.users(id) on delete set null;

create index if not exists customer_branches_company_idx
  on public.customer_branches(company_id);

create index if not exists customer_branches_status_idx
  on public.customer_branches(status);

create index if not exists customer_branches_company_status_idx
  on public.customer_branches(company_id, status);

alter table public.customer_branches enable row level security;

notify pgrst, 'reload schema';
