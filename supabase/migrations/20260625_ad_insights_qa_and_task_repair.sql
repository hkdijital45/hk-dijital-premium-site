alter table if exists public.agency_tasks
  add column if not exists description text,
  add column if not exists notes text,
  add column if not exists status text default 'Yapılacak',
  add column if not exists priority text default 'Normal',
  add column if not exists due_date date,
  add column if not exists assigned_user_id uuid references public.users(id) on delete set null,
  add column if not exists visible_to_customer boolean not null default false,
  add column if not exists completed_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists automation_key text,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.leads
  add column if not exists calendar_follow_up_at timestamptz;

create table if not exists public.ad_insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.companies(id) on delete cascade,
  platform text not null default 'all',
  account_id text,
  date_from date,
  date_to date,
  metrics jsonb not null default '{}'::jsonb,
  insights jsonb not null default '{}'::jsonb,
  health_score integer not null default 0,
  source_type text not null default 'Demo veri',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_ai_interpretations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.companies(id) on delete cascade,
  platform text not null default 'all',
  date_from date,
  date_to date,
  metrics jsonb not null default '{}'::jsonb,
  insights jsonb not null default '{}'::jsonb,
  health_score integer not null default 0,
  source_type text not null default 'Demo veri',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agency_tasks_company_due_date_idx on public.agency_tasks(company_id, due_date);
create index if not exists agency_tasks_visible_customer_idx on public.agency_tasks(company_id, visible_to_customer);
create index if not exists leads_calendar_follow_up_at_idx on public.leads(calendar_follow_up_at);
create index if not exists ad_insight_snapshots_customer_created_idx on public.ad_insight_snapshots(customer_id, created_at desc);
create index if not exists ad_ai_interpretations_customer_created_idx on public.ad_ai_interpretations(customer_id, created_at desc);

notify pgrst, 'reload schema';
