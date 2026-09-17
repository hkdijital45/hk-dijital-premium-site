-- İçerik Planlama Merkezi (/hk-admin/social-autopilot's new UI) — a
-- lightweight manual content-tracking table, deliberately separate from
-- social_content_items (the AI-generation/orchestration pipeline table).
-- Rows here are never touched by generateContentForDate/the publish
-- queue/the orchestrator/cron — this is purely "what did I plan to post,
-- on which platform(s), and did I actually post it", tracked by hand.
-- Same workspace_id/RLS convention as the rest of Social Autopilot's
-- tables (single-tenant: HK Dijital's own social accounts, not a
-- per-customer table).

create table if not exists public.content_plan_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  scheduled_date date not null,
  platforms text[] not null default '{}',
  theme text not null default '',
  content_title text not null default '',
  content_format text not null default 'static' check (content_format in ('static', 'carousel', 'reels', 'story', 'video', 'shorts', 'other')),
  notes text not null default '',
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists content_plan_items_date_idx on public.content_plan_items (workspace_id, scheduled_date desc);
create index if not exists content_plan_items_published_idx on public.content_plan_items (workspace_id, is_published);

drop trigger if exists content_plan_items_set_updated_at on public.content_plan_items;
create trigger content_plan_items_set_updated_at
  before update on public.content_plan_items
  for each row execute function public.set_updated_at();

-- Row Level Security — same staff-role predicate as the rest of Social
-- Autopilot (public.users role in admin/yonetici/editor/sales, active,
-- not deleted). Server routes use the service-role key (bypasses RLS);
-- this only guards any client-side/anon-key access.
alter table public.content_plan_items enable row level security;

drop policy if exists "Staff can manage content_plan_items" on public.content_plan_items;
create policy "Staff can manage content_plan_items" on public.content_plan_items for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
