-- Separate test/demo records from live operational reporting.
alter table public.leads
  add column if not exists is_test boolean not null default false;

alter table public.companies
  add column if not exists is_test boolean not null default false;

create index if not exists leads_is_test_idx on public.leads(is_test);
create index if not exists companies_is_test_idx on public.companies(is_test);

-- Only explicit demo names are migrated. Ambiguous names remain live for manual review.
update public.leads
set is_test = true
where upper(trim(coalesce(company, name, ''))) in ('HK DİJİTAL DEMO', 'SUPER MÜŞTERİ');

update public.companies
set is_test = true
where upper(trim(coalesce(name, ''))) in ('HK DİJİTAL DEMO', 'SUPER MÜŞTERİ');
