-- HK Agent Hub Phase 3 + System Repair: memory, queue, benchmark, prompt versions and training rules.

alter table if exists public.agent_runs
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists retry_count integer default 0,
  add column if not exists parent_run_id uuid;

create table if not exists public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  customer_id uuid,
  memory_type text not null,
  title text not null,
  content text not null,
  source_run_id uuid,
  impact_score numeric default 0,
  tags jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.agent_training_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type text not null,
  title text not null,
  content text not null,
  is_active boolean default true,
  priority integer default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.agent_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references public.agent_prompts(id) on delete cascade,
  version_number integer not null,
  prompt_text text not null,
  change_note text,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.agent_benchmarks (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  prompt text not null,
  providers jsonb default '[]'::jsonb,
  results jsonb default '[]'::jsonb,
  winner_provider text,
  hk_decision text,
  created_at timestamptz default now()
);

create index if not exists agent_memories_company_idx on public.agent_memories(company_id);
create index if not exists agent_memories_type_idx on public.agent_memories(memory_type);
create index if not exists agent_memories_active_idx on public.agent_memories(is_active);
create index if not exists agent_training_rules_active_idx on public.agent_training_rules(is_active);
create index if not exists agent_training_rules_priority_idx on public.agent_training_rules(priority);
create index if not exists agent_prompt_versions_prompt_idx on public.agent_prompt_versions(prompt_id);
create index if not exists agent_benchmarks_created_idx on public.agent_benchmarks(created_at);
create index if not exists agent_runs_queue_status_idx on public.agent_runs(status, created_at);
create index if not exists agent_runs_parent_idx on public.agent_runs(parent_run_id);

alter table public.agent_memories enable row level security;
alter table public.agent_training_rules enable row level security;
alter table public.agent_prompt_versions enable row level security;
alter table public.agent_benchmarks enable row level security;

insert into public.agent_training_rules (rule_type, title, content, is_active, priority)
values
  ('tone', 'Satış garantisi verme', 'Rapor, teklif ve müşteri mesajlarında satış, lead veya ciro garantisi verme. Beklenen etkiyi ölçülü ve koşullu anlat.', true, 10),
  ('language', 'Teknik terimleri Türkçe açıkla', 'Token, queue, provider, fallback, benchmark ve webhook gibi teknik terimleri parantez içinde kısa Türkçe açıklamayla kullan.', true, 20),
  ('reporting', 'Müşteri raporlarında sade dil kullan', 'Müşteriye gönderilecek metinlerde teknik detayı azalt; ne oldu, neden önemli ve bu hafta ne yapılacak sorularını cevapla.', true, 30),
  ('risk', 'Riskleri saklama', 'Düşük veri kalitesi, entegrasyon eksikliği, bütçe kaçağı veya reklam yorgunluğu gibi riskleri panik oluşturmadan net yaz.', true, 40),
  ('action_plan', '7 günlük aksiyon planı üret', 'Her kapsamlı analizde bugünden başlayarak 7 günlük uygulanabilir aksiyon planı üret.', true, 50),
  ('positioning', 'HK Dijital hizmetlerini abartmadan konumlandır', 'Google Ads, Meta Ads, SEO, landing page, CRM ve raporlama hizmetlerini müşteri ihtiyacına bağlı öner; gereksiz paket şişirme yapma.', true, 60)
on conflict do nothing;

notify pgrst, 'reload schema';
