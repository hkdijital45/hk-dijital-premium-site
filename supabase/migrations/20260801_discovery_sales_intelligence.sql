-- Müşteri Keşfi / Google Maps Müşteri Bulma — Meta-focused sales
-- intelligence upgrade. Adds:
--   1) Columns the application code already referenced (opportunity_score,
--      digital_gap_score, ad_potential_score, google_maps_url, lead_stage)
--      but which were never actually migrated — confirmed missing from the
--      live leads table before this migration (verified via a direct
--      Supabase REST query), which is why src/app/api/admin/business-
--      discovery/route.ts had a defensive stripOptionalDiscoveryColumns()
--      fallback silently dropping them on every save.
--   2) Genuinely new fields for honest advertising-signal detection,
--      Meta Ads suitability scoring, manual ad-status verification, and a
--      neighborhood (mahalle) field so district/neighborhood filtering can
--      be independently optional per the redesigned search form.
--
-- All additive, idempotent (IF NOT EXISTS), no destructive SQL, no existing
-- data touched. Safe defaults backfill every new column so existing rows
-- remain valid.

alter table public.leads
  add column if not exists neighborhood text,
  add column if not exists google_maps_url text,
  add column if not exists lead_stage text,
  add column if not exists opportunity_score integer,
  add column if not exists digital_gap_score integer,
  add column if not exists ad_potential_score integer,
  add column if not exists meta_suitability_score integer,
  add column if not exists whatsapp text,
  -- Advertising detection: never a bare boolean "is advertising" — always a
  -- status + human-readable evidence string, per evaluateAdvertisingSignals()
  -- in src/lib/lead-scoring.ts. Values: active_signal | no_signal_detected |
  -- unverified | manual_check_required | source_unavailable.
  add column if not exists meta_ads_status text,
  add column if not exists meta_ads_evidence text,
  add column if not exists google_ads_status text,
  add column if not exists google_ads_evidence text,
  add column if not exists meta_pixel_detected boolean,
  add column if not exists google_tag_detected boolean,
  add column if not exists whatsapp_link_detected boolean,
  add column if not exists advertising_confidence text,
  add column if not exists advertising_source text,
  add column if not exists advertising_last_checked_at timestamptz,
  -- Manual ad-status verification, stored with full accountability.
  add column if not exists meta_ads_verified_status text,
  add column if not exists meta_ads_verified_by uuid references public.users(id) on delete set null,
  add column if not exists meta_ads_verified_at timestamptz,
  add column if not exists meta_ads_verified_source text,
  add column if not exists google_ads_verified_status text,
  add column if not exists google_ads_verified_by uuid references public.users(id) on delete set null,
  add column if not exists google_ads_verified_at timestamptz,
  add column if not exists google_ads_verified_source text,
  -- Flexible evidence blob for the richer, less-queryable intelligence
  -- (score breakdown, sales recommendation, outreach drafts) rather than
  -- proliferating dozens more scalar columns for data nothing filters by.
  add column if not exists discovery_evidence jsonb not null default '{}'::jsonb,
  add column if not exists discovery_last_checked_at timestamptz;

alter table public.leads
  drop constraint if exists leads_meta_ads_status_check,
  add constraint leads_meta_ads_status_check
    check (meta_ads_status is null or meta_ads_status in ('active_signal', 'no_signal_detected', 'unverified', 'manual_check_required', 'source_unavailable')),
  drop constraint if exists leads_google_ads_status_check,
  add constraint leads_google_ads_status_check
    check (google_ads_status is null or google_ads_status in ('active_signal', 'no_signal_detected', 'unverified', 'manual_check_required', 'source_unavailable')),
  drop constraint if exists leads_meta_ads_verified_status_check,
  add constraint leads_meta_ads_verified_status_check
    check (meta_ads_verified_status is null or meta_ads_verified_status in ('active', 'inactive')),
  drop constraint if exists leads_google_ads_verified_status_check,
  add constraint leads_google_ads_verified_status_check
    check (google_ads_verified_status is null or google_ads_verified_status in ('active', 'inactive'));

create index if not exists leads_opportunity_score_idx on public.leads(opportunity_score desc nulls last);
create index if not exists leads_neighborhood_idx on public.leads(neighborhood);
create index if not exists leads_discovery_last_checked_idx on public.leads(discovery_last_checked_at);
