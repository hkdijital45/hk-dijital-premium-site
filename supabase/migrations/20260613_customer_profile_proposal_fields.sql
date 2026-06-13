-- Customer profile proposal fields.
-- Keeps proposals in customer_documents while adding structured proposal metadata.

alter table if exists public.customer_documents
  add column if not exists package_type text,
  add column if not exists service_fee numeric default 0,
  add column if not exists ad_budget numeric default 0,
  add column if not exists included_services text,
  add column if not exists next_step text;

do $$
begin
  if to_regclass('public.customer_documents') is not null then
    create index if not exists customer_documents_package_type_idx on public.customer_documents(package_type);
  end if;
end $$;
