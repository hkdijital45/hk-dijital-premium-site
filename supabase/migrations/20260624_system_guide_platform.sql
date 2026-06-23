-- HK Dijital living system guide, analytics and feedback storage.
create table if not exists public.system_guide_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  description text not null,
  route text,
  content jsonb not null default '{}'::jsonb,
  video_url text,
  is_published boolean not null default true,
  view_count integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_guide_events (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid references public.system_guides(id) on delete cascade,
  guide_slug text,
  event_type text not null,
  search_query text,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.system_guide_feedback (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid references public.system_guides(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  is_helpful boolean not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists system_guides_category_idx on public.system_guides(category);
create index if not exists system_guides_published_idx on public.system_guides(is_published, updated_at desc);
create index if not exists system_guide_events_type_idx on public.system_guide_events(event_type, created_at desc);
create index if not exists system_guide_events_slug_idx on public.system_guide_events(guide_slug, created_at desc);
create index if not exists system_guide_feedback_guide_idx on public.system_guide_feedback(guide_id, created_at desc);

alter table public.system_guide_categories enable row level security;
alter table public.system_guides enable row level security;
alter table public.system_guide_events enable row level security;
alter table public.system_guide_feedback enable row level security;
