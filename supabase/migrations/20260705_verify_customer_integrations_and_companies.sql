alter table if exists public.customer_integrations
  add column if not exists customer_id uuid,
  add column if not exists provider text,
  add column if not exists platform text,
  add column if not exists account_type text,
  add column if not exists provider_account_id text,
  add column if not exists provider_account_name text,
  add column if not exists connection_method text,
  add column if not exists status text default 'pending_review',
  add column if not exists scopes text[] default '{}'::text[],
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists manual_payload jsonb default '{}'::jsonb,
  add column if not exists integration_assets jsonb default '[]'::jsonb,
  add column if not exists access_token_encrypted text,
  add column if not exists refresh_token_encrypted text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_error text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.customer_integrations
set customer_id = company_id
where customer_id is null
  and company_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_integrations_customer_id_fkey'
  ) then
    alter table public.customer_integrations
      add constraint customer_integrations_customer_id_fkey
      foreign key (customer_id) references public.companies(id) on delete cascade;
  end if;
end $$;

create or replace function public.sync_customer_integrations_customer_id()
returns trigger
language plpgsql
as $$
begin
  if new.customer_id is null and new.company_id is not null then
    new.customer_id := new.company_id;
  end if;

  if new.company_id is null and new.customer_id is not null then
    new.company_id := new.customer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_customer_integrations_customer_id_trigger on public.customer_integrations;
create trigger sync_customer_integrations_customer_id_trigger
  before insert or update on public.customer_integrations
  for each row
  execute function public.sync_customer_integrations_customer_id();

create index if not exists customer_integrations_customer_id_idx
  on public.customer_integrations(customer_id);

create index if not exists customer_integrations_platform_idx
  on public.customer_integrations(platform);

create index if not exists customer_integrations_account_type_idx
  on public.customer_integrations(account_type);

create index if not exists customer_integrations_customer_provider_idx
  on public.customer_integrations(customer_id, provider);

create unique index if not exists customer_integrations_customer_provider_account_uidx
  on public.customer_integrations(customer_id, provider, account_type, provider_account_id)
  where customer_id is not null
    and provider is not null
    and account_type is not null
    and provider_account_id is not null
    and provider_account_id <> '';

alter table if exists public.companies
  add column if not exists custom_sector text,
  add column if not exists contact_name text,
  add column if not exists authorized_person text,
  add column if not exists sales_status text,
  add column if not exists pipeline_stage text,
  add column if not exists last_contact_at timestamptz,
  add column if not exists next_action_at timestamptz,
  add column if not exists next_action text,
  add column if not exists follow_up_note text;

create index if not exists companies_custom_sector_idx
  on public.companies(custom_sector);

create index if not exists companies_contact_name_idx
  on public.companies(contact_name);

create index if not exists companies_authorized_person_idx
  on public.companies(authorized_person);

create index if not exists companies_sales_status_idx
  on public.companies(sales_status);

create index if not exists companies_pipeline_stage_idx
  on public.companies(pipeline_stage);

create index if not exists companies_last_contact_at_idx
  on public.companies(last_contact_at);

create index if not exists companies_next_action_at_idx
  on public.companies(next_action_at);
