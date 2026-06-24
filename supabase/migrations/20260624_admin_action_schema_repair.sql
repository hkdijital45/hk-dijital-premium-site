-- Admin action persistence and customer onboarding schema repair.
alter table if exists public.leads
  add column if not exists pipeline_stage text,
  add column if not exists last_contact_at timestamptz,
  add column if not exists next_action_at timestamptz,
  add column if not exists next_action text,
  add column if not exists proposal_status text,
  add column if not exists proposal_amount numeric default 0,
  add column if not exists estimated_close_date date,
  add column if not exists last_whatsapp_at timestamptz,
  add column if not exists meeting_at timestamptz,
  add column if not exists proposal_sent_at timestamptz,
  add column if not exists calendar_follow_up_at timestamptz,
  add column if not exists ai_analysis jsonb default '{}'::jsonb,
  add column if not exists proposal_history jsonb default '[]'::jsonb,
  add column if not exists deleted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

alter table if exists public.agency_tasks
  add column if not exists description text,
  add column if not exists notes text,
  add column if not exists assigned_user_id uuid references public.users(id) on delete set null,
  add column if not exists visible_to_customer boolean not null default false,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists automation_key text,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.customer_branding
  add column if not exists brand_name text,
  add column if not exists logo_url text,
  add column if not exists primary_color text default '#22d3ee',
  add column if not exists secondary_color text default '#2563eb',
  add column if not exists welcome_text text,
  add column if not exists report_title text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists contact_whatsapp text,
  add column if not exists onboarding_data jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.companies
  add column if not exists lifecycle_stage text;

create index if not exists leads_calendar_follow_up_at_idx on public.leads(calendar_follow_up_at);
create index if not exists leads_next_action_at_idx on public.leads(next_action_at);
create index if not exists agency_tasks_company_status_idx on public.agency_tasks(company_id, status);
create index if not exists agency_tasks_archived_at_idx on public.agency_tasks(archived_at);
create index if not exists customer_branding_company_idx on public.customer_branding(company_id);

with duplicate_automation_keys as (
  select id, row_number() over (partition by automation_key order by updated_at desc nulls last, id) as row_number
  from public.agency_tasks
  where automation_key is not null
)
update public.agency_tasks task
set automation_key = null
from duplicate_automation_keys duplicate
where task.id = duplicate.id
  and duplicate.row_number > 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agency_tasks_automation_key_unique'
      and conrelid = 'public.agency_tasks'::regclass
  ) then
    alter table public.agency_tasks
      add constraint agency_tasks_automation_key_unique unique (automation_key);
  end if;
end $$;

notify pgrst, 'reload schema';
