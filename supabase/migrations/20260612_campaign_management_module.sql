create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  customer_id uuid,
  name text not null default 'Yeni Kampanya',
  platform text,
  objective text,
  status text default 'Planlandı',
  start_date date,
  end_date date,
  daily_budget numeric default 0,
  total_budget numeric default 0,
  spent_budget numeric default 0,
  budget numeric default 0,
  spent numeric default 0,
  notes text,
  internal_notes text,
  visible_to_customer boolean default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists public.campaigns
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists customer_id uuid,
  add column if not exists name text not null default 'Yeni Kampanya',
  add column if not exists platform text,
  add column if not exists objective text,
  add column if not exists status text default 'Planlandı',
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists daily_budget numeric default 0,
  add column if not exists total_budget numeric default 0,
  add column if not exists spent_budget numeric default 0,
  add column if not exists budget numeric default 0,
  add column if not exists spent numeric default 0,
  add column if not exists notes text,
  add column if not exists internal_notes text,
  add column if not exists visible_to_customer boolean default false,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists campaigns_company_id_idx on public.campaigns(company_id);
create index if not exists campaigns_customer_id_idx on public.campaigns(customer_id);
create index if not exists campaigns_status_idx on public.campaigns(status);
create index if not exists campaigns_platform_idx on public.campaigns(platform);
create index if not exists campaigns_start_date_idx on public.campaigns(start_date);
create index if not exists campaigns_end_date_idx on public.campaigns(end_date);
create index if not exists campaigns_archived_at_idx on public.campaigns(archived_at);
create index if not exists campaigns_deleted_at_idx on public.campaigns(deleted_at);
