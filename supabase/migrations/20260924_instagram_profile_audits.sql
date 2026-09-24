-- Instagram Profil Optimizasyonu — Claude Project ("HK Dijital — Instagram
-- Profil Optimizasyonu") reads a customer's real, already-connected
-- Instagram/company data via MCP (get_instagram_profile_audit_context /
-- save_instagram_profile_audit / get_instagram_profile_audits) and, only
-- after the user explicitly approves in chat, saves a structured profile
-- audit here. Its own dedicated table — not squeezed into
-- hk_intelligence_ceo_runs (a different domain: ads/marketing intelligence
-- runs) or pre_audit_reports (pre-sale research for leads/prospects, not
-- an existing customer's live Instagram profile). Every analysis is a new
-- row (history preserved, never overwritten) so profile evolution over
-- time can be compared.
create table if not exists public.instagram_profile_audits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  instagram_username text not null default '',
  audit_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'approved', 'completed')),

  overall_summary text not null default '',
  profile_photo_analysis jsonb not null default '{}'::jsonb,
  username_analysis jsonb not null default '{}'::jsonb,
  name_field_analysis jsonb not null default '{}'::jsonb,
  current_bio text not null default '',
  recommended_bio text not null default '',
  link_cta_analysis jsonb not null default '{}'::jsonb,
  highlights_analysis jsonb not null default '[]'::jsonb,
  pinned_posts_analysis jsonb not null default '[]'::jsonb,
  profile_visual_analysis jsonb not null default '{}'::jsonb,
  trust_contact_analysis jsonb not null default '{}'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,

  -- Chronological chain for "compare with the previous report" — resolved
  -- automatically at save time (the company's own current latest row),
  -- never trusted from client input.
  previous_audit_id uuid references public.instagram_profile_audits(id) on delete set null,
  source text not null default 'claude_mcp',
  metadata jsonb not null default '{}'::jsonb,
  raw_analysis jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists instagram_profile_audits_company_idx on public.instagram_profile_audits (company_id);
create index if not exists instagram_profile_audits_company_date_idx on public.instagram_profile_audits (company_id, audit_date desc, created_at desc);
create index if not exists instagram_profile_audits_status_idx on public.instagram_profile_audits (status);

drop trigger if exists instagram_profile_audits_set_updated_at on public.instagram_profile_audits;
create trigger instagram_profile_audits_set_updated_at
  before update on public.instagram_profile_audits
  for each row execute function public.set_updated_at();

-- Row Level Security — same staff-role predicate as pre_audit_reports /
-- social_content_plan_items (public.users role in admin/yonetici/editor/
-- sales, active, not deleted). Server routes use the service-role key
-- (bypasses RLS); this only guards any client-side/anon-key access.
alter table public.instagram_profile_audits enable row level security;

drop policy if exists "Staff can manage instagram_profile_audits" on public.instagram_profile_audits;
create policy "Staff can manage instagram_profile_audits" on public.instagram_profile_audits for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
