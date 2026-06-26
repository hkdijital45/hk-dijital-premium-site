-- HK Agent Hub v1.0 orchestration center.
-- Secrets are stored server-side only and must never be returned to client components.

create table if not exists public.agent_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  provider_name text not null,
  role_label text,
  status text default 'not_configured',
  default_model text,
  purpose text,
  daily_limit integer,
  monthly_limit integer,
  estimated_monthly_cost numeric,
  success_rate numeric,
  avg_response_ms integer,
  last_used_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.agent_provider_secrets (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null references public.agent_providers(provider_key) on delete cascade,
  secret_name text not null,
  secret_value text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(provider_key, secret_name)
);

create table if not exists public.agent_prompts (
  id uuid primary key default gen_random_uuid(),
  provider_key text references public.agent_providers(provider_key) on delete set null,
  task_type text not null,
  title text not null,
  prompt_text text not null,
  is_default boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid,
  task_type text not null,
  priority text default 'normal',
  requested_provider text,
  selected_provider text,
  fallback_provider text,
  status text default 'queued',
  input_summary text,
  output_summary text,
  output_payload jsonb default '{}'::jsonb,
  error_message text,
  estimated_cost numeric,
  tokens_used integer,
  response_ms integer,
  created_by uuid,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists public.agent_workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  steps jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists public.agent_providers
  add column if not exists provider_key text,
  add column if not exists provider_name text,
  add column if not exists role_label text,
  add column if not exists status text default 'not_configured',
  add column if not exists default_model text,
  add column if not exists purpose text,
  add column if not exists daily_limit integer,
  add column if not exists monthly_limit integer,
  add column if not exists estimated_monthly_cost numeric,
  add column if not exists success_rate numeric,
  add column if not exists avg_response_ms integer,
  add column if not exists last_used_at timestamptz,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.agent_runs
  add column if not exists customer_id uuid,
  add column if not exists task_type text,
  add column if not exists priority text default 'normal',
  add column if not exists requested_provider text,
  add column if not exists selected_provider text,
  add column if not exists fallback_provider text,
  add column if not exists status text default 'queued',
  add column if not exists input_summary text,
  add column if not exists output_summary text,
  add column if not exists output_payload jsonb default '{}'::jsonb,
  add column if not exists error_message text,
  add column if not exists estimated_cost numeric,
  add column if not exists tokens_used integer,
  add column if not exists response_ms integer,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists completed_at timestamptz;

create index if not exists agent_providers_status_idx on public.agent_providers(status);
create index if not exists agent_prompts_task_provider_idx on public.agent_prompts(task_type, provider_key);
create index if not exists agent_runs_created_at_idx on public.agent_runs(created_at desc);
create index if not exists agent_runs_task_provider_idx on public.agent_runs(task_type, selected_provider);
create index if not exists agent_runs_customer_idx on public.agent_runs(customer_id);
create index if not exists agent_workflows_active_idx on public.agent_workflows(is_active);

alter table public.agent_providers enable row level security;
alter table public.agent_provider_secrets enable row level security;
alter table public.agent_prompts enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_workflows enable row level security;

insert into public.agent_providers (provider_key, provider_name, role_label, status, default_model, purpose, daily_limit, monthly_limit, estimated_monthly_cost, success_rate, avg_response_ms, notes)
values
  ('openai', 'OpenAI / ChatGPT', 'Günlük analiz ve raporlama', 'not_configured', 'gpt-4.1-mini', 'Reklam yorumlama, CRM özeti, müşteri raporu ve genel analiz.', 200, 5000, 0, 100, 0, 'Kısa ve orta uzunlukta ajans analizleri için önerilir.'),
  ('anthropic', 'Anthropic / Claude', 'Teklif ve uzun metin uzmanı', 'not_configured', 'claude-3-5-sonnet', 'Teklif, müşteri raporu, uzun doküman ve kod inceleme.', 100, 3000, 0, 100, 0, 'Uzun ve yapılandırılmış metin üretiminde kullanılır.'),
  ('gemini', 'Google Gemini', 'SEO ve çok yönlü analiz', 'not_configured', 'gemini-2.0-flash', 'SEO analizi, reklam yorumlama ve pazar sinyali özetleri.', 200, 5000, 0, 100, 0, 'Google ekosistemi yorumları için uygundur.'),
  ('groq', 'Groq', 'Hızlı cevap motoru', 'not_configured', 'llama-3.3-70b-versatile', 'Kısa cevap, hızlı özet ve düşük gecikmeli görevler.', 300, 7000, 0, 100, 0, 'Hızlı cevap ve düşük gecikme için önerilir.'),
  ('manus', 'Manus AI', 'Derin Araştırma Uzmanı', 'not_configured', 'manus-deep-research', 'Rakip analizi, pazar araştırması, fiyat karşılaştırması, sektör keşfi ve kapsamlı rapor üretimi.', 30, 500, 0, 100, 0, 'Günlük kısa cevaplar için varsayılan değildir; derin araştırma görevlerinde önceliklidir.'),
  ('openrouter', 'OpenRouter', 'Alternatif model geçidi', 'not_configured', 'auto', 'Alternatif model denemeleri ve yedek sağlayıcı akışı.', 100, 3000, 0, 100, 0, 'Çoklu model fallback senaryoları için hazırlanmıştır.'),
  ('ollama', 'Ollama', 'Yerel model', 'not_configured', 'local', 'Yerel veya özel ağ içinde çalışan model fallback akışı.', 1000, 30000, 0, 100, 0, 'Yerel ağda çalışan modeller için kullanılır.'),
  ('demo', 'Demo / Local fallback', 'Güvenli fallback', 'active', 'local-rules', 'API anahtarı yoksa Türkçe ve kural tabanlı güvenli çıktı üretir.', 9999, 99999, 0, 100, 5, 'Canlı sağlayıcı yoksa sistemi boş bırakmaz.')
on conflict (provider_key) do update set
  provider_name = excluded.provider_name,
  role_label = excluded.role_label,
  default_model = excluded.default_model,
  purpose = excluded.purpose,
  notes = excluded.notes,
  updated_at = now();

insert into public.agent_prompts (provider_key, task_type, title, prompt_text, is_default, is_active)
values
  ('manus', 'competitor_research', 'Manus rakip araştırması', 'Rakipleri, teklif dillerini, reklam açılarını, fiyat sinyallerini ve karşı hamle önerilerini kapsamlı araştır. Yanıtı tamamen Türkçe ver.', true, true),
  ('manus', 'market_research', 'Manus pazar araştırması', 'Pazar büyüklüğü, talep sinyalleri, şehir/segment fırsatları ve ajans için satış önceliğini derin araştır. Yanıtı tamamen Türkçe ver.', true, true),
  ('manus', 'pricing_research', 'Manus fiyat karşılaştırması', 'Sektör fiyat aralıklarını, rakip paketlerini ve önerilen HK Dijital teklif fiyatını araştır. Yanıtı tamamen Türkçe ver.', true, true),
  ('openai', 'ad_analysis', 'OpenAI reklam analizi', 'Reklam performansını CTR, CPC, CPM, lead/mesaj ve bütçe verimliliğine göre yorumla. Risk, fırsat ve 7 günlük aksiyon planı üret.', true, true),
  ('openai', 'customer_report', 'OpenAI müşteri raporu', 'Müşteri raporunu sade Türkçe ile yaz. Teknik terim kullanırsan parantez içinde kısa açıklamasını ekle.', true, true),
  ('anthropic', 'customer_report', 'Claude detaylı rapor', 'Müşteri için ölçülü, garantisiz, profesyonel dönem raporu ve yönetici özeti hazırla.', false, true),
  ('groq', 'fast_answer', 'Groq hızlı cevap', 'Kısa, net ve uygulanabilir cevap ver. Gereksiz teknik detaya girme.', true, true)
on conflict do nothing;

insert into public.agent_workflows (name, description, steps, is_active)
values
  ('Müşteri Reklam Sağlık Analizi', 'Meta ve Google verilerini okuyup HK Intelligence aksiyon planına dönüştürür.', '["Müşteri seç","Meta verisini oku","Google Ads verisini oku","OpenAI/Gemini ile yorumla","HK Intelligence aksiyon planı oluştur"]'::jsonb, true),
  ('Derin Rakip Analizi', 'Rakip/pazar araştırmasını Manus ile derinleştirip satış fırsatlarını çıkarır.', '["Müşteri web sitesini oku","Rakipleri bul","Manus ile araştır","Gemini ile SEO kıyasla","OpenAI ile satış fırsatlarını çıkar"]'::jsonb, true),
  ('Teklif Hazırlama', 'Sektör potansiyeli ve müşteri verisinden teklif metni ve PDF hazırlığı üretir.', '["Müşteri verilerini oku","Sektör potansiyelini hesapla","Claude/OpenAI ile teklif metni oluştur","PDF hazırlığı çıktısı üret"]'::jsonb, true)
on conflict do nothing;

notify pgrst, 'reload schema';
