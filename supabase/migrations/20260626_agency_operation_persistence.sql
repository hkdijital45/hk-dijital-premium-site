-- Agency operation persistence, proposal follow-up, segmentation and targets.
create table if not exists public.agency_opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.companies(id) on delete set null,
  sector text,
  sub_sector text,
  city text,
  district text,
  priority_score integer default 0,
  priority_level text,
  pipeline_status text default 'Keşfedildi',
  estimated_monthly_revenue numeric default 0,
  estimated_ad_budget numeric default 0,
  close_probability integer default 0,
  estimated_sales_cycle text,
  assigned_to text,
  next_recommended_action text,
  ai_reason text,
  ltv_estimate numeric default 0,
  last_call_at timestamptz,
  last_offer_at timestamptz,
  last_meeting_at timestamptz,
  last_note_at timestamptz,
  won_lost_status text,
  won_lost_reason text,
  data_source text default 'Tahmini veri',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.agency_opportunity_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.agency_opportunities(id) on delete cascade,
  event_type text,
  title text,
  description text,
  metadata jsonb default '{}'::jsonb,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists public.agency_daily_tasks (
  id uuid primary key default gen_random_uuid(),
  task_date date,
  title text,
  description text,
  related_opportunity_id uuid references public.agency_opportunities(id) on delete set null,
  status text default 'open',
  priority text,
  action_type text,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.agency_targets (
  id uuid primary key default gen_random_uuid(),
  month text,
  target_revenue numeric default 50000,
  target_customers integer default 3,
  target_offers integer default 10,
  target_meetings integer default 8,
  target_collections numeric default 50000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.agency_learning_signals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.agency_opportunities(id) on delete set null,
  sector text,
  city text,
  package_name text,
  ad_budget numeric default 0,
  service_fee numeric default 0,
  outcome text,
  loss_reason text,
  close_days integer default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.proposal_followups (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.agency_opportunities(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.companies(id) on delete set null,
  proposal_title text,
  proposal_amount numeric default 0,
  status text default 'Yanıt bekliyor',
  sent_at timestamptz,
  first_followup_at timestamptz,
  second_followup_at timestamptz,
  final_followup_at timestamptz,
  next_followup_at timestamptz,
  last_followup_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists public.leads
  add column if not exists segment text,
  add column if not exists close_probability integer default 0,
  add column if not exists won_lost_reason text,
  add column if not exists source_opportunity_id uuid references public.agency_opportunities(id) on delete set null;

create index if not exists agency_opportunities_pipeline_idx on public.agency_opportunities(pipeline_status);
create index if not exists agency_opportunities_sector_city_idx on public.agency_opportunities(sector, city);
create index if not exists agency_opportunities_updated_at_idx on public.agency_opportunities(updated_at desc);
create index if not exists agency_opportunity_events_opportunity_idx on public.agency_opportunity_events(opportunity_id, created_at desc);
create index if not exists agency_daily_tasks_date_status_idx on public.agency_daily_tasks(task_date, status);
create index if not exists agency_targets_month_idx on public.agency_targets(month);
create index if not exists agency_learning_signals_sector_outcome_idx on public.agency_learning_signals(sector, outcome);
create index if not exists proposal_followups_next_idx on public.proposal_followups(next_followup_at, status);
create index if not exists proposal_followups_opportunity_idx on public.proposal_followups(opportunity_id);
create index if not exists leads_segment_idx on public.leads(segment);

alter table public.agency_opportunities enable row level security;
alter table public.agency_opportunity_events enable row level security;
alter table public.agency_daily_tasks enable row level security;
alter table public.agency_targets enable row level security;
alter table public.agency_learning_signals enable row level security;
alter table public.proposal_followups enable row level security;

notify pgrst, 'reload schema';
