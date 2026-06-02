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
