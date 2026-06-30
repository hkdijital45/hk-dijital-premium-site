create table if not exists public.competitor_watchlist (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  branch_id uuid references public.customer_branches(id) on delete set null,
  competitor_name text not null,
  website_url text,
  instagram_url text,
  google_maps_url text,
  meta_ad_library_url text,
  sector text,
  city text,
  district text,
  address text,
  status text default 'active',
  monitoring_frequency text default 'weekly',
  notify_on_new_ads boolean default true,
  notify_on_price_change boolean default false,
  notify_on_review_change boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.competitor_watchlist add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.competitor_watchlist add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table public.competitor_watchlist add column if not exists competitor_name text;
alter table public.competitor_watchlist add column if not exists website_url text;
alter table public.competitor_watchlist add column if not exists instagram_url text;
alter table public.competitor_watchlist add column if not exists google_maps_url text;
alter table public.competitor_watchlist add column if not exists meta_ad_library_url text;
alter table public.competitor_watchlist add column if not exists sector text;
alter table public.competitor_watchlist add column if not exists city text;
alter table public.competitor_watchlist add column if not exists district text;
alter table public.competitor_watchlist add column if not exists address text;
alter table public.competitor_watchlist add column if not exists status text default 'active';
alter table public.competitor_watchlist add column if not exists monitoring_frequency text default 'weekly';
alter table public.competitor_watchlist add column if not exists notify_on_new_ads boolean default true;
alter table public.competitor_watchlist add column if not exists notify_on_price_change boolean default false;
alter table public.competitor_watchlist add column if not exists notify_on_review_change boolean default false;
alter table public.competitor_watchlist add column if not exists notify_on_website_change boolean default false;
alter table public.competitor_watchlist add column if not exists last_checked_at timestamptz;
alter table public.competitor_watchlist add column if not exists last_ad_seen_at timestamptz;
alter table public.competitor_watchlist add column if not exists last_post_seen_at timestamptz;
alter table public.competitor_watchlist add column if not exists last_review_count integer;
alter table public.competitor_watchlist add column if not exists last_website_snapshot text;
alter table public.competitor_watchlist add column if not exists last_price_signal text;
alter table public.competitor_watchlist add column if not exists last_analysis_summary text;
alter table public.competitor_watchlist add column if not exists customer_visible_summary text;
alter table public.competitor_watchlist add column if not exists analysis_payload jsonb default '{}'::jsonb;
alter table public.competitor_watchlist add column if not exists notification_settings jsonb default '{}'::jsonb;
alter table public.competitor_watchlist add column if not exists show_to_customer boolean default false;
alter table public.competitor_watchlist add column if not exists customer_summary text;
alter table public.competitor_watchlist add column if not exists customer_recommendations jsonb default '[]'::jsonb;
alter table public.competitor_watchlist add column if not exists customer_action_plan jsonb default '[]'::jsonb;
alter table public.competitor_watchlist add column if not exists internal_analysis jsonb default '{}'::jsonb;
alter table public.competitor_watchlist add column if not exists show_customer_summary boolean default false;
alter table public.competitor_watchlist add column if not exists created_at timestamptz default now();
alter table public.competitor_watchlist add column if not exists updated_at timestamptz default now();

create table if not exists public.competitor_signals (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references public.competitor_watchlist(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  signal_type text not null,
  title text not null,
  summary text,
  severity text default 'info',
  source_url text,
  detected_at timestamptz default now(),
  show_to_customer boolean default false,
  action_status text default 'new',
  metadata jsonb default '{}'::jsonb,
  customer_summary text,
  customer_recommendations jsonb default '[]'::jsonb,
  customer_action_plan jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table public.competitor_signals add column if not exists competitor_id uuid references public.competitor_watchlist(id) on delete cascade;
alter table public.competitor_signals add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.competitor_signals add column if not exists signal_type text;
alter table public.competitor_signals add column if not exists title text;
alter table public.competitor_signals add column if not exists summary text;
alter table public.competitor_signals add column if not exists severity text default 'info';
alter table public.competitor_signals add column if not exists source_url text;
alter table public.competitor_signals add column if not exists detected_at timestamptz default now();
alter table public.competitor_signals add column if not exists show_to_customer boolean default false;
alter table public.competitor_signals add column if not exists action_status text default 'new';
alter table public.competitor_signals add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.competitor_signals add column if not exists customer_summary text;
alter table public.competitor_signals add column if not exists customer_recommendations jsonb default '[]'::jsonb;
alter table public.competitor_signals add column if not exists customer_action_plan jsonb default '[]'::jsonb;
alter table public.competitor_signals add column if not exists created_at timestamptz default now();

create index if not exists competitor_watchlist_company_idx on public.competitor_watchlist(company_id);
create index if not exists competitor_watchlist_branch_idx on public.competitor_watchlist(branch_id);
create index if not exists competitor_watchlist_status_idx on public.competitor_watchlist(status);
create index if not exists competitor_watchlist_visibility_idx on public.competitor_watchlist(show_to_customer, show_customer_summary);
create index if not exists competitor_watchlist_checked_idx on public.competitor_watchlist(last_checked_at);
create index if not exists competitor_signals_competitor_idx on public.competitor_signals(competitor_id);
create index if not exists competitor_signals_company_idx on public.competitor_signals(company_id);
create index if not exists competitor_signals_type_idx on public.competitor_signals(signal_type);
create index if not exists competitor_signals_detected_idx on public.competitor_signals(detected_at);
create index if not exists competitor_signals_visibility_idx on public.competitor_signals(show_to_customer);

alter table public.competitor_watchlist enable row level security;
alter table public.competitor_signals enable row level security;
