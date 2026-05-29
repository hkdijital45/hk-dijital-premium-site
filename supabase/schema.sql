create extension if not exists "pgcrypto";

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text,
  city text,
  website text,
  instagram text,
  phone text,
  email text,
  status text default 'Aktif',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  role text not null check (role in ('admin', 'editor', 'sales', 'customer')),
  company_id uuid references public.companies(id) on delete set null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text,
  content jsonb not null default '{}'::jsonb,
  seo_title text,
  seo_description text,
  is_active boolean default true,
  updated_at timestamptz default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  icon text,
  image_url text,
  sort_order integer default 0,
  is_active boolean default true,
  updated_at timestamptz default now()
);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  price text,
  description text,
  features jsonb not null default '[]'::jsonb,
  cta_text text,
  image_url text,
  is_recommended boolean default false,
  sort_order integer default 0,
  is_active boolean default true,
  updated_at timestamptz default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  institution text,
  date text,
  description text,
  file_url text,
  verification_url text,
  sort_order integer default 0,
  is_active boolean default true,
  updated_at timestamptz default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  source text,
  company_id uuid references public.companies(id) on delete set null,
  name text,
  company text,
  phone text,
  email text,
  instagram text,
  website text,
  business_type text,
  goal text,
  budget text,
  recommended_package text,
  message text,
  status text default 'Yeni',
  notes text,
  follow_up_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.media_files (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  file_url text,
  file_type text,
  file_size bigint,
  uploaded_at timestamptz default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  platform text,
  objective text,
  status text default 'Hazırlanıyor',
  start_date date,
  end_date date,
  budget numeric default 0,
  spent numeric default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  date date,
  impressions integer default 0,
  reach integer default 0,
  clicks integer default 0,
  ctr numeric default 0,
  cpc numeric default 0,
  cpm numeric default 0,
  leads integer default 0,
  conversions integer default 0,
  cost_per_lead numeric default 0,
  spent numeric default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.customer_updates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  description text,
  update_type text check (update_type in ('Yapılan Çalışma', 'Reklam Güncellemesi', 'Rapor Notu', 'Strateji Notu', 'Uyarı', 'Başarı')),
  visible_to_customer boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.customer_visibility_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid unique references public.companies(id) on delete cascade,
  show_campaigns boolean default true,
  show_metrics boolean default true,
  show_budget boolean default true,
  show_spent boolean default true,
  show_leads boolean default true,
  show_strategy_notes boolean default true,
  show_work_updates boolean default true,
  show_files boolean default true,
  show_contact_person boolean default true,
  updated_at timestamptz default now()
);

create table if not exists public.customer_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  description text,
  file_url text,
  file_type text,
  visible_to_customer boolean default true,
  uploaded_at timestamptz default now()
);

create table if not exists public.api_settings (
  id uuid primary key default gen_random_uuid(),
  provider text,
  encrypted_or_masked_key text,
  model text,
  is_active boolean default false,
  demo_mode boolean default true,
  updated_at timestamptz default now()
);

insert into storage.buckets (id, name, public)
values ('hk-dijital-media', 'hk-dijital-media', true)
on conflict (id) do nothing;
