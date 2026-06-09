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

-- Production auth/profile sync additions.
alter table public.users
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;

alter table public.companies
  add column if not exists notes text;

alter table public.campaigns
  add column if not exists visible_to_customer boolean default true;

alter table public.campaign_metrics
  add column if not exists messages integer default 0,
  add column if not exists visible_to_customer boolean default true,
  add column if not exists period text,
  add column if not exists source text;

alter table public.customer_updates
  add column if not exists why_it_matters text,
  add column if not exists next_step text;

-- Optional category fields used by the control center UI.
alter table public.customer_files
  add column if not exists category text;

alter table public.services
  add column if not exists category text;

alter table public.packages
  add column if not exists package_type text;

-- Allow custom update labels through the UI while keeping existing labels valid.
alter table public.customer_updates
  drop constraint if exists customer_updates_update_type_check;

alter table public.customer_updates
  add constraint customer_updates_update_type_check
  check (update_type in ('Yapılan Çalışma', 'Reklam Güncellemesi', 'Rapor Notu', 'Strateji Notu', 'Uyarı', 'Başarı', 'Diğer'));

create table if not exists public.contact_forms (
  id uuid primary key default gen_random_uuid(),
  name text,
  company text,
  phone text,
  email text,
  message text,
  source text default 'İletişim Formu',
  status text default 'Yeni',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  full_name text,
  email text,
  phone text,
  status text default 'Aktif',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Customer access tracking and agency activity history.
alter table public.users
  add column if not exists last_login_at timestamptz,
  add column if not exists login_count integer not null default 0;

alter table public.customers
  add column if not exists source_lead_id uuid references public.leads(id) on delete set null,
  add column if not exists instagram text,
  add column if not exists website text,
  add column if not exists sector text,
  add column if not exists goal text,
  add column if not exists budget text,
  add column if not exists notes text;

-- HK Intelligence CRM fields used by the integrated admin modules.
alter table public.leads
  add column if not exists digital_maturity_score integer default 0,
  add column if not exists lead_heat_score integer default 0,
  add column if not exists ai_analysis jsonb not null default '{}'::jsonb,
  add column if not exists proposal_history jsonb not null default '[]'::jsonb,
  add column if not exists city text,
  add column if not exists district text,
  add column if not exists sector text,
  add column if not exists address text,
  add column if not exists google_rating numeric,
  add column if not exists google_review_count integer default 0,
  add column if not exists google_place_id text,
  add column if not exists source_url text;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  company_id uuid references public.companies(id) on delete cascade,
  actor_name text,
  role text,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Multi-channel customer reporting. Channel-specific metrics live in JSONB so
-- the reporting model can evolve without breaking existing Meta metric rows.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  report_type text not null check (report_type in ('Meta Reklam Raporu', 'Google Ads Raporu', 'Sosyal Medya Yönetimi Raporu', 'Genel Dijital Performans Raporu')),
  platform text,
  period text,
  start_date date,
  end_date date,
  metrics jsonb not null default '{}'::jsonb,
  time_series jsonb not null default '[]'::jsonb,
  raw_extracted_data jsonb not null default '{}'::jsonb,
  internal_note text,
  customer_note text,
  sent_at timestamptz,
  visible_to_customer boolean default true,
  archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reports
  add column if not exists time_series jsonb not null default '[]'::jsonb,
  add column if not exists raw_extracted_data jsonb not null default '{}'::jsonb,
  add column if not exists sent_at timestamptz;

create table if not exists public.report_interpretations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  generated_by_user_id uuid references public.users(id) on delete set null,
  interpretation_text text not null,
  provider text not null default 'Demo',
  created_at timestamptz default now()
);

