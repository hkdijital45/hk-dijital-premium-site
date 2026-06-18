create table if not exists public.meta_adset_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  campaign_id uuid,
  meta_campaign_id text,
  meta_adset_id text,
  adset_name text,
  date date,
  spend numeric default 0,
  impressions numeric default 0,
  reach numeric default 0,
  clicks numeric default 0,
  ctr numeric default 0,
  cpc numeric default 0,
  cpm numeric default 0,
  results numeric default 0,
  leads numeric default 0,
  purchases numeric default 0,
  messages numeric default 0,
  targeting_summary jsonb default '{}'::jsonb,
  age_breakdown jsonb default '[]'::jsonb,
  gender_breakdown jsonb default '[]'::jsonb,
  location_breakdown jsonb default '[]'::jsonb,
  placement_breakdown jsonb default '[]'::jsonb,
  start_time timestamptz,
  stop_time timestamptz,
  daily_budget numeric default 0,
  lifetime_budget numeric default 0,
  optimization_goal text,
  status text,
  days_running integer,
  days_remaining integer,
  budget_consumption_percentage numeric default 0,
  estimated_finish_date date,
  raw_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.meta_ad_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  campaign_id uuid,
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  ad_name text,
  creative_id text,
  creative_thumbnail_url text,
  creative_media_url text,
  ad_text text,
  headline text,
  description text,
  cta text,
  destination_url text,
  date date,
  spend numeric default 0,
  impressions numeric default 0,
  reach numeric default 0,
  clicks numeric default 0,
  ctr numeric default 0,
  cpc numeric default 0,
  cpm numeric default 0,
  results numeric default 0,
  leads numeric default 0,
  purchases numeric default 0,
  add_to_cart numeric default 0,
  checkout numeric default 0,
  messages numeric default 0,
  purchase_value numeric default 0,
  roas numeric default 0,
  cost_per_lead numeric default 0,
  cost_per_purchase numeric default 0,
  video_views numeric default 0,
  video_3s_views numeric default 0,
  video_thruplay numeric default 0,
  video_p25 numeric default 0,
  video_p50 numeric default 0,
  video_p75 numeric default 0,
  video_p95 numeric default 0,
  average_watch_time numeric default 0,
  thumb_stop_rate numeric default 0,
  start_time timestamptz,
  stop_time timestamptz,
  created_time timestamptz,
  updated_time timestamptz,
  status text,
  days_running integer,
  days_remaining integer,
  raw_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.meta_conversion_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  campaign_id uuid,
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  event_name text,
  event_value numeric default 0,
  event_count numeric default 0,
  cost_per_event numeric default 0,
  date date,
  raw_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.meta_analysis_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  campaign_id uuid,
  period_start date,
  period_end date,
  best_creative jsonb default '{}'::jsonb,
  weakest_creative jsonb default '{}'::jsonb,
  best_campaign jsonb default '{}'::jsonb,
  weakest_campaign jsonb default '{}'::jsonb,
  budget_recommendation text,
  pause_recommendations jsonb default '[]'::jsonb,
  scale_recommendations jsonb default '[]'::jsonb,
  audience_recommendation text,
  creative_recommendation text,
  funnel_diagnosis text,
  ai_summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.customer_report_visibility (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  section_key text,
  metric_key text,
  is_visible boolean default true,
  display_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(company_id, section_key, metric_key)
);

alter table if exists public.meta_adset_metrics add column if not exists campaign_id uuid;
alter table if exists public.meta_adset_metrics add column if not exists targeting_summary jsonb default '{}'::jsonb;
alter table if exists public.meta_adset_metrics add column if not exists age_breakdown jsonb default '[]'::jsonb;
alter table if exists public.meta_adset_metrics add column if not exists gender_breakdown jsonb default '[]'::jsonb;
alter table if exists public.meta_adset_metrics add column if not exists location_breakdown jsonb default '[]'::jsonb;
alter table if exists public.meta_adset_metrics add column if not exists placement_breakdown jsonb default '[]'::jsonb;
alter table if exists public.meta_adset_metrics add column if not exists start_time timestamptz;
alter table if exists public.meta_adset_metrics add column if not exists stop_time timestamptz;
alter table if exists public.meta_adset_metrics add column if not exists daily_budget numeric default 0;
alter table if exists public.meta_adset_metrics add column if not exists lifetime_budget numeric default 0;
alter table if exists public.meta_adset_metrics add column if not exists optimization_goal text;
alter table if exists public.meta_adset_metrics add column if not exists status text;
alter table if exists public.meta_adset_metrics add column if not exists days_running integer;
alter table if exists public.meta_adset_metrics add column if not exists days_remaining integer;
alter table if exists public.meta_adset_metrics add column if not exists budget_consumption_percentage numeric default 0;
alter table if exists public.meta_adset_metrics add column if not exists estimated_finish_date date;
alter table if exists public.meta_adset_metrics add column if not exists raw_data jsonb default '{}'::jsonb;

