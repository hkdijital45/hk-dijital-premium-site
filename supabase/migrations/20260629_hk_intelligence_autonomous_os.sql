-- HK Intelligence Phase 4 - Autonomous Agency Operating System
-- Idempotent, non-destructive schema additions.

create table if not exists public.hk_intelligence_ceo_runs (
  id uuid primary key default gen_random_uuid(),
  command_text text not null,
  target_company_id uuid references public.companies(id) on delete set null,
  status text default 'draft',
  priority text default 'normal',
  agent_plan jsonb default '[]'::jsonb,
  final_report jsonb default '{}'::jsonb,
  risk_summary jsonb default '{}'::jsonb,
  recommendation_summary jsonb default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.hk_virtual_agents (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null unique,
  agent_name text not null,
  role_label text not null,
  status text default 'ready',
  current_task text,
  success_rate numeric default 0,
  last_run_at timestamptz,
  estimated_monthly_cost numeric default 0,
  preferred_provider text default 'auto',
  capabilities jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.hk_ai_operations_calendar (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  operation_type text not null,
  frequency text default 'weekly',
  weekday integer,
  scheduled_time text,
  target_company_id uuid references public.companies(id) on delete set null,
  assigned_agent_key text references public.hk_virtual_agents(agent_key) on delete set null,
  is_active boolean default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.hk_risk_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  risk_key text not null,
  title text not null,
  severity text default 'info',
  source_module text,
  status text default 'open',
  detected_at timestamptz default now(),
  resolved_at timestamptz,
  recommendation text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.competitor_watchlist (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  competitor_name text not null,
  website_url text,
  instagram_url text,
  google_maps_url text,
  watch_topics jsonb default '[]'::jsonb,
  last_checked_at timestamptz,
  last_summary text,
  status text default 'active',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.hk_recommendations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  recommendation_type text not null,
  expected_impact text,
  difficulty text,
  estimated_duration text,
  estimated_cost numeric default 0,
  success_probability integer default 0,
  status text default 'open',
  source text default 'hk_intelligence',
  created_by_run_id uuid references public.hk_intelligence_ceo_runs(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.customer_branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  branch_name text not null,
  city text,
  district text,
  address text,
  meta_ad_account_id text,
  google_ads_customer_id text,
  ga4_property_id text,
  setup_status jsonb default '{}'::jsonb,
  kpi_snapshot jsonb default '{}'::jsonb,
  ai_notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists hk_intelligence_ceo_runs_company_idx on public.hk_intelligence_ceo_runs(target_company_id);
create index if not exists hk_intelligence_ceo_runs_status_idx on public.hk_intelligence_ceo_runs(status);
create index if not exists hk_virtual_agents_status_idx on public.hk_virtual_agents(status);
create index if not exists hk_ai_operations_calendar_active_idx on public.hk_ai_operations_calendar(is_active, next_run_at);
create index if not exists hk_risk_events_company_idx on public.hk_risk_events(company_id);
create index if not exists hk_risk_events_status_idx on public.hk_risk_events(status, severity);
create index if not exists competitor_watchlist_company_idx on public.competitor_watchlist(company_id);
create index if not exists hk_recommendations_company_idx on public.hk_recommendations(company_id);
create index if not exists hk_recommendations_status_idx on public.hk_recommendations(status);
create index if not exists customer_branches_company_idx on public.customer_branches(company_id);

alter table public.hk_intelligence_ceo_runs enable row level security;
alter table public.hk_virtual_agents enable row level security;
alter table public.hk_ai_operations_calendar enable row level security;
alter table public.hk_risk_events enable row level security;
alter table public.competitor_watchlist enable row level security;
alter table public.hk_recommendations enable row level security;
alter table public.customer_branches enable row level security;

insert into public.hk_virtual_agents (agent_key, agent_name, role_label, status, current_task, success_rate, preferred_provider, capabilities)
values
  ('ceo', 'CEO', 'HK Intelligence CEO', 'ready', 'AI ajanlarını yönetir ve final raporu üretir.', 92, 'auto', '["orchestration","final_layer","risk_review"]'::jsonb),
  ('sales_manager', 'Satış Müdürü', 'Satış ve teklif lideri', 'ready', 'Lead, teklif ve takip önceliği çıkarır.', 88, 'openai', '["sales","proposal","followup"]'::jsonb),
  ('crm_specialist', 'CRM Uzmanı', 'CRM ve takip uzmanı', 'ready', 'Lead segmentasyonu ve takip planı hazırlar.', 86, 'gemini', '["crm","segmentation","timeline"]'::jsonb),
  ('google_ads_specialist', 'Google Ads Uzmanı', 'Google Ads ve Search Console uzmanı', 'ready', 'Google Ads, Search Console ve GA4 sinyallerini yorumlar.', 84, 'gemini', '["google_ads","ga4","search_console"]'::jsonb),
  ('meta_ads_specialist', 'Meta Ads Uzmanı', 'Meta Ads ve Pixel uzmanı', 'ready', 'Pixel, Dataset ve kreatif performansını izler.', 84, 'openai', '["meta_ads","pixel","creative_performance"]'::jsonb),
  ('seo_specialist', 'SEO Uzmanı', 'SEO ve teknik görünürlük uzmanı', 'ready', 'SEO, sitemap, robots ve Core Web Vitals risklerini izler.', 82, 'gemini', '["seo","technical_audit","content_gap"]'::jsonb),
  ('creative_director', 'Creative Director', 'Kreatif strateji lideri', 'ready', 'Kreatif konsept, format ve kampanya dilini belirler.', 83, 'claude', '["creative","copy","campaign_language"]'::jsonb),
  ('finance_manager', 'Finance Manager', 'Tahsilat ve karlılık yöneticisi', 'ready', 'Tahsilat, MRR, ARR, LTV ve riskli gelirleri takip eder.', 87, 'auto', '["finance","collections","profitability"]'::jsonb),
  ('reporting_manager', 'Reporting Manager', 'Raporlama yöneticisi', 'ready', 'Müşteri raporlarını ve yönetici özetlerini üretir.', 86, 'claude', '["reports","executive_summary","customer_message"]'::jsonb)
on conflict (agent_key) do update set
  agent_name = excluded.agent_name,
  role_label = excluded.role_label,
  current_task = excluded.current_task,
  success_rate = excluded.success_rate,
  preferred_provider = excluded.preferred_provider,
  capabilities = excluded.capabilities,
  updated_at = now();

insert into public.hk_ai_operations_calendar (title, operation_type, frequency, weekday, scheduled_time, assigned_agent_key, metadata)
values
  ('Pazartesi rakip ve SEO kontrolü', 'weekly_competitor_seo_review', 'weekly', 1, '09:00', 'seo_specialist', '{"items":["Rakip analizi","SEO kontrolü","Search Console hataları"]}'::jsonb),
  ('Salı Google Ads ve lead kontrolü', 'weekly_google_sales_review', 'weekly', 2, '09:00', 'google_ads_specialist', '{"items":["Google Ads kontrolü","Lead arama","Teklif hazırlığı"]}'::jsonb),
  ('Çarşamba tahsilat ve CRM kontrolü', 'weekly_finance_crm_review', 'weekly', 3, '10:00', 'finance_manager', '{"items":["Tahsilat kontrolü","CRM güncelleme","Takip görevleri"]}'::jsonb),
  ('Cuma haftalık rapor ve öğrenme', 'weekly_report_learning_review', 'weekly', 5, '16:00', 'reporting_manager', '{"items":["Haftalık rapor","AI öğrenme kayıtları","Risk özeti"]}'::jsonb)
on conflict do nothing;

notify pgrst, 'reload schema';
