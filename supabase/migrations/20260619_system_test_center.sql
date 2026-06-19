create table if not exists public.system_test_runs (
  id uuid primary key default gen_random_uuid(),
  score numeric default 0,
  status text,
  total_tests integer default 0,
  success_count integer default 0,
  warning_count integer default 0,
  error_count integer default 0,
  tester_id uuid,
  tester_name text,
  summary text,
  results jsonb default '[]'::jsonb,
  issues jsonb default '[]'::jsonb,
  recommendations jsonb default '[]'::jsonb,
  export_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

alter table if exists public.system_test_runs
  add column if not exists score numeric default 0,
  add column if not exists status text,
  add column if not exists total_tests integer default 0,
  add column if not exists success_count integer default 0,
  add column if not exists warning_count integer default 0,
  add column if not exists error_count integer default 0,
  add column if not exists tester_id uuid,
  add column if not exists tester_name text,
  add column if not exists summary text,
  add column if not exists results jsonb default '[]'::jsonb,
  add column if not exists issues jsonb default '[]'::jsonb,
  add column if not exists recommendations jsonb default '[]'::jsonb,
  add column if not exists export_payload jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists deleted_at timestamptz;

create table if not exists public.system_test_checklist (
  id uuid primary key default gen_random_uuid(),
  category text,
  item_key text,
  title text not null,
  status text default 'Bekliyor',
  notes text,
  tester_id uuid,
  tester_name text,
  sort_order integer default 0,
  last_tested_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

alter table if exists public.system_test_checklist
  add column if not exists category text,
  add column if not exists item_key text,
  add column if not exists title text,
  add column if not exists status text default 'Bekliyor',
  add column if not exists notes text,
  add column if not exists tester_id uuid,
  add column if not exists tester_name text,
  add column if not exists sort_order integer default 0,
  add column if not exists last_tested_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists deleted_at timestamptz;

create unique index if not exists system_test_checklist_item_key_idx
  on public.system_test_checklist (item_key)
  where deleted_at is null and item_key is not null;

create index if not exists system_test_runs_created_at_idx on public.system_test_runs (created_at desc);
create index if not exists system_test_runs_status_idx on public.system_test_runs (status);
create index if not exists system_test_runs_deleted_at_idx on public.system_test_runs (deleted_at);
create index if not exists system_test_checklist_status_idx on public.system_test_checklist (status);
create index if not exists system_test_checklist_sort_order_idx on public.system_test_checklist (sort_order);
create index if not exists system_test_checklist_deleted_at_idx on public.system_test_checklist (deleted_at);
