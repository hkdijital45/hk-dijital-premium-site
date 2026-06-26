-- Ensure lead location fields used by CRM and discovery flows exist in live Supabase.
alter table if exists public.leads
  add column if not exists city text,
  add column if not exists district text,
  add column if not exists sector text,
  add column if not exists address text,
  add column if not exists source_url text;

create index if not exists leads_city_idx on public.leads(city);
create index if not exists leads_district_idx on public.leads(district);
create index if not exists leads_sector_idx on public.leads(sector);

notify pgrst, 'reload schema';
