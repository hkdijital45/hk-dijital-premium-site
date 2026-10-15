-- İşletme ve Şube Yönetimi — branches, related brands, business groups and
-- independent businesses for Lead Merkezi, Müşteri Yönetimi and Reklam
-- Doktoru Pro.
--
-- Two tables instead of fields on leads/companies:
--   * business_units: a business identity that is NOT itself a lead or a
--     customer (a branch or a related brand created from a lead/customer,
--     or a BAĞIMSIZ business created in Reklam Doktoru Pro). Each has its
--     own contact info + Instagram, so its evaluations never borrow the
--     parent's identity.
--   * business_relationships: an explicit, user-chosen link between two
--     businesses (lead / customer / business_unit on either side). Typed —
--     a related brand (Robotik45) is never silently treated as a branch of
--     its parent (Zirve AKADEMİ). Unlinking deletes only this row, never
--     the linked lead/customer/business_unit itself.
--
-- customer_branches (Müşteri Yönetimi's ad-account-level branch rows) is
-- left untouched; it remains the operational branch table for existing
-- customers.
--
-- Safe to re-run: every statement is IF NOT EXISTS / DROP ... IF EXISTS on
-- policies/triggers only. No existing row is modified.
create extension if not exists pgcrypto;

create table if not exists public.business_units (
  id uuid primary key default gen_random_uuid(),
  unit_kind text not null check (unit_kind in ('branch', 'related_brand', 'business_group', 'independent')),
  name text not null check (length(btrim(name)) > 0),
  business_name text,
  instagram text,
  website text,
  phone text,
  address text,
  city text,
  description text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create index if not exists business_units_kind_idx on public.business_units (unit_kind) where archived_at is null;
create index if not exists business_units_name_idx on public.business_units (lower(name));

create table if not exists public.business_relationships (
  id uuid primary key default gen_random_uuid(),
  relationship_type text not null check (relationship_type in ('branch', 'related_brand', 'business_group')),

  parent_lead_id uuid references public.leads(id) on delete cascade,
  parent_company_id uuid references public.companies(id) on delete cascade,
  parent_unit_id uuid references public.business_units(id) on delete cascade,

  child_lead_id uuid references public.leads(id) on delete cascade,
  child_company_id uuid references public.companies(id) on delete cascade,
  child_unit_id uuid references public.business_units(id) on delete cascade,

  notes text not null default '',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint business_relationships_one_parent check (num_nonnulls(parent_lead_id, parent_company_id, parent_unit_id) = 1),
  constraint business_relationships_one_child check (num_nonnulls(child_lead_id, child_company_id, child_unit_id) = 1),
  constraint business_relationships_not_self check (
    coalesce(parent_lead_id, parent_company_id, parent_unit_id) <> coalesce(child_lead_id, child_company_id, child_unit_id)
  )
);

-- Duplicate prevention: the same two businesses can be linked only once,
-- in either direction.
create unique index if not exists business_relationships_pair_uidx on public.business_relationships (
  least(coalesce(parent_lead_id, parent_company_id, parent_unit_id), coalesce(child_lead_id, child_company_id, child_unit_id)),
  greatest(coalesce(parent_lead_id, parent_company_id, parent_unit_id), coalesce(child_lead_id, child_company_id, child_unit_id))
);
create index if not exists business_relationships_parent_lead_idx on public.business_relationships (parent_lead_id) where parent_lead_id is not null;
create index if not exists business_relationships_parent_company_idx on public.business_relationships (parent_company_id) where parent_company_id is not null;
create index if not exists business_relationships_parent_unit_idx on public.business_relationships (parent_unit_id) where parent_unit_id is not null;
create index if not exists business_relationships_child_lead_idx on public.business_relationships (child_lead_id) where child_lead_id is not null;
create index if not exists business_relationships_child_company_idx on public.business_relationships (child_company_id) where child_company_id is not null;
create index if not exists business_relationships_child_unit_idx on public.business_relationships (child_unit_id) where child_unit_id is not null;

-- Report attribution: an evaluation for a branch/related brand keeps its
-- original lead/customer owner (so history and lead→customer conversion
-- stay intact) and additionally names the exact business_unit it is
-- about. Existing rows stay NULL = "main business" — never re-attributed.
alter table if exists public.manual_evaluations
  add column if not exists business_unit_id uuid references public.business_units(id) on delete set null;
create index if not exists manual_evaluations_business_unit_idx on public.manual_evaluations (business_unit_id) where business_unit_id is not null;

drop trigger if exists business_units_set_updated_at on public.business_units;
create trigger business_units_set_updated_at
  before update on public.business_units
  for each row execute function public.set_updated_at();

drop trigger if exists business_relationships_set_updated_at on public.business_relationships;
create trigger business_relationships_set_updated_at
  before update on public.business_relationships
  for each row execute function public.set_updated_at();

alter table public.business_units enable row level security;
alter table public.business_relationships enable row level security;

drop policy if exists "Staff can manage business units" on public.business_units;
create policy "Staff can manage business units" on public.business_units for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage business relationships" on public.business_relationships;
create policy "Staff can manage business relationships" on public.business_relationships for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
