-- İşletme ve Şube Yönetimi — phase 2. Requires 20261015_business_relationships.sql.
--
--  1. Ön İnceleme (pre_audit_reports) and Aday Değerlendirme
--     (candidate_evaluations) can be attributed to a linked branch /
--     related brand via a nullable business_unit_id. Existing rows stay
--     NULL = main business; nothing is moved, split or rewritten.
--  2. business_ad_campaign_links: staff-verified mapping of a customer's
--     REAL synced campaigns to one of its linked businesses, used by
--     Reklam Doktoru Pro for business-level metrics. Two businesses may
--     verify the same campaign (shared ad account) — the UI then labels the
--     numbers as the campaign total.
--
-- Teklif kapsamı (multi-business proposals) needs no schema change — it is
-- stored in proposals.questionnaire (jsonb).
--
-- Safe to re-run; additive only; no DROP TABLE / TRUNCATE / data update.

alter table if exists public.pre_audit_reports
  add column if not exists business_unit_id uuid references public.business_units(id) on delete set null;
create index if not exists pre_audit_reports_business_unit_idx on public.pre_audit_reports (business_unit_id) where business_unit_id is not null;

alter table if exists public.candidate_evaluations
  add column if not exists business_unit_id uuid references public.business_units(id) on delete set null;
create index if not exists candidate_evaluations_business_unit_idx on public.candidate_evaluations (business_unit_id) where business_unit_id is not null;

create table if not exists public.business_ad_campaign_links (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  platform text not null check (platform in ('meta', 'google')),
  campaign_key text not null check (length(btrim(campaign_key)) > 0),
  campaign_name text not null default '',
  ad_account_label text not null default '',
  verified_by uuid references public.users(id) on delete set null,
  verified_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists business_ad_campaign_links_unique_idx on public.business_ad_campaign_links (business_unit_id, platform, campaign_key);
create index if not exists business_ad_campaign_links_company_idx on public.business_ad_campaign_links (company_id, platform, campaign_key);

alter table public.business_ad_campaign_links enable row level security;

drop policy if exists "Staff can manage business ad campaign links" on public.business_ad_campaign_links;
create policy "Staff can manage business ad campaign links" on public.business_ad_campaign_links for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
