-- HK Intelligence CEO Functional Actions
-- Marketplace package persistence for the executive command center.

create table if not exists public.hk_marketplace_packages (
  id uuid primary key default gen_random_uuid(),
  package_name text not null,
  sector text not null,
  target_customer text,
  service_types jsonb default '[]'::jsonb,
  channels jsonb default '[]'::jsonb,
  monthly_budget_range text,
  main_goal text,
  generated_prompt text,
  workflow_steps jsonb default '[]'::jsonb,
  ai_team jsonb default '[]'::jsonb,
  kpi_template jsonb default '[]'::jsonb,
  report_template jsonb default '[]'::jsonb,
  proposal_draft text,
  operation_plan jsonb default '[]'::jsonb,
  status text default 'draft',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists hk_marketplace_packages_sector_idx on public.hk_marketplace_packages(sector);
create index if not exists hk_marketplace_packages_status_idx on public.hk_marketplace_packages(status);
create index if not exists hk_marketplace_packages_created_at_idx on public.hk_marketplace_packages(created_at desc);

alter table public.hk_marketplace_packages enable row level security;

notify pgrst, 'reload schema';
