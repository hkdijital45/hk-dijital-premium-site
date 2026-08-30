-- Phase 4: Contract/SLA manager, white-label portal config, autonomous
-- lead-gen first-touch drafts, and internal agency benchmarking.

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  start_date date not null,
  end_date date not null,
  auto_renew boolean not null default false,
  status text not null default 'active' check (status in ('draft', 'active', 'expiring', 'expired', 'terminated')),
  renewal_opportunity_id uuid references public.upsell_opportunities(id) on delete set null,
  document_id uuid references public.customer_documents(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sla_definitions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  sla_type text not null check (sla_type in ('report_delivery', 'response_time', 'optimization_frequency', 'content_delivery', 'custom')),
  description text not null,
  target_value text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sla_events (
  id uuid primary key default gen_random_uuid(),
  sla_definition_id uuid not null references public.sla_definitions(id) on delete cascade,
  event_type text not null default 'breach' check (event_type in ('breach', 'met', 'warning')),
  detected_at timestamptz not null default timezone('utc', now()),
  detail text,
  task_id uuid references public.agency_tasks(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.portal_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  logo_url text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text check (secondary_color is null or secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  enabled_modules text[] not null default '{}',
  subdomain text unique,
  custom_domain text unique,
  domain_verification_status text not null default 'unverified' check (domain_verification_status in ('unverified', 'pending', 'verified', 'failed')),
  domain_verification_token text,
  status text not null default 'draft' check (status in ('draft', 'active', 'disabled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  channel text not null default 'email' check (channel in ('email', 'whatsapp', 'other')),
  recommended_service text,
  message_draft text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent', 'rejected', 'opted_out')),
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.benchmark_snapshots (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (period_start, period_end)
);

create index if not exists contracts_company_idx on public.contracts (company_id, status);
create index if not exists contracts_end_date_idx on public.contracts (end_date) where status = 'active';
create index if not exists sla_events_definition_idx on public.sla_events (sla_definition_id, detected_at desc);
create index if not exists outreach_drafts_lead_idx on public.outreach_drafts (lead_id);
create index if not exists outreach_drafts_status_idx on public.outreach_drafts (status, created_at desc);
create index if not exists benchmark_snapshots_period_idx on public.benchmark_snapshots (period_start desc);

drop trigger if exists contracts_set_updated_at on public.contracts;
create trigger contracts_set_updated_at before update on public.contracts for each row execute function public.set_blog_updated_at();

drop trigger if exists portal_configs_set_updated_at on public.portal_configs;
create trigger portal_configs_set_updated_at before update on public.portal_configs for each row execute function public.set_blog_updated_at();

alter table public.contracts enable row level security;
alter table public.sla_definitions enable row level security;
alter table public.sla_events enable row level security;
alter table public.portal_configs enable row level security;
alter table public.outreach_drafts enable row level security;
alter table public.benchmark_snapshots enable row level security;

drop policy if exists "Staff can manage contracts" on public.contracts;
create policy "Staff can manage contracts" on public.contracts for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage sla definitions" on public.sla_definitions;
create policy "Staff can manage sla definitions" on public.sla_definitions for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage sla events" on public.sla_events;
create policy "Staff can manage sla events" on public.sla_events for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage portal configs" on public.portal_configs;
create policy "Staff can manage portal configs" on public.portal_configs for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Customer can read own portal config" on public.portal_configs;
create policy "Customer can read own portal config" on public.portal_configs for select using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.company_id = portal_configs.company_id and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage outreach drafts" on public.outreach_drafts;
create policy "Staff can manage outreach drafts" on public.outreach_drafts for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage benchmark snapshots" on public.benchmark_snapshots;
create policy "Staff can manage benchmark snapshots" on public.benchmark_snapshots for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
