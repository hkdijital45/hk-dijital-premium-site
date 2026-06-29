-- Professional Agency OS Upgrade: Branch Management and Agency Package Builder
-- Non-destructive, idempotent migration for customer branches, branch-aware package applications,
-- and agency workflow payloads in marketplace packages.

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
  add column if not exists notes text;

alter table if exists public.hk_marketplace_package_applications
  add column if not exists branch_id uuid,
  add column if not exists ninety_day_plan jsonb default '[]'::jsonb;

do $$
begin
  if to_regclass('public.customer_branches') is not null
     and to_regclass('public.hk_marketplace_package_applications') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'hk_marketplace_package_applications_branch_id_fkey'
     ) then
    alter table public.hk_marketplace_package_applications
      add constraint hk_marketplace_package_applications_branch_id_fkey
      foreign key (branch_id)
      references public.customer_branches(id)
      on delete set null;
  end if;
end $$;

alter table if exists public.hk_marketplace_packages
  add column if not exists social_media_plan jsonb default '[]'::jsonb,
  add column if not exists approval_workflow jsonb default '[]'::jsonb,
  add column if not exists campaign_operations jsonb default '[]'::jsonb,
  add column if not exists client_communication_plan jsonb default '[]'::jsonb,
  add column if not exists report_approval_flow jsonb default '[]'::jsonb,
  add column if not exists content_calendar jsonb default '[]'::jsonb,
  add column if not exists creative_ideas jsonb default '[]'::jsonb,
  add column if not exists ninety_day_plan jsonb default '[]'::jsonb;

create index if not exists customer_branches_status_idx
  on public.customer_branches(status);

create index if not exists customer_branches_company_status_idx
  on public.customer_branches(company_id, status);

create index if not exists hk_marketplace_package_applications_branch_idx
  on public.hk_marketplace_package_applications(branch_id);

notify pgrst, 'reload schema';
