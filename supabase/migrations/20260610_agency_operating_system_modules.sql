create table if not exists customer_branding (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  logo_url text,
  brand_name text,
  primary_color text default '#22d3ee',
  secondary_color text default '#0f172a',
  welcome_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(company_id)
);

create table if not exists monthly_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  report_month text not null,
  summary text,
  meta_metrics jsonb default '{}'::jsonb,
  google_metrics jsonb default '{}'::jsonb,
  social_metrics jsonb default '{}'::jsonb,
  ai_interpretation text,
  next_month_recommendations text,
  status text default 'Taslak',
  visible_to_customer boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists agency_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete set null,
  title text not null,
  status text default 'Yapılacak',
  priority text default 'Orta',
  due_date date,
  notes text,
  assigned_user_id uuid references users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists customer_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  title text not null,
  document_type text default 'Diğer',
  document_url text,
  document_date date,
  visible_to_customer boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists payment_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  amount numeric default 0,
  due_date date,
  payment_date date,
  status text default 'Bekliyor',
  payment_note text,
  service_period text,
  visible_to_customer boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists competitor_analyses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  sector text,
  city text,
  district text,
  competitors jsonb default '[]'::jsonb,
  ai_summary text,
  opportunities text,
  recommended_actions text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists social_media_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  sector text,
  goal text,
  platform text,
  duration text,
  plan_items jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists agency_expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric default 0,
  expense_date date,
  category text default 'Diğer',
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sector_configs (
  id uuid primary key default gen_random_uuid(),
  sector_name text not null unique,
  suggested_crm_fields jsonb default '[]'::jsonb,
  suggested_package_labels jsonb default '[]'::jsonb,
  suggested_report_metrics jsonb default '[]'::jsonb,
  suggested_content_categories jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into sector_configs (sector_name, suggested_crm_fields, suggested_package_labels, suggested_report_metrics, suggested_content_categories)
values
  ('Oto Galeri', '["Araç türü","Stok adedi","Aylık satış hedefi","WhatsApp hattı"]', '["Vitrin Paketi","Lead Paketi","Premium Satış Paketi"]', '["Araç ilan tıklaması","WhatsApp mesajı","Form lead"]', '["Araç tanıtımı","Finansman duyurusu","Müşteri teslimatı"]'),
  ('Emlak Ofisi', '["Portföy tipi","Bölge","Satılık/kiralık oranı","Danışman sayısı"]', '["Portföy Görünürlük","Bölgesel Lead","Premium Emlak"]', '["Portföy görüntülenme","Arama tıklaması","Form lead"]', '["Portföy tanıtımı","Bölge analizi","Müşteri yorumu"]'),
  ('Güzellik Merkezi', '["Hizmetler","Randevu hattı","Kampanya dönemi","Şube sayısı"]', '["Randevu Paketi","Instagram Büyüme","Premium Klinik"]', '["Randevu mesajı","Profil ziyareti","Form lead"]', '["Önce/sonra","Hizmet tanıtımı","Uzman önerisi"]'),
  ('Klinik', '["Branş","Randevu kanalı","Doktor sayısı","Lokasyon"]', '["Güven Paketi","Randevu Paketi","Premium Sağlık"]', '["Randevu talebi","Telefon tıklaması","Web trafik"]', '["Bilgilendirici içerik","Hasta yolculuğu","Soru cevap"]'),
  ('Eğitim Merkezi', '["Kurs türü","Kayıt dönemi","Öğrenci hedefi","Şube"]', '["Kayıt Paketi","Dönem Kampanyası","Premium Eğitim"]', '["Başvuru","Telefon tıklaması","Web trafik"]', '["Kurs tanıtımı","Başarı hikayesi","Veli bilgilendirme"]')
on conflict (sector_name) do nothing;
