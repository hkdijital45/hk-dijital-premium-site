-- Agency Operations Repair: Tasks Bulk Actions + Branch UX + Competitor Intelligence + Accounting Permissions
-- Non-destructive, idempotent schema support for agency operations.

alter table if exists public.agency_tasks
  add column if not exists branch_id uuid references public.customer_branches(id) on delete set null,
  add column if not exists show_to_customer boolean default false,
  add column if not exists visible_to_customer boolean default false,
  add column if not exists postponed_until timestamptz,
  add column if not exists completed_note text;

create index if not exists agency_tasks_branch_idx
  on public.agency_tasks(branch_id);

create index if not exists agency_tasks_visible_customer_idx
  on public.agency_tasks(visible_to_customer);

alter table if exists public.customer_branches
  add column if not exists google_maps_url text,
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists website_url text,
  add column if not exists landing_page_url text,
  add column if not exists search_console_site_url text,
  add column if not exists gtm_container_id text,
  add column if not exists monthly_ad_budget numeric,
  add column if not exists monthly_service_fee numeric,
  add column if not exists responsible_person text,
  add column if not exists status text default 'active',
  add column if not exists notes text,
  add column if not exists updated_at timestamptz default now();

create index if not exists customer_branches_status_idx
  on public.customer_branches(status);

create table if not exists public.competitor_watchlist (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  competitor_name text not null,
  website_url text,
  instagram_url text,
  google_maps_url text,
  sector text,
  city text,
  district text,
  address text,
  meta_ad_library_url text,
  last_ad_seen_at timestamptz,
  notify_on_new_ads boolean default true,
  notify_on_price_change boolean default false,
  notify_on_review_change boolean default false,
  monitoring_frequency text default 'weekly',
  show_to_customer boolean default false,
  status text default 'active',
  last_checked_at timestamptz,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists public.competitor_watchlist
  add column if not exists sector text,
  add column if not exists city text,
  add column if not exists district text,
  add column if not exists address text,
  add column if not exists meta_ad_library_url text,
  add column if not exists last_ad_seen_at timestamptz,
  add column if not exists notify_on_new_ads boolean default true,
  add column if not exists notify_on_price_change boolean default false,
  add column if not exists notify_on_review_change boolean default false,
  add column if not exists monitoring_frequency text default 'weekly',
  add column if not exists show_to_customer boolean default false;

create index if not exists competitor_watchlist_company_idx
  on public.competitor_watchlist(company_id);

create index if not exists competitor_watchlist_status_idx
  on public.competitor_watchlist(status);

create table if not exists public.action_result_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  branch_id uuid references public.customer_branches(id) on delete set null,
  entity_type text,
  entity_id uuid,
  action_type text not null,
  status text default 'success',
  title text,
  summary text,
  created_records jsonb default '[]'::jsonb,
  next_actions jsonb default '[]'::jsonb,
  check_links jsonb default '[]'::jsonb,
  customer_visibility jsonb default '{}'::jsonb,
  technical_details jsonb default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists action_result_logs_company_idx
  on public.action_result_logs(company_id);

create index if not exists action_result_logs_branch_idx
  on public.action_result_logs(branch_id);

create index if not exists action_result_logs_created_at_idx
  on public.action_result_logs(created_at);

create index if not exists action_result_logs_entity_idx
  on public.action_result_logs(entity_type, entity_id);

alter table if exists public.competitor_watchlist enable row level security;
alter table if exists public.action_result_logs enable row level security;

notify pgrst, 'reload schema';
