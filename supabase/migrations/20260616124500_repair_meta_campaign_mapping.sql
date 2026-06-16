alter table if exists public.campaigns
  add column if not exists meta_campaign_id text,
  add column if not exists source text,
  add column if not exists external_id text,
  add column if not exists settings jsonb default '{}'::jsonb;

alter table if exists public.campaign_metrics
  add column if not exists meta_campaign_id text,
  add column if not exists campaign_name text,
  add column if not exists source text default 'Manuel',
  add column if not exists spend numeric default 0,
  add column if not exists raw_data jsonb default '{}'::jsonb;

update public.campaigns c
set
  meta_campaign_id = cm.meta_campaign_id,
  external_id = cm.meta_campaign_id,
  source = coalesce(c.source, 'Meta'),
  settings = coalesce(c.settings, '{}'::jsonb) || jsonb_build_object('meta_campaign_id', cm.meta_campaign_id, 'mapping_repaired_at', now()),
  updated_at = now()
from (
  select distinct company_id, campaign_name, meta_campaign_id
  from public.campaign_metrics
  where meta_campaign_id is not null
    and campaign_name is not null
    and campaign_name <> ''
) cm
where c.name = cm.campaign_name
  and (c.company_id = cm.company_id or c.company_id is null)
  and c.meta_campaign_id is null;

create index if not exists campaigns_meta_campaign_id_idx on public.campaigns(meta_campaign_id);
create index if not exists campaigns_external_id_idx on public.campaigns(external_id);
create index if not exists campaign_metrics_meta_campaign_id_idx on public.campaign_metrics(meta_campaign_id);
