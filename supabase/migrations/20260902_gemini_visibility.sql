-- Gemini Görünürlük Merkezi: per-customer AI-answer-engine visibility
-- tracking, backed exclusively by real Gemini API calls (see
-- src/lib/gemini-visibility/scan.ts). Deliberately separate from
-- geo_visibility_observations (20260901_phase3_intelligence_automation.sql)
-- which is a manual staff-logged observation table across multiple engines
-- (chatgpt/perplexity/gemini/manual) — this is a structured, automated,
-- Gemini-only measurement pipeline with its own question bank, scan
-- history, and deterministic scoring, so it needs its own schema rather
-- than overloading that manual-entry table.
--
-- Reuses existing infrastructure directly: public.companies (customer
-- identity), public.users (actor/created_by), public.agency_tasks
-- (recommendation -> task conversion, no new task table), and
-- public.growth_automation_runs (weekly automation log — the run_type
-- check constraint is widened below to add one new value).

create table if not exists public.gemini_visibility_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  business_name text not null,
  alternate_names text[] not null default '{}',
  sector text,
  city text,
  district text,
  website text,
  service_summary text,
  tracking_enabled boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.gemini_visibility_questions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.gemini_visibility_profiles(id) on delete cascade,
  question_text text not null,
  category text not null check (category in ('discovery', 'recommendation', 'comparison', 'trust', 'branded')),
  is_active boolean not null default true,
  source text not null default 'manual' check (source in ('manual', 'ai_suggested')),
  deleted_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.gemini_visibility_scans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.gemini_visibility_profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'completed', 'partial', 'failed')),
  model text not null,
  questions_total integer not null default 0,
  questions_completed integer not null default 0,
  questions_failed integer not null default 0,
  scoring_version text not null default 'gemini_visibility_v1',
  score integer check (score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  score_level text check (score_level in ('critical', 'weak', 'developing', 'strong', 'excellent')),
  unmeasured_components text[] not null default '{}',
  previous_scan_id uuid references public.gemini_visibility_scans(id) on delete set null,
  score_change integer,
  triggered_by text not null default 'manual' check (triggered_by in ('manual', 'cron')),
  forced_refresh boolean not null default false,
  usage_json jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

-- At most one running scan per profile at a time (duplicate-scan lock).
create unique index if not exists gemini_visibility_scans_running_lock
  on public.gemini_visibility_scans (profile_id)
  where status = 'running';

create table if not exists public.gemini_visibility_answers (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.gemini_visibility_scans(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  question_id uuid references public.gemini_visibility_questions(id) on delete set null,
  question_text_snapshot text not null,
  category text not null,
  model text not null,
  status text not null default 'completed' check (status in ('completed', 'failed', 'cached')),
  raw_response text,
  brand_mentioned boolean,
  alternate_name_mentioned boolean,
  recommended boolean,
  position integer,
  competitors_mentioned jsonb not null default '[]'::jsonb,
  citation text,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  error text,
  response_ms integer,
  input_tokens integer,
  output_tokens integer,
  cached boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists gemini_visibility_questions_profile_idx on public.gemini_visibility_questions (profile_id, is_active);
create index if not exists gemini_visibility_scans_profile_idx on public.gemini_visibility_scans (profile_id, started_at desc);
create index if not exists gemini_visibility_scans_company_idx on public.gemini_visibility_scans (company_id, started_at desc);
create index if not exists gemini_visibility_answers_scan_idx on public.gemini_visibility_answers (scan_id);
create index if not exists gemini_visibility_answers_cache_idx on public.gemini_visibility_answers (question_id, model, status, created_at desc);
create index if not exists gemini_visibility_answers_quota_idx on public.gemini_visibility_answers (company_id, cached, created_at);

drop trigger if exists gemini_visibility_profiles_set_updated_at on public.gemini_visibility_profiles;
create trigger gemini_visibility_profiles_set_updated_at before update on public.gemini_visibility_profiles for each row execute function public.set_blog_updated_at();

drop trigger if exists gemini_visibility_questions_set_updated_at on public.gemini_visibility_questions;
create trigger gemini_visibility_questions_set_updated_at before update on public.gemini_visibility_questions for each row execute function public.set_blog_updated_at();

-- Widen the existing growth_automation_runs run_type check (additive, no
-- data loss) so the weekly Gemini visibility automation can log into the
-- same run history instead of a parallel log table.
alter table public.growth_automation_runs drop constraint if exists growth_automation_runs_run_type_check;
alter table public.growth_automation_runs add constraint growth_automation_runs_run_type_check
  check (run_type in ('sync', 'scoring', 'generation', 'publish', 'indexing', 'full_cycle', 'gemini_visibility'));

alter table public.gemini_visibility_profiles enable row level security;
alter table public.gemini_visibility_questions enable row level security;
alter table public.gemini_visibility_scans enable row level security;
alter table public.gemini_visibility_answers enable row level security;

drop policy if exists "Staff can manage gemini visibility profiles" on public.gemini_visibility_profiles;
create policy "Staff can manage gemini visibility profiles" on public.gemini_visibility_profiles for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Customer can read own gemini visibility profile" on public.gemini_visibility_profiles;
create policy "Customer can read own gemini visibility profile" on public.gemini_visibility_profiles for select using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.company_id = gemini_visibility_profiles.company_id and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage gemini visibility questions" on public.gemini_visibility_questions;
create policy "Staff can manage gemini visibility questions" on public.gemini_visibility_questions for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage gemini visibility scans" on public.gemini_visibility_scans;
create policy "Staff can manage gemini visibility scans" on public.gemini_visibility_scans for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Customer can read own gemini visibility scans" on public.gemini_visibility_scans;
create policy "Customer can read own gemini visibility scans" on public.gemini_visibility_scans for select using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.company_id = gemini_visibility_scans.company_id and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

-- Raw Gemini answers default to staff-only (spec: "ham Gemini yanıtlarını
-- varsayılan olarak yalnızca yetkili personel görebilsin") — no customer
-- read policy on this table.
drop policy if exists "Staff can manage gemini visibility answers" on public.gemini_visibility_answers;
create policy "Staff can manage gemini visibility answers" on public.gemini_visibility_answers for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

notify pgrst, 'reload schema';
