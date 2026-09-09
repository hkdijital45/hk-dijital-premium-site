-- HK Social Autopilot: autonomous Instagram content strategy, production,
-- scheduling, publishing, analytics and learning system.
--
-- Reuses existing infrastructure rather than duplicating it: public.users
-- for actor/RLS checks (same "Staff can manage X" predicate as
-- 20260826_growth_intelligence.sql), public.set_updated_at() for updated_at
-- triggers (defined in supabase/schema.sql), the existing hk-dijital-media
-- storage bucket for generated creative assets, and the workspace_id='hk-dijital'
-- singleton-settings pattern already used by growth_settings/growth
-- automation. This is a single-workspace (one Instagram account) system —
-- not customer-scoped, unlike customer_integrations.
--
-- Table groups:
--   1. Configuration:      social_autopilot_settings, social_brand_profile,
--                          social_cliche_blacklist
--   2. Strategy & content:  social_strategies, social_content_items,
--                          social_content_versions, social_quality_checks
--   3. Publishing:          social_publish_queue, social_publications
--   4. Instagram connection: social_integrations
--   5. Analytics & learning: social_metric_snapshots, social_ai_learnings,
--                          social_publishing_time_recommendations,
--                          social_experiments
--   6. Observability:       social_autopilot_runs

-- ---------------------------------------------------------------------------
-- 1. Configuration
-- ---------------------------------------------------------------------------

create table if not exists public.social_autopilot_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null unique default 'hk-dijital',
  autopilot_active boolean not null default false,
  control_mode text not null default 'approval' check (control_mode in ('manual', 'approval', 'full_auto')),
  test_mode boolean not null default true,
  emergency_pause boolean not null default false,
  emergency_pause_reason text,
  emergency_paused_at timestamptz,
  emergency_paused_by uuid references public.users(id) on delete set null,
  timezone text not null default 'Europe/Istanbul',
  min_quality_score integer not null default 85 check (min_quality_score between 0 and 100),
  max_quality_retries integer not null default 2 check (max_quality_retries between 0 and 5),
  daily_publish_cap integer not null default 2 check (daily_publish_cap >= 0),
  posting_frequency_per_week integer not null default 5 check (posting_frequency_per_week between 0 and 21),
  reel_ratio numeric not null default 0.5 check (reel_ratio between 0 and 1),
  carousel_ratio numeric not null default 0.3 check (carousel_ratio between 0 and 1),
  static_ratio numeric not null default 0.2 check (static_ratio between 0 and 1),
  content_pillar_weights jsonb not null default '{}'::jsonb,
  funnel_stage_plan jsonb not null default '{}'::jsonb,
  crisis_pause_enabled boolean not null default false,
  ai_provider_preference text not null default 'auto' check (ai_provider_preference in ('auto', 'anthropic', 'gemini')),
  notify_on_failure boolean not null default true,
  notify_on_disconnect boolean not null default true,
  notify_on_quality_gate_repeat_failure boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.social_brand_profile (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null unique default 'hk-dijital',
  brand_name text not null default 'HK Dijital',
  mission text not null default 'HK Dijital''ı; dijital pazarlama, performans reklamcılığı ve büyüme konusunda güvenilir bir otorite olarak konumlandırmak; ilgili takipçi, potansiyel müşteri ve nitelikli DM üretmek.',
  service_categories text[] not null default array[
    'dijital pazarlama', 'Meta Ads', 'Google Ads', 'sosyal medya yönetimi', 'pazarlama stratejisi',
    'performans pazarlaması', 'lead generation', 'dönüşüm optimizasyonu', 'analitik', 'remarketing',
    'SEO', 'GEO / AI görünürlüğü', 'işletme büyümesi', 'pazarlama teknolojisi', 'AI destekli ajans operasyonları'
  ],
  target_personas jsonb not null default '[]'::jsonb,
  geography text not null default 'Manisa, Türkiye',
  tone_guidelines text not null default 'Doğal, tecrübeli bir ajans sahibinin sesi. Kısa ve uzun cümleleri karıştır. Somut örnek ver. Gereksiz jargon, emoji ve ünlem kullanma. Motivasyonel değil, pratik ve bilgilendirici ol.',
  forbidden_topics text[] not null default '{}',
  visual_style_notes text not null default 'Modern, premium, dijital, temiz. Klişe AI görselleri (parlayan beyin, robot, nöron ağı) kullanma. Ekran kaydı, dashboard, mockup, tipografi animasyonu, grafik ve karşılaştırma görselleri tercih edilir.',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.social_cliche_blacklist (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  phrase text not null,
  category text not null default 'general' check (category in ('general', 'intro', 'cta', 'rhetorical_question', 'list_pattern')),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, phrase)
);

