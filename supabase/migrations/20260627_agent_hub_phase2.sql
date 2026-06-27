-- HK Agent Hub Phase 2: Auto Router, multi-agent orchestration, exports and scheduled tasks.

alter table if exists public.agent_runs
  add column if not exists run_mode text default 'single',
  add column if not exists provider_chain jsonb default '[]'::jsonb,
  add column if not exists progress integer default 0,
  add column if not exists current_step text,
  add column if not exists progress_events jsonb default '[]'::jsonb,
  add column if not exists final_report jsonb default '{}'::jsonb,
  add column if not exists export_payload jsonb default '{}'::jsonb,
  add column if not exists email_draft jsonb default '{}'::jsonb,
  add column if not exists scheduled_task_id uuid,
  add column if not exists started_at timestamptz,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.agent_scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid,
  name text not null,
  task_type text not null,
  schedule_frequency text not null,
  schedule_day text,
  schedule_time text,
  timezone text default 'Europe/Istanbul',
  provider_mode text default 'auto',
  multi_agent boolean default false,
  output_format text default 'detailed_report',
  prompt text,
  is_active boolean default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists agent_runs_run_mode_idx on public.agent_runs(run_mode);
create index if not exists agent_runs_status_idx on public.agent_runs(status);
create index if not exists agent_scheduled_tasks_active_idx on public.agent_scheduled_tasks(is_active);
create index if not exists agent_scheduled_tasks_next_run_idx on public.agent_scheduled_tasks(next_run_at);

alter table public.agent_scheduled_tasks enable row level security;

insert into public.agent_workflows (name, description, steps, is_active)
values
  ('Çoklu AI Rakip İstihbaratı', 'Manus, Gemini, OpenAI ve HK Intelligence final katmanı ile rakip/pazar raporu üretir.', '["Manus derin araştırma","Gemini SEO ve görünürlük kıyaslaması","OpenAI reklam ve satış fırsatları","HK Intelligence final raporu"]'::jsonb, true),
  ('HK Intelligence Aylık Rapor', 'OpenAI ve Claude çıktısını HK Intelligence ile müşteri dostu aylık rapora dönüştürür.', '["OpenAI performans yorumu","Claude rapor dili düzenleme","HK Intelligence aksiyon planı","Export payload hazırlığı"]'::jsonb, true),
  ('Haftalık Reklam Sağlık Kontrolü', 'Haftalık reklam verilerini kontrol edip risk ve aksiyon önerisi üretir.', '["Reklam verisini oku","Auto Router ile sağlayıcı seç","HK Intelligence riskleri çıkar","7 günlük plan oluştur"]'::jsonb, true)
on conflict do nothing;

notify pgrst, 'reload schema';
