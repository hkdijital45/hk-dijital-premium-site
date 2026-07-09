-- Customer package assignment fields for HK Dijital service package system.
alter table public.companies
  add column if not exists customer_package_type text,
  add column if not exists customer_package_name text,
  add column if not exists customer_package_price numeric,
  add column if not exists customer_package_currency text default 'TRY',
  add column if not exists customer_package_tax_note text,
  add column if not exists customer_package_started_at date,
  add column if not exists customer_package_note text;

create index if not exists companies_customer_package_type_idx on public.companies(customer_package_type);
create index if not exists companies_customer_package_name_idx on public.companies(customer_package_name);
