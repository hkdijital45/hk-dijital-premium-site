-- Premium Report System V3 — company logo discovery, verification and storage.
-- Requires 20261015_business_relationships.sql (business_units).
--
-- One row per logo candidate/decision for a lead, a customer or a linked
-- business (branch / related brand). Files live in the existing
-- `customer-assets` bucket under business-logos/<type>/<id>/<sha256>.png
-- (normalized PNG). Only a row with status = 'VERIFIED' AND is_primary is
-- ever used in a PDF. Existing customer_branding logos are left untouched
-- and are still honoured as manually uploaded (verified) customer logos.
--
-- Additive and safe to re-run. No existing row is modified.

create table if not exists public.business_logos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  business_unit_id uuid references public.business_units(id) on delete cascade,
  status text not null check (status in ('VERIFIED', 'PENDING_REVIEW', 'NOT_FOUND', 'REJECTED')),
  source_type text not null check (source_type in ('manual_upload', 'customer_branding', 'website_structured_data', 'website_header', 'website_icon', 'open_graph', 'mcp_candidate')),
  source_url text,
  source_website text,
  storage_path text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  sha256 text,
  evidence jsonb not null default '{}'::jsonb,
  is_primary boolean not null default false,
  discovered_at timestamptz not null default timezone('utc', now()),
  verified_by uuid references public.users(id) on delete set null,
  verified_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint business_logos_one_owner check (num_nonnulls(company_id, lead_id, business_unit_id) = 1),
  constraint business_logos_primary_is_verified check (not is_primary or status = 'VERIFIED'),
  constraint business_logos_file_for_image_states check (status = 'NOT_FOUND' or storage_path is not null)
);

-- At most one primary (report) logo per business.
create unique index if not exists business_logos_primary_company_uidx on public.business_logos (company_id) where is_primary and company_id is not null;
create unique index if not exists business_logos_primary_lead_uidx on public.business_logos (lead_id) where is_primary and lead_id is not null;
create unique index if not exists business_logos_primary_unit_uidx on public.business_logos (business_unit_id) where is_primary and business_unit_id is not null;
-- The same image is stored once per business.
create unique index if not exists business_logos_owner_sha_uidx on public.business_logos (coalesce(company_id, lead_id, business_unit_id), sha256) where sha256 is not null;
create index if not exists business_logos_company_idx on public.business_logos (company_id) where company_id is not null;
create index if not exists business_logos_lead_idx on public.business_logos (lead_id) where lead_id is not null;
create index if not exists business_logos_unit_idx on public.business_logos (business_unit_id) where business_unit_id is not null;

drop trigger if exists business_logos_set_updated_at on public.business_logos;
create trigger business_logos_set_updated_at
  before update on public.business_logos
  for each row execute function public.set_updated_at();

alter table public.business_logos enable row level security;

drop policy if exists "Staff can manage business logos" on public.business_logos;
create policy "Staff can manage business logos" on public.business_logos for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
