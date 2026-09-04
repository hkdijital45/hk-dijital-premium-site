-- First-party website analytics events. The "Web Site Analitiği" admin
-- screen previously always showed hardcoded zeros because no ingestion
-- table existed at all — this is the missing piece it reads from.
-- Deliberately minimal: no IP, no user agent, no personal data. Inserts
-- only ever happen through the server-side /api/analytics/track route
-- using the service-role key, so no anon/authenticated INSERT policy is
-- defined below (RLS default-denies writes from anywhere else).
create table if not exists public.website_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in ('PageView', 'Contact', 'Lead', 'InitiateCheckout', 'ViewContent', 'HK_CTA_Click')),
  page_path text,
  referrer_source text not null default 'Direct' check (referrer_source in ('Direct', 'Organic', 'Facebook / Instagram', 'Google', 'Referral')),
  session_id text not null,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists website_analytics_events_name_time_idx on public.website_analytics_events (event_name, occurred_at desc);
create index if not exists website_analytics_events_page_idx on public.website_analytics_events (page_path);
create index if not exists website_analytics_events_occurred_idx on public.website_analytics_events (occurred_at desc);

alter table public.website_analytics_events enable row level security;

drop policy if exists "Staff can read website analytics events" on public.website_analytics_events;
create policy "Staff can read website analytics events" on public.website_analytics_events for select using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
