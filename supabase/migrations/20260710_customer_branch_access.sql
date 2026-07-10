-- Customer users can be limited to selected branches or all current/future branches.

alter table if exists public.customer_branches
  add column if not exists code text;

create unique index if not exists customer_branches_id_company_uidx
  on public.customer_branches(id, company_id);

create unique index if not exists users_id_company_uidx
  on public.users(id, company_id);

alter table public.users
  add column if not exists branch_access_mode text,
  add column if not exists default_branch_id uuid;

update public.users
set branch_access_mode = 'all'
where branch_access_mode is null
  and role in ('musteri', 'customer');

update public.users
set branch_access_mode = 'selected'
where branch_access_mode is null;

alter table public.users
  alter column branch_access_mode set default 'selected',
  alter column branch_access_mode set not null;

alter table public.users
  drop constraint if exists users_branch_access_mode_check;

alter table public.users
  add constraint users_branch_access_mode_check
  check (branch_access_mode in ('selected', 'all'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_default_branch_company_fkey'
  ) then
    alter table public.users
      add constraint users_default_branch_company_fkey
      foreign key (default_branch_id)
      references public.customer_branches(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.customer_user_branches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  company_id uuid not null,
  branch_id uuid not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  constraint customer_user_branches_user_branch_key unique (user_id, branch_id),
  constraint customer_user_branches_user_company_fkey
    foreign key (user_id, company_id)
    references public.users(id, company_id)
    on delete cascade,
  constraint customer_user_branches_branch_company_fkey
    foreign key (branch_id, company_id)
    references public.customer_branches(id, company_id)
    on delete cascade
);

create index if not exists customer_user_branches_user_id_idx
  on public.customer_user_branches(user_id);
create index if not exists customer_user_branches_company_id_idx
  on public.customer_user_branches(company_id);
create index if not exists customer_user_branches_branch_id_idx
  on public.customer_user_branches(branch_id);
create unique index if not exists customer_user_branches_one_default_uidx
  on public.customer_user_branches(user_id, company_id)
  where is_default;

create or replace function public.set_customer_user_branch_access(
  p_user_id uuid,
  p_company_id uuid,
  p_mode text,
  p_branch_ids uuid[] default '{}'::uuid[],
  p_default_branch_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invalid_branch_count integer;
begin
  if p_mode not in ('selected', 'all') then
    raise exception 'Geçersiz şube erişim modu.';
  end if;

  if not exists (select 1 from public.users where id = p_user_id and company_id = p_company_id) then
    raise exception 'Kullanıcı seçilen firmaya bağlı değil.';
  end if;

  if p_mode = 'selected' and coalesce(array_length(p_branch_ids, 1), 0) = 0 then
    raise exception 'Seçili şube erişiminde en az bir şube zorunludur.';
  end if;

  select count(*) into invalid_branch_count
  from unnest(coalesce(p_branch_ids, '{}'::uuid[])) selected_id
  left join public.customer_branches branch
    on branch.id = selected_id
   and branch.company_id = p_company_id
   and branch.is_active is not false
   and coalesce(branch.status, 'active') <> 'passive'
  where branch.id is null;

  if invalid_branch_count > 0 then
    raise exception 'Başka firmaya ait, pasif veya geçersiz şube seçildi.';
  end if;

  if p_default_branch_id is not null and not exists (
    select 1 from public.customer_branches
    where id = p_default_branch_id
      and company_id = p_company_id
      and is_active is not false
      and coalesce(status, 'active') <> 'passive'
  ) then
    raise exception 'Varsayılan şube seçilen firmaya ait değil veya pasif.';
  end if;

  if p_mode = 'selected' and p_default_branch_id is not null and not (p_default_branch_id = any(p_branch_ids)) then
    raise exception 'Varsayılan şube yetkili şubeler arasında olmalıdır.';
  end if;

  update public.users
  set branch_access_mode = p_mode,
      default_branch_id = p_default_branch_id,
      updated_at = now()
  where id = p_user_id;

  delete from public.customer_user_branches where user_id = p_user_id;

  if p_mode = 'selected' then
    insert into public.customer_user_branches (user_id, company_id, branch_id, is_default)
    select p_user_id, p_company_id, branch_id, branch_id = p_default_branch_id
    from unnest(p_branch_ids) branch_id
    on conflict (user_id, branch_id) do update set
      company_id = excluded.company_id,
      is_default = excluded.is_default;
  end if;
end;
$$;

revoke all on function public.set_customer_user_branch_access(uuid, uuid, text, uuid[], uuid) from public;
grant execute on function public.set_customer_user_branch_access(uuid, uuid, text, uuid[], uuid) to service_role;

-- Existing single-branch customers receive an explicit default assignment.
insert into public.customer_user_branches (user_id, company_id, branch_id, is_default)
select u.id, u.company_id, min(b.id), true
from public.users u
join public.customer_branches b
  on b.company_id = u.company_id
 and b.is_active is not false
 and coalesce(b.status, 'active') <> 'passive'
where u.role in ('musteri', 'customer')
  and u.company_id is not null
group by u.id, u.company_id
having count(*) = 1
on conflict (user_id, branch_id) do update set is_default = excluded.is_default;

update public.users u
set default_branch_id = assignment.branch_id
from public.customer_user_branches assignment
where assignment.user_id = u.id
  and assignment.is_default
  and u.default_branch_id is null;

-- Branch-aware customer-facing entities. Null remains company-wide data.
alter table if exists public.campaigns add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.campaign_metrics add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.customer_updates add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.customer_files add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.reports add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.report_interpretations add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.report_updates add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.customer_documents add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.payment_records add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.agency_tasks add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.monthly_reports add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.meta_adset_metrics add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.meta_ad_metrics add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.meta_conversion_events add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;
alter table if exists public.meta_analysis_snapshots add column if not exists branch_id uuid references public.customer_branches(id) on delete set null;

create index if not exists campaigns_company_branch_idx on public.campaigns(company_id, branch_id);
create index if not exists campaign_metrics_company_branch_idx on public.campaign_metrics(company_id, branch_id);
create index if not exists customer_updates_company_branch_idx on public.customer_updates(company_id, branch_id);
create index if not exists customer_files_company_branch_idx on public.customer_files(company_id, branch_id);
create index if not exists reports_company_branch_idx on public.reports(company_id, branch_id);
create index if not exists customer_documents_company_branch_idx on public.customer_documents(company_id, branch_id);
create index if not exists payment_records_company_branch_idx on public.payment_records(company_id, branch_id);
create index if not exists agency_tasks_company_branch_idx on public.agency_tasks(company_id, branch_id);
create index if not exists monthly_reports_company_branch_idx on public.monthly_reports(company_id, branch_id);

alter table public.customer_user_branches enable row level security;

drop policy if exists customer_user_branches_read_access on public.customer_user_branches;
create policy customer_user_branches_read_access
on public.customer_user_branches
for select
using (
  exists (
    select 1 from public.users actor
    where actor.auth_user_id = auth.uid()
      and actor.is_active
      and actor.deleted_at is null
      and (
        actor.role in ('admin', 'yonetici', 'editor', 'sales')
        or actor.id = customer_user_branches.user_id
      )
  )
);

drop policy if exists customer_branches_authorized_read on public.customer_branches;
create policy customer_branches_authorized_read
on public.customer_branches
for select
using (
  exists (
    select 1 from public.users actor
    where actor.auth_user_id = auth.uid()
      and actor.is_active
      and actor.deleted_at is null
      and (
        actor.role in ('admin', 'yonetici', 'editor', 'sales')
        or (
          actor.company_id = customer_branches.company_id
          and (
            actor.branch_access_mode = 'all'
            or exists (
              select 1 from public.customer_user_branches access
              where access.user_id = actor.id
                and access.company_id = customer_branches.company_id
                and access.branch_id = customer_branches.id
            )
          )
        )
      )
  )
);

comment on table public.customer_user_branches is 'Selected branch access assignments for customer users.';
comment on column public.users.branch_access_mode is 'selected: assignment rows; all: all current and future active company branches.';
comment on column public.users.default_branch_id is 'Initial customer portal branch when the user has branch access.';

notify pgrst, 'reload schema';
