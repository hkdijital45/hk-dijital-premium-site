-- Sales operating system upgrade: pipeline metadata and proposal document notes.
alter table if exists public.leads
  add column if not exists pipeline_stage text,
  add column if not exists last_contact_at timestamptz,
  add column if not exists next_action_at timestamptz,
  add column if not exists next_action text;

alter table if exists public.customer_documents
  add column if not exists description text;

create index if not exists leads_pipeline_stage_idx on public.leads(pipeline_stage);
create index if not exists leads_last_contact_at_idx on public.leads(last_contact_at);
create index if not exists leads_next_action_at_idx on public.leads(next_action_at);
create index if not exists customer_documents_document_type_idx on public.customer_documents(document_type);
