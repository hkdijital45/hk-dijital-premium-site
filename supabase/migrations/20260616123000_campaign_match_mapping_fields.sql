alter table if exists public.campaigns
  add column if not exists meta_campaign_id text,
  add column if not exists source text,
  add column if not exists external_id text,
  add column if not exists settings jsonb default '{}'::jsonb;

alter table if exists public.campaign_metrics
  add column if not exists meta_campaign_id text,
  add column if not exists campaign_name text,
  add column if not exists source text default 'Manuel',
  add column if not exists raw_data jsonb default '{}'::jsonb;

create index if not exists campaigns_meta_campaign_id_idx on public.campaigns(meta_campaign_id);
create index if not exists campaigns_external_id_idx on public.campaigns(external_id);
create index if not exists campaigns_source_idx on public.campaigns(source);
create index if not exists campaign_metrics_meta_campaign_id_idx on public.campaign_metrics(meta_campaign_id);
