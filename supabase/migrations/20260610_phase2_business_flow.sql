alter table public.leads
  add column if not exists digital_maturity_score integer default 0,
  add column if not exists lead_heat_score integer default 0,
  add column if not exists ai_analysis jsonb default '{}'::jsonb,
  add column if not exists proposal_history jsonb default '[]'::jsonb,
  add column if not exists city text,
  add column if not exists district text,
  add column if not exists sector text,
  add column if not exists address text,
  add column if not exists google_rating numeric,
  add column if not exists google_review_count integer default 0,
  add column if not exists google_place_id text,
  add column if not exists source_url text,
  add column if not exists competitor_notes text,
  add column if not exists local_opportunity_notes text,
  add column if not exists deleted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

create table if not exists public.ad_integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('meta', 'google')),
  company_id uuid references public.companies(id) on delete cascade,
  business_account_id text,
  ad_account_id text,
  page_id text,
  instagram_account_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  auto_sync boolean default false,
  status text default 'Eksik bilgi',
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(provider, company_id, ad_account_id)
);

create index if not exists ad_integrations_provider_idx on public.ad_integrations(provider, updated_at desc);
create index if not exists ad_integrations_company_id_idx on public.ad_integrations(company_id);

alter table public.ad_integrations enable row level security;
