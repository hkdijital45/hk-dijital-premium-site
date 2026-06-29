-- HK Intelligence CEO Marketplace Apply Wizard
-- Stores package application logs and generated record references.

create table if not exists public.hk_marketplace_package_applications (
  id uuid primary key default gen_random_uuid(),
  package_id uuid,
  company_id uuid references public.companies(id) on delete cascade,
  status text default 'applied',
  options jsonb default '{}'::jsonb,
  result_summary jsonb default '{}'::jsonb,
  created_records jsonb default '{}'::jsonb,
  error_message text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists hk_marketplace_package_applications_company_idx
  on public.hk_marketplace_package_applications(company_id);

create index if not exists hk_marketplace_package_applications_package_idx
  on public.hk_marketplace_package_applications(package_id);

create index if not exists hk_marketplace_package_applications_created_at_idx
  on public.hk_marketplace_package_applications(created_at desc);

alter table public.hk_marketplace_package_applications enable row level security;

do $$
begin
  if to_regclass('public.hk_marketplace_packages') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'hk_marketplace_package_applications_package_id_fkey'
        and conrelid = 'public.hk_marketplace_package_applications'::regclass
    )
  then
    alter table public.hk_marketplace_package_applications
      add constraint hk_marketplace_package_applications_package_id_fkey
      foreign key (package_id)
      references public.hk_marketplace_packages(id)
      on delete set null;
  end if;
end $$;

notify pgrst, 'reload schema';
