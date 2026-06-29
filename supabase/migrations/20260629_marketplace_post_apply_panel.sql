-- HK Marketplace Post-Apply Operating Panel and AI Package Builder
-- Extends existing marketplace package and application tables without destructive changes.

alter table if exists public.hk_marketplace_package_applications
  add column if not exists post_apply_plan jsonb default '{}'::jsonb,
  add column if not exists next_actions jsonb default '[]'::jsonb,
  add column if not exists tracking_metrics jsonb default '[]'::jsonb,
  add column if not exists seven_day_plan jsonb default '[]'::jsonb,
  add column if not exists thirty_day_plan jsonb default '[]'::jsonb;

alter table if exists public.hk_marketplace_packages
  add column if not exists niche text,
  add column if not exists region text,
  add column if not exists service_fee_range text,
  add column if not exists customer_problem text,
  add column if not exists competition_level text,
  add column if not exists sales_process text,
  add column if not exists offer_tone text,
  add column if not exists package_level text,
  add column if not exists package_duration text,
  add column if not exists risks jsonb default '[]'::jsonb,
  add column if not exists opportunities jsonb default '[]'::jsonb,
  add column if not exists sales_arguments jsonb default '[]'::jsonb,
  add column if not exists customer_summary text,
  add column if not exists seven_day_plan jsonb default '[]'::jsonb,
  add column if not exists thirty_day_plan jsonb default '[]'::jsonb,
  add column if not exists tracking_metrics jsonb default '[]'::jsonb,
  add column if not exists version_number integer default 1,
  add column if not exists source text default 'ai_generated';

create index if not exists hk_marketplace_packages_source_idx
  on public.hk_marketplace_packages(source);

create index if not exists hk_marketplace_packages_version_idx
  on public.hk_marketplace_packages(version_number);

notify pgrst, 'reload schema';
