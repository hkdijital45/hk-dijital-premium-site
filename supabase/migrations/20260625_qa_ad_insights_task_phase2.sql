create table if not exists public.agency_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  description text,
  status text default 'Yapılacak',
  priority text default 'Normal',
  due_date date,
  assigned_user_id uuid references public.users(id) on delete set null,
  visible_to_customer boolean not null default false,
  completed_at timestamptz,
  archived_at timestamptz,
  lead_id uuid references public.leads(id) on delete set null,
  automation_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.agency_tasks
  add column if not exists sort_order integer default 0,
  add column if not exists parent_task_id uuid references public.agency_tasks(id) on delete cascade,
  add column if not exists is_subtask boolean default false,
  add column if not exists recurring_rule text,
  add column if not exists recurring_interval integer,
  add column if not exists recurring_until date,
  add column if not exists reminder_at timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists template_key text,
  add column if not exists ai_generated boolean default false,
  add column if not exists metadata jsonb default '{}'::jsonb;

create table if not exists public.ad_insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.companies(id) on delete cascade,
  platform text not null default 'all',
  account_id text,
  date_from date,
  date_to date,
  metrics jsonb not null default '{}'::jsonb,
  insights jsonb not null default '{}'::jsonb,
  health_score integer not null default 0,
  source_type text not null default 'Demo veri',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.ad_insight_snapshots
  add column if not exists previous_metrics jsonb default '{}'::jsonb,
  add column if not exists weekly_change jsonb default '{}'::jsonb,
  add column if not exists wasted_budget_estimate numeric default 0,
  add column if not exists best_ad jsonb default '{}'::jsonb,
  add column if not exists worst_ad jsonb default '{}'::jsonb,
  add column if not exists winning_creative jsonb default '{}'::jsonb,
  add column if not exists action_recommendations jsonb default '[]'::jsonb;

create table if not exists public.qa_audit_findings (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  severity text not null default 'info',
  module text,
  file_path text,
  title text not null,
  description text,
  recommendation text,
  status text not null default 'Açık',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agency_tasks_company_sort_order_idx on public.agency_tasks(company_id, sort_order);
create index if not exists agency_tasks_parent_task_id_idx on public.agency_tasks(parent_task_id);
create index if not exists agency_tasks_reminder_at_idx on public.agency_tasks(reminder_at);
create index if not exists agency_tasks_template_key_idx on public.agency_tasks(template_key);
create index if not exists ad_insight_snapshots_customer_date_idx on public.ad_insight_snapshots(customer_id, date_from, date_to);
create index if not exists qa_audit_findings_category_severity_idx on public.qa_audit_findings(category, severity);
create index if not exists qa_audit_findings_created_at_idx on public.qa_audit_findings(created_at desc);

notify pgrst, 'reload schema';