create table if not exists public.report_updates (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  update_date date not null default current_date,
  title text not null,
  category text,
  status text,
  customer_note text,
  agency_comment text,
  next_action text,
  ai_comment text,
  is_visible_to_customer boolean default true,
  is_pinned boolean default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists users_auth_user_id_idx on public.users(auth_user_id);
create index if not exists users_role_idx on public.users(role);
create index if not exists users_company_id_idx on public.users(company_id);
create index if not exists companies_status_idx on public.companies(status);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists leads_heat_score_idx on public.leads(lead_heat_score desc);
create index if not exists leads_google_place_id_idx on public.leads(google_place_id);
create index if not exists leads_source_idx on public.leads(source);
create index if not exists campaigns_company_id_idx on public.campaigns(company_id);
create index if not exists campaign_metrics_company_id_date_idx on public.campaign_metrics(company_id, date desc);
create index if not exists customer_updates_company_id_idx on public.customer_updates(company_id);
create index if not exists customer_files_company_id_idx on public.customer_files(company_id);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_company_id_idx on public.activity_logs(company_id, created_at desc);
create index if not exists activity_logs_actor_user_id_idx on public.activity_logs(actor_user_id, created_at desc);
create index if not exists reports_company_id_idx on public.reports(company_id, created_at desc);
create index if not exists reports_type_idx on public.reports(report_type, created_at desc);
create index if not exists report_interpretations_report_id_idx on public.report_interpretations(report_id, created_at desc);
create index if not exists report_updates_report_id_idx on public.report_updates(report_id, is_pinned desc, update_date desc);
create index if not exists report_updates_company_id_idx on public.report_updates(company_id, update_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at before update on public.companies for each row execute function public.set_updated_at();

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users for each row execute function public.set_updated_at();

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at before update on public.leads for each row execute function public.set_updated_at();

drop trigger if exists set_campaigns_updated_at on public.campaigns;
create trigger set_campaigns_updated_at before update on public.campaigns for each row execute function public.set_updated_at();

drop trigger if exists set_customer_updates_updated_at on public.customer_updates;
create trigger set_customer_updates_updated_at before update on public.customer_updates for each row execute function public.set_updated_at();

drop trigger if exists set_contact_forms_updated_at on public.contact_forms;
create trigger set_contact_forms_updated_at before update on public.contact_forms for each row execute function public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();

drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at before update on public.reports for each row execute function public.set_updated_at();

drop trigger if exists set_report_updates_updated_at on public.report_updates;
create trigger set_report_updates_updated_at before update on public.report_updates for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.companies enable row level security;
alter table public.leads enable row level security;
alter table public.contact_forms enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_metrics enable row level security;
alter table public.customer_updates enable row level security;
alter table public.customer_files enable row level security;
alter table public.customer_visibility_settings enable row level security;
alter table public.activity_logs enable row level security;
alter table public.reports enable row level security;
alter table public.report_interpretations enable row level security;
alter table public.report_updates enable row level security;

-- Professional admin permissions, preparation center and theme support.
alter table public.users
  add column if not exists allowed_modules jsonb not null default '[]'::jsonb,
  add column if not exists last_password_reset_at timestamptz,
  add column if not exists must_change_password boolean not null default false;

alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('admin', 'yonetici', 'editor', 'musteri', 'sales', 'customer'));

update public.users set role = 'yonetici' where role = 'sales';
update public.users set role = 'musteri' where role = 'customer';

create table if not exists public.preparation_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid unique references public.companies(id) on delete cascade,
  customer_checklist jsonb not null default '[]'::jsonb,
  campaign_checklist jsonb not null default '[]'::jsonb,
  brand_analysis text,
  swot_notes text,
  target_audience_notes text,
  offer_positioning text,
  funnel_planning text,
  content_ideas text,
  ad_angle_ideas text,
  prompt_shortcuts text,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists preparation_notes_company_id_idx on public.preparation_notes(company_id);

drop trigger if exists set_preparation_notes_updated_at on public.preparation_notes;
create trigger set_preparation_notes_updated_at before update on public.preparation_notes for each row execute function public.set_updated_at();

alter table public.preparation_notes enable row level security;

alter table public.leads
  add column if not exists competitor_notes text,
  add column if not exists local_opportunity_notes text;

-- CRM application management workflow.
alter table public.leads
  add column if not exists deleted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists status text default 'Yeni';

create index if not exists leads_deleted_at_idx on public.leads(deleted_at);
create index if not exists leads_rejected_at_idx on public.leads(rejected_at);
create index if not exists leads_status_workflow_idx on public.leads(status);
