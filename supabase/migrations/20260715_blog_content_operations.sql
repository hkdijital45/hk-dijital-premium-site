create table if not exists public.content_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  service text not null default '',
  region text not null default '',
  audience text not null default '',
  objective text not null default '',
  weekly_count integer not null default 1 check (weekly_count between 1 and 14),
  start_date date,
  end_date date,
  preferred_days text[] not null default '{}',
  preferred_time text not null default '10:00',
  content_types text[] not null default '{}',
  primary_keywords text[] not null default '{}',
  excluded_keywords text[] not null default '{}',
  tone text not null default 'Profesyonel',
  average_length text not null default 'Standart: 1000–1400 kelime',
  auto_generate_drafts boolean not null default true,
  auto_publish boolean not null default false,
  require_approval boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.content_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.content_plans(id) on delete cascade,
  blog_post_id uuid references public.blog_posts(id) on delete set null,
  title text not null,
  slug text not null,
  primary_keyword text not null default '',
  secondary_keywords text[] not null default '{}',
  search_intent text not null default '',
  target_audience text not null default '',
  content_type text not null default '',
  scheduled_at timestamptz,
  status text not null default 'planned' check (status in ('planned', 'draft_ready', 'draft_created', 'scheduled', 'published', 'skipped')),
  priority text not null default 'Orta',
  rationale text not null default '',
  source_signals text[] not null default '{}',
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (plan_id, slug)
);

alter table public.blog_posts add column if not exists approved_for_publish boolean not null default false;
alter table public.blog_posts add column if not exists approved_at timestamptz;
alter table public.blog_posts add column if not exists approved_by uuid references public.users(id) on delete set null;
alter table public.blog_posts add column if not exists ai_image_metadata jsonb not null default '{}'::jsonb;
alter table public.blog_posts add column if not exists last_performance_check_at timestamptz;

create index if not exists content_plans_status_idx on public.content_plans (status, updated_at desc);
create index if not exists content_plan_items_plan_idx on public.content_plan_items (plan_id, scheduled_at);
create index if not exists content_plan_items_blog_post_idx on public.content_plan_items (blog_post_id);
create index if not exists blog_posts_scheduled_publish_idx on public.blog_posts (status, scheduled_at) where status = 'scheduled';
create index if not exists blog_posts_approval_idx on public.blog_posts (approved_for_publish);

alter table public.content_plans enable row level security;
alter table public.content_plan_items enable row level security;

drop policy if exists "Staff can manage content plans" on public.content_plans;
create policy "Staff can manage content plans" on public.content_plans for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage content plan items" on public.content_plan_items;
create policy "Staff can manage content plan items" on public.content_plan_items for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop trigger if exists content_plans_set_updated_at on public.content_plans;
create trigger content_plans_set_updated_at before update on public.content_plans for each row execute function public.set_blog_updated_at();

drop trigger if exists content_plan_items_set_updated_at on public.content_plan_items;
create trigger content_plan_items_set_updated_at before update on public.content_plan_items for each row execute function public.set_blog_updated_at();

notify pgrst, 'reload schema';