alter table if exists public.meta_ad_metrics add column if not exists campaign_id uuid;
alter table if exists public.meta_ad_metrics add column if not exists creative_id text;
alter table if exists public.meta_ad_metrics add column if not exists creative_thumbnail_url text;
alter table if exists public.meta_ad_metrics add column if not exists creative_media_url text;
alter table if exists public.meta_ad_metrics add column if not exists ad_text text;
alter table if exists public.meta_ad_metrics add column if not exists headline text;
alter table if exists public.meta_ad_metrics add column if not exists description text;
alter table if exists public.meta_ad_metrics add column if not exists cta text;
alter table if exists public.meta_ad_metrics add column if not exists destination_url text;
alter table if exists public.meta_ad_metrics add column if not exists purchases numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists add_to_cart numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists checkout numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists purchase_value numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists roas numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists cost_per_lead numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists cost_per_purchase numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists video_views numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists video_3s_views numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists video_thruplay numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists video_p25 numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists video_p50 numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists video_p75 numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists video_p95 numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists average_watch_time numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists thumb_stop_rate numeric default 0;
alter table if exists public.meta_ad_metrics add column if not exists created_time timestamptz;
alter table if exists public.meta_ad_metrics add column if not exists updated_time timestamptz;
alter table if exists public.meta_ad_metrics add column if not exists status text;
alter table if exists public.meta_ad_metrics add column if not exists days_running integer;
alter table if exists public.meta_ad_metrics add column if not exists days_remaining integer;
alter table if exists public.meta_ad_metrics add column if not exists raw_data jsonb default '{}'::jsonb;

alter table if exists public.meta_conversion_events add column if not exists campaign_id uuid;
alter table if exists public.meta_conversion_events add column if not exists cost_per_event numeric default 0;
alter table if exists public.meta_conversion_events add column if not exists raw_data jsonb default '{}'::jsonb;

alter table if exists public.customer_report_visibility add column if not exists section_key text;
alter table if exists public.customer_report_visibility add column if not exists metric_key text;
alter table if exists public.customer_report_visibility add column if not exists is_visible boolean default true;
alter table if exists public.customer_report_visibility add column if not exists display_order integer default 0;

alter table if exists public.campaigns add column if not exists meta_campaign_id text;
alter table if exists public.campaigns add column if not exists external_id text;
alter table if exists public.campaigns add column if not exists source text;
alter table if exists public.campaigns add column if not exists settings jsonb default '{}'::jsonb;
alter table if exists public.campaigns add column if not exists meta_start_time timestamptz;
alter table if exists public.campaigns add column if not exists meta_stop_time timestamptz;
alter table if exists public.campaigns add column if not exists meta_created_time timestamptz;
alter table if exists public.campaigns add column if not exists meta_updated_time timestamptz;
alter table if exists public.campaigns add column if not exists days_running integer;
alter table if exists public.campaigns add column if not exists days_remaining integer;
alter table if exists public.campaigns add column if not exists budget_consumption_percentage numeric default 0;
alter table if exists public.campaigns add column if not exists estimated_finish_date date;

alter table if exists public.campaign_metrics add column if not exists roas numeric default 0;
alter table if exists public.campaign_metrics add column if not exists purchases numeric default 0;
alter table if exists public.campaign_metrics add column if not exists add_to_cart numeric default 0;
alter table if exists public.campaign_metrics add column if not exists checkout numeric default 0;
alter table if exists public.campaign_metrics add column if not exists purchase_value numeric default 0;
alter table if exists public.campaign_metrics add column if not exists cost_per_purchase numeric default 0;
alter table if exists public.campaign_metrics add column if not exists raw_data jsonb default '{}'::jsonb;

create index if not exists idx_meta_adset_metrics_company on public.meta_adset_metrics(company_id);
create index if not exists idx_meta_adset_metrics_campaign on public.meta_adset_metrics(campaign_id);
create index if not exists idx_meta_adset_metrics_meta_campaign on public.meta_adset_metrics(meta_campaign_id);
create index if not exists idx_meta_adset_metrics_date on public.meta_adset_metrics(date);
create index if not exists idx_meta_ad_metrics_company on public.meta_ad_metrics(company_id);
create index if not exists idx_meta_ad_metrics_campaign on public.meta_ad_metrics(campaign_id);
create index if not exists idx_meta_ad_metrics_meta_campaign on public.meta_ad_metrics(meta_campaign_id);
create index if not exists idx_meta_ad_metrics_date on public.meta_ad_metrics(date);
create index if not exists idx_meta_conversion_events_company on public.meta_conversion_events(company_id);
create index if not exists idx_meta_conversion_events_date on public.meta_conversion_events(date);
create index if not exists idx_meta_analysis_snapshots_company on public.meta_analysis_snapshots(company_id);
create index if not exists idx_customer_report_visibility_company on public.customer_report_visibility(company_id);
delete from public.customer_report_visibility a
using public.customer_report_visibility b
where a.ctid < b.ctid
  and a.company_id is not distinct from b.company_id
  and a.section_key is not distinct from b.section_key
  and a.metric_key is not distinct from b.metric_key;
create unique index if not exists idx_customer_report_visibility_unique on public.customer_report_visibility(company_id, section_key, metric_key);
