-- Ön İnceleme Merkezi — pre-sale digital research reports for HK Dijital's
-- potential and existing customers, prepared by the "HK Dijital — Ön
-- İnceleme" Claude Project via MCP (get_pre_audit_context /
-- save_pre_audit_report / get_latest_pre_audit_report) and viewed/managed
-- in HK Admin. Deliberately its own table — no existing table cleanly
-- fits a 20+ field structured sales-research report, and it is not the
-- same entity as hk_intelligence_ceo_runs (post-sale marketing
-- intelligence/ads strategy for already-onboarded customers).
--
-- Two linked report rows per research pass, tied by analysis_group_id:
--   INTERNAL_REPORT — HK Dijital's own use (sales notes, script,
--     objections, DM/WhatsApp drafts). Never shown as client content.
--   CLIENT_REPORT — clean, presentable version (no internal sales
--     tactics), the structured source for a future PDF.
-- Historical: never overwritten — a new research pass is a new
-- analysis_group_id, not an update to the previous one.

create table if not exists public.pre_audit_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  analysis_group_id uuid not null default gen_random_uuid(),
  report_type text not null check (report_type in ('INTERNAL_REPORT', 'CLIENT_REPORT')),
  title text not null default '',
  status text not null default 'draft',
  report_date date not null default current_date,

  executive_summary text not null default '',
  digital_presence jsonb not null default '{}'::jsonb,
  google_analysis jsonb not null default '{}'::jsonb,
  maps_analysis jsonb not null default '{}'::jsonb,
  website_analysis jsonb not null default '{}'::jsonb,
  seo_analysis jsonb not null default '{}'::jsonb,
  social_analysis jsonb not null default '{}'::jsonb,
  meta_ads_analysis jsonb not null default '{}'::jsonb,
  google_ads_analysis jsonb not null default '{}'::jsonb,
  market_analysis jsonb not null default '{}'::jsonb,
  competitor_analysis jsonb not null default '{}'::jsonb,
  swot jsonb not null default '{}'::jsonb,
  digital_gaps jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  recommended_services jsonb not null default '[]'::jsonb,
  recommended_package jsonb not null default '{}'::jsonb,
  ad_strategy jsonb not null default '{}'::jsonb,
  budget_plan jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,

  -- Internal-only outreach/sales fields. Never populated on a CLIENT_REPORT
  -- row; the admin UI additionally never renders these for report_type =
  -- CLIENT_REPORT as defence in depth.
  sales_notes text not null default '',
  sales_script text not null default '',
  instagram_dm text not null default '',
  whatsapp_initial text not null default '',
  whatsapp_with_pdf text not null default '',
  objections jsonb not null default '[]'::jsonb,

  -- No PDF generation/storage infra exists in this repo yet — reserved for
  -- when a real document-storage pattern is reused, never populated by the
  -- initial MCP tools.
  pdf_reference text,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists pre_audit_reports_company_idx on public.pre_audit_reports (company_id);
create index if not exists pre_audit_reports_company_date_idx on public.pre_audit_reports (company_id, report_date desc, created_at desc);
create index if not exists pre_audit_reports_group_idx on public.pre_audit_reports (analysis_group_id);
create index if not exists pre_audit_reports_type_idx on public.pre_audit_reports (report_type);

drop trigger if exists pre_audit_reports_set_updated_at on public.pre_audit_reports;
create trigger pre_audit_reports_set_updated_at
  before update on public.pre_audit_reports
  for each row execute function public.set_updated_at();

-- Row Level Security — same staff-role predicate as social_content_plan_items
-- (public.users role in admin/yonetici/editor/sales, active, not deleted).
-- Server routes use the service-role key (bypasses RLS); this only guards
-- any client-side/anon-key access. No customer-portal access — pre-audit
-- reports (including CLIENT_REPORT rows) are sales-intelligence storage,
-- not a customer-facing document delivery system.
alter table public.pre_audit_reports enable row level security;

drop policy if exists "Staff can manage pre_audit_reports" on public.pre_audit_reports;
create policy "Staff can manage pre_audit_reports" on public.pre_audit_reports for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
