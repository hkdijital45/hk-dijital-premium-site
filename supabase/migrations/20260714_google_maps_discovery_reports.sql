-- Persist Google Maps discovery reports in the existing report center.
alter table if exists public.reports
  alter column company_id drop not null,
  add column if not exists title text,
  add column if not exists content jsonb not null default '{}'::jsonb,
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists source_identifier text,
  add column if not exists business_name text,
  add column if not exists source_module text,
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.reports
  drop constraint if exists reports_report_type_check;

alter table if exists public.reports
  add constraint reports_report_type_check
  check (report_type in (
    'Meta Reklam Raporu',
    'Google Ads Raporu',
    'Sosyal Medya Yönetimi Raporu',
    'Genel Dijital Performans Raporu',
    'AI SWOT Raporu',
    'AI Dijital Analiz Raporu',
    'AI Sunum Taslağı',
    'Rakip Analizi',
    'Müşteri Keşif Raporu'
  ));

create index if not exists reports_source_module_idx
  on public.reports(source_module, created_at desc);

create index if not exists reports_source_identifier_idx
  on public.reports(source_identifier);

create index if not exists reports_lead_id_idx
  on public.reports(lead_id);

create unique index if not exists reports_discovery_active_unique_idx
  on public.reports(source_module, source_identifier, report_type)
  where source_module = 'google_maps_discovery' and source_identifier is not null and deleted_at is null;

drop policy if exists reports_discovery_staff_access on public.reports;
create policy reports_discovery_staff_access
  on public.reports
  for all
  to authenticated
  using (
    source_module = 'google_maps_discovery'
    and exists (
      select 1
      from public.users
      where users.auth_user_id = auth.uid()
        and users.role in ('admin', 'yonetici', 'editor')
        and users.is_active = true
        and users.deleted_at is null
    )
  )
  with check (
    source_module = 'google_maps_discovery'
    and exists (
      select 1
      from public.users
      where users.auth_user_id = auth.uid()
        and users.role in ('admin', 'yonetici', 'editor')
        and users.is_active = true
        and users.deleted_at is null
    )
  );
