alter table if exists public.companies
  add column if not exists custom_sector text,
  add column if not exists contact_name text,
  add column if not exists authorized_person text,
  add column if not exists sales_status text,
  add column if not exists pipeline_stage text,
  add column if not exists last_contact_at timestamptz,
  add column if not exists next_action_at timestamptz,
  add column if not exists next_action text,
  add column if not exists follow_up_note text;

create index if not exists companies_pipeline_stage_idx
  on public.companies(pipeline_stage);

create index if not exists companies_next_action_at_idx
  on public.companies(next_action_at);

notify pgrst, 'reload schema';
