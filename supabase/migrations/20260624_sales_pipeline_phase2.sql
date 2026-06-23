-- HK Intelligence sales pipeline phase 2 metadata and task automation links.
alter table if exists public.leads
  add column if not exists proposal_status text,
  add column if not exists proposal_amount numeric default 0,
  add column if not exists estimated_close_date date,
  add column if not exists last_whatsapp_at timestamptz,
  add column if not exists meeting_at timestamptz,
  add column if not exists proposal_sent_at timestamptz,
  add column if not exists calendar_follow_up_at timestamptz;

alter table if exists public.agency_tasks
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists automation_key text;

create index if not exists leads_proposal_status_idx
  on public.leads(proposal_status);
create index if not exists leads_estimated_close_date_idx
  on public.leads(estimated_close_date);
create index if not exists leads_last_whatsapp_at_idx
  on public.leads(last_whatsapp_at);
create index if not exists agency_tasks_lead_id_idx
  on public.agency_tasks(lead_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agency_tasks_automation_key_unique'
      and conrelid = 'public.agency_tasks'::regclass
  ) then
    alter table public.agency_tasks
      add constraint agency_tasks_automation_key_unique unique (automation_key);
  end if;
end $$;
