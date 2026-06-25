-- Customer brand assets and secure Supabase Storage bucket.
create table if not exists public.customer_branding (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  logo_url text,
  brand_name text,
  primary_color text default '#22d3ee',
  secondary_color text default '#2563eb',
  welcome_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists public.customer_branding
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists brand_name text,
  add column if not exists logo_url text,
  add column if not exists logo_light_url text,
  add column if not exists logo_dark_url text,
  add column if not exists primary_color text default '#22d3ee',
  add column if not exists secondary_color text default '#2563eb',
  add column if not exists brand_accent_color text default '#f59e0b',
  add column if not exists brand_font_heading text,
  add column if not exists brand_font_body text,
  add column if not exists social_profile_image_url text,
  add column if not exists email_signature_html text,
  add column if not exists letterhead_url text,
  add column if not exists brand_notes text,
  add column if not exists brand_assets jsonb not null default '{}'::jsonb,
  add column if not exists welcome_text text,
  add column if not exists report_title text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists contact_whatsapp text,
  add column if not exists onboarding_data jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists customer_branding_company_idx on public.customer_branding(company_id);

with duplicate_branding as (
  select
    id,
    row_number() over (partition by company_id order by updated_at desc nulls last, created_at desc nulls last, id) as row_number
  from public.customer_branding
  where company_id is not null
)
update public.customer_branding branding
set
  company_id = null,
  brand_notes = concat_ws(E'\n', nullif(branding.brand_notes, ''), 'Tekrarlı marka kaydı unique constraint öncesi müşteri bağlantısından ayrıldı.'),
  updated_at = now()
from duplicate_branding duplicate
where branding.id = duplicate.id
  and duplicate.row_number > 1;

do $$
declare
  company_id_attnum smallint;
begin
  select attnum
  into company_id_attnum
  from pg_attribute
  where attrelid = 'public.customer_branding'::regclass
    and attname = 'company_id';

  if not exists (
    select 1
    from pg_constraint constraint_info
    where constraint_info.conrelid = 'public.customer_branding'::regclass
      and constraint_info.contype = 'u'
      and constraint_info.conkey = array[company_id_attnum]
  ) then
    alter table public.customer_branding
      add constraint customer_branding_company_id_unique unique (company_id);
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-assets',
  'customer-assets',
  true,
  5242880,
  array[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/svg+xml',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "customer_assets_public_read" on storage.objects;
create policy "customer_assets_public_read"
on storage.objects
for select
using (bucket_id = 'customer-assets');

comment on table public.customer_branding is 'Customer-specific portal, report and brand asset settings.';
comment on column public.customer_branding.logo_url is 'Primary uploaded customer logo public URL.';
comment on column public.customer_branding.logo_light_url is 'Customer logo variant for light backgrounds.';
comment on column public.customer_branding.logo_dark_url is 'Customer logo variant for dark backgrounds.';
comment on column public.customer_branding.brand_assets is 'Additional uploaded brand asset URLs and structured brand metadata.';

notify pgrst, 'reload schema';