-- ---------------------------------------------------------------------------
-- 2. Strategy & content
-- ---------------------------------------------------------------------------

create table if not exists public.social_strategies (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  monthly_objective text not null default '',
  target_audience text not null default '',
  funnel_distribution jsonb not null default '{}'::jsonb,
  content_pillars jsonb not null default '[]'::jsonb,
  platform_objectives jsonb not null default '{}'::jsonb,
  posting_frequency integer not null default 5,
  reel_ratio numeric not null default 0.5,
  carousel_ratio numeric not null default 0.3,
  static_ratio numeric not null default 0.2,
  story_strategy text not null default '',
  follower_strategy text not null default '',
  authority_strategy text not null default '',
  lead_strategy text not null default '',
  conversion_strategy text not null default '',
  community_strategy text not null default '',
  testing_hypotheses jsonb not null default '[]'::jsonb,
  kpi_targets jsonb not null default '{}'::jsonb,
  creative_themes text[] not null default '{}',
  based_on_learnings jsonb not null default '[]'::jsonb,
  ai_provider text,
  ai_model text,
  prompt_version text,
  generated_by text not null default 'ai' check (generated_by in ('ai', 'manual')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, period_start)
);

create table if not exists public.social_content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  strategy_id uuid references public.social_strategies(id) on delete set null,
  content_date date not null,
  platform text not null default 'instagram',
  content_type text not null check (content_type in ('reel', 'carousel', 'static', 'story')),
  funnel_stage text not null check (funnel_stage in ('awareness', 'problem_awareness', 'consideration', 'authority', 'trust', 'conversion', 'retention')),
  content_pillar text not null default '',
  objective text not null default '',
  target_persona text not null default '',
  topic text not null default '',
  title text not null default '',
  hook text not null default '',
  hook_archetype text not null default '',
  secondary_hook text not null default '',
  caption text not null default '',
  cta text not null default '',
  cta_goal text not null default '',
  hashtags text[] not null default '{}',
  seo_keywords text[] not null default '{}',
  creative_brief jsonb not null default '{}'::jsonb,
  media_asset_urls text[] not null default '{}',
  primary_kpi text not null default '',
  secondary_kpi text not null default '',
  quality_score integer,
  factuality_score integer,
  originality_score integer,
  duplicate_score integer,
  brand_fit_score integer,
  privacy_check_passed boolean not null default false,
  publication_status text not null default 'draft' check (publication_status in (
    'draft', 'generated', 'quality_check', 'ready', 'scheduled', 'preparing',
    'publishing', 'processing', 'published', 'failed', 'needs_review', 'paused', 'cancelled'
  )),
  generation_status text not null default 'pending' check (generation_status in ('pending', 'generating', 'generated', 'failed')),
  scheduled_at timestamptz,
  publish_confidence text check (publish_confidence in ('low', 'medium', 'high')),
  publish_time_reasoning text,
  published_at timestamptz,
  external_media_id text,
  external_permalink text,
  failure_reason text,
  retries integer not null default 0,
  edited_manually boolean not null default false,
  manual_edit_locked_fields text[] not null default '{}',
  version integer not null default 1,
  ai_provider text,
  ai_model text,
  prompt_version text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.social_content_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.social_content_items(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null default '{}'::jsonb,
  edited_by uuid references public.users(id) on delete set null,
  edit_note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.social_quality_checks (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.social_content_items(id) on delete cascade,
  overall_score integer not null default 0 check (overall_score between 0 and 100),
  checks jsonb not null default '{}'::jsonb,
  passed boolean not null default false,
  attempt integer not null default 1,
  created_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- 3. Publishing
-- ---------------------------------------------------------------------------

create table if not exists public.social_publish_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  content_item_id uuid not null unique references public.social_content_items(id) on delete cascade,
  status text not null default 'scheduled' check (status in (
    'draft', 'ready', 'scheduled', 'preparing', 'publishing', 'processing',
    'published', 'failed', 'needs_review', 'paused', 'cancelled'
  )),
  scheduled_at timestamptz not null,
  locked_at timestamptz,
  locked_by text,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz,
  last_error text,
  error_category text,
  idempotency_key text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.social_publications (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.social_content_items(id) on delete cascade,
  external_media_id text not null unique,
  external_permalink text,
  media_type text,
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- 4. Instagram connection (agency's own account — not customer-scoped)
-- ---------------------------------------------------------------------------

create table if not exists public.social_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null unique default 'hk-dijital',
  provider text not null default 'instagram',
  ig_user_id text,
  username text,
  account_type text,
  access_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'disconnected' check (status in ('disconnected', 'connected', 'error', 'token_expired')),
  connected_at timestamptz,
  connected_by uuid references public.users(id) on delete set null,
  last_successful_call_at timestamptz,
  last_publish_at timestamptz,
  last_insights_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- 5. Analytics & learning
-- ---------------------------------------------------------------------------

-- Deliberately no uniqueness constraint beyond the primary key: repeated
-- snapshots at the same window are historical trend data, not upserts
-- (spec requirement — never overwrite a previous snapshot).
create table if not exists public.social_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  content_item_id uuid references public.social_content_items(id) on delete cascade,
  snapshot_scope text not null default 'content' check (snapshot_scope in ('content', 'account')),
  snapshot_window text not null check (snapshot_window in ('1h', '24h', '72h', '7d', '30d', 'daily')),
  reach integer not null default 0,
  impressions integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  saves integer not null default 0,
  shares integer not null default 0,
  profile_visits integer not null default 0,
  follows integer not null default 0,
  video_views integer not null default 0,
  watch_time_seconds numeric,
  engagement_rate numeric,
  follower_count integer,
  performance_score numeric,
  captured_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.social_ai_learnings (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  strategy_id uuid references public.social_strategies(id) on delete set null,
  learning_type text not null default 'winner' check (learning_type in ('winner', 'weakness', 'hypothesis', 'fatigue_signal', 'experiment_result')),
  title text not null,
  summary text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  evidence_window text not null default '',
  sample_size integer not null default 0,
  confidence text not null default 'low' check (confidence in ('low', 'medium', 'high')),
  action_recommendation text not null default '',
  applied boolean not null default false,
  generated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.social_publishing_time_recommendations (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  weekday integer not null check (weekday between 0 and 6),
  hour integer not null check (hour between 0 and 23),
  content_type text not null default 'any',
  content_pillar text not null default 'any',
  sample_size integer not null default 0,
  avg_score numeric not null default 0,
  confidence text not null default 'low' check (confidence in ('low', 'medium', 'high')),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, weekday, hour, content_type, content_pillar)
);

create table if not exists public.social_experiments (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  hypothesis text not null,
  variant_a text not null default '',
  variant_b text not null default '',
  metric text not null default '',
  status text not null default 'planned' check (status in ('planned', 'running', 'completed', 'cancelled')),
  result jsonb not null default '{}'::jsonb,
  content_item_ids uuid[] not null default '{}',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- 6. Observability (mirrors growth_automation_runs)
-- ---------------------------------------------------------------------------

create table if not exists public.social_autopilot_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'hk-dijital',
  run_type text not null check (run_type in ('daily_cycle', 'queue_process', 'analytics_sync', 'learning_update', 'monthly_refresh')),
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error text,
  affected_count integer not null default 0,
  triggered_by text not null default 'cron' check (triggered_by in ('cron', 'manual'))
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists social_content_items_date_idx on public.social_content_items (workspace_id, content_date desc);
create index if not exists social_content_items_status_idx on public.social_content_items (workspace_id, publication_status);
create index if not exists social_content_items_scheduled_idx on public.social_content_items (scheduled_at) where scheduled_at is not null;
create index if not exists social_content_items_strategy_idx on public.social_content_items (strategy_id);
create index if not exists social_content_versions_item_idx on public.social_content_versions (content_item_id, version desc);
create index if not exists social_quality_checks_item_idx on public.social_quality_checks (content_item_id, created_at desc);
create index if not exists social_publish_queue_status_idx on public.social_publish_queue (status, scheduled_at);
create index if not exists social_publish_queue_next_attempt_idx on public.social_publish_queue (next_attempt_at) where next_attempt_at is not null;
create index if not exists social_publications_item_idx on public.social_publications (content_item_id);
create index if not exists social_metric_snapshots_item_idx on public.social_metric_snapshots (content_item_id, snapshot_window, captured_at desc);
create index if not exists social_metric_snapshots_account_idx on public.social_metric_snapshots (workspace_id, snapshot_scope, captured_at desc);
create index if not exists social_ai_learnings_workspace_idx on public.social_ai_learnings (workspace_id, generated_at desc);
create index if not exists social_publishing_time_lookup_idx on public.social_publishing_time_recommendations (workspace_id, weekday, hour);
create index if not exists social_autopilot_runs_started_idx on public.social_autopilot_runs (workspace_id, started_at desc);
create index if not exists social_experiments_status_idx on public.social_experiments (workspace_id, status);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuses public.set_updated_at() from schema.sql)
-- ---------------------------------------------------------------------------

drop trigger if exists social_autopilot_settings_set_updated_at on public.social_autopilot_settings;
create trigger social_autopilot_settings_set_updated_at before update on public.social_autopilot_settings for each row execute function public.set_updated_at();

drop trigger if exists social_brand_profile_set_updated_at on public.social_brand_profile;
create trigger social_brand_profile_set_updated_at before update on public.social_brand_profile for each row execute function public.set_updated_at();

drop trigger if exists social_strategies_set_updated_at on public.social_strategies;
create trigger social_strategies_set_updated_at before update on public.social_strategies for each row execute function public.set_updated_at();

drop trigger if exists social_content_items_set_updated_at on public.social_content_items;
create trigger social_content_items_set_updated_at before update on public.social_content_items for each row execute function public.set_updated_at();

drop trigger if exists social_publish_queue_set_updated_at on public.social_publish_queue;
create trigger social_publish_queue_set_updated_at before update on public.social_publish_queue for each row execute function public.set_updated_at();

drop trigger if exists social_integrations_set_updated_at on public.social_integrations;
create trigger social_integrations_set_updated_at before update on public.social_integrations for each row execute function public.set_updated_at();

drop trigger if exists social_experiments_set_updated_at on public.social_experiments;
create trigger social_experiments_set_updated_at before update on public.social_experiments for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — same staff-role predicate as growth_intelligence
-- (public.users role in admin/yonetici/editor/sales, active, not deleted).
-- Server routes use the service-role key (bypasses RLS) via supabaseRest;
-- these policies only guard against any client-side/anon-key access.
-- ---------------------------------------------------------------------------

alter table public.social_autopilot_settings enable row level security;
alter table public.social_brand_profile enable row level security;
alter table public.social_cliche_blacklist enable row level security;
alter table public.social_strategies enable row level security;
alter table public.social_content_items enable row level security;
alter table public.social_content_versions enable row level security;
alter table public.social_quality_checks enable row level security;
alter table public.social_publish_queue enable row level security;
alter table public.social_publications enable row level security;
alter table public.social_integrations enable row level security;
alter table public.social_metric_snapshots enable row level security;
alter table public.social_ai_learnings enable row level security;
alter table public.social_publishing_time_recommendations enable row level security;
alter table public.social_experiments enable row level security;
alter table public.social_autopilot_runs enable row level security;

do $$
declare
  t text;
  staff_tables text[] := array[
    'social_autopilot_settings', 'social_brand_profile', 'social_cliche_blacklist',
    'social_strategies', 'social_content_items', 'social_content_versions', 'social_quality_checks',
    'social_publish_queue', 'social_publications', 'social_integrations', 'social_metric_snapshots',
    'social_ai_learnings', 'social_publishing_time_recommendations', 'social_experiments', 'social_autopilot_runs'
  ];
begin
  foreach t in array staff_tables loop
    execute format('drop policy if exists "Staff can manage %1$s" on public.%1$I', t);
    execute format(
      'create policy "Staff can manage %1$s" on public.%1$I for all using (
         exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in (''admin'', ''yonetici'', ''editor'', ''sales'') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
       ) with check (
         exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in (''admin'', ''yonetici'', ''editor'', ''sales'') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
       )', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Seed defaults
-- ---------------------------------------------------------------------------

insert into public.social_autopilot_settings (workspace_id) values ('hk-dijital') on conflict (workspace_id) do nothing;
insert into public.social_brand_profile (workspace_id) values ('hk-dijital') on conflict (workspace_id) do nothing;
insert into public.social_integrations (workspace_id) values ('hk-dijital') on conflict (workspace_id) do nothing;

-- Forbidden AI cliché seed list (section 8 of the spec) — editable afterwards
-- from Autopilot Ayarları rather than scattered across prompts.
insert into public.social_cliche_blacklist (workspace_id, phrase, category) values
  ('hk-dijital', 'dijital dünyada', 'intro'),
  ('hk-dijital', 'günümüzde', 'intro'),
  ('hk-dijital', 'markanızı bir üst seviyeye taşıyın', 'cta'),
  ('hk-dijital', 'hazır mısınız', 'rhetorical_question'),
  ('hk-dijital', 'başarı tesadüf değildir', 'intro'),
  ('hk-dijital', 'rakiplerinizden bir adım öne geçin', 'cta'),
  ('hk-dijital', 'dijital dönüşüm artık bir seçenek değil', 'intro'),
  ('hk-dijital', 'sadece bir ... değil', 'list_pattern'),
  ('hk-dijital', 'değil, ...''dir', 'list_pattern')
on conflict (workspace_id, phrase) do nothing;

notify pgrst, 'reload schema';
