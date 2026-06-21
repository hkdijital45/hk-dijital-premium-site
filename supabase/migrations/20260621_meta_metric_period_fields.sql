alter table if exists public.campaign_metrics
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists date_range_label text;

alter table if exists public.meta_adset_metrics
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists date_range_label text;

alter table if exists public.meta_ad_metrics
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists date_range_label text;

create index if not exists idx_campaign_metrics_period_range
  on public.campaign_metrics(company_id, source, period_start, period_end);

create index if not exists idx_meta_adset_metrics_period_range
  on public.meta_adset_metrics(company_id, period_start, period_end);

create index if not exists idx_meta_ad_metrics_period_range
  on public.meta_ad_metrics(company_id, period_start, period_end);
