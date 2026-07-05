create table if not exists public.customer_ai_settings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.companies(id) on delete cascade,
  assistant_enabled boolean not null default true,
  real_ai_enabled boolean not null default false,
  provider text not null default 'demo',
  allowed_contexts text[] not null default array['general']::text[],
  daily_message_limit integer not null default 20,
  welcome_message text not null default 'Merhaba, HK Asistan size rapor, reklam, görev ve içerik konularında yardımcı olur.',
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_ai_settings_customer_id_uidx
  on public.customer_ai_settings(customer_id);

create index if not exists customer_ai_settings_provider_idx
  on public.customer_ai_settings(provider);

create index if not exists customer_ai_settings_assistant_enabled_idx
  on public.customer_ai_settings(assistant_enabled);

create or replace function public.set_customer_ai_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_ai_settings_set_updated_at on public.customer_ai_settings;

create trigger customer_ai_settings_set_updated_at
before update on public.customer_ai_settings
for each row
execute function public.set_customer_ai_settings_updated_at();

alter table public.customer_ai_settings enable row level security;

drop policy if exists "customer_ai_settings_service_role_all" on public.customer_ai_settings;

create policy "customer_ai_settings_service_role_all"
on public.customer_ai_settings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
