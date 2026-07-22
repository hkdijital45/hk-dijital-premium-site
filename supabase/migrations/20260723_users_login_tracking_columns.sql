-- Final Development Sprint B — Kullanıcı Yönetimi.
-- src/lib/activity-log.ts's recordCustomerLogin() has always written
-- last_login_at/login_count on public.users, and AdminDashboard.tsx's müşteri
-- kullanıcı listesi has always displayed "Son giriş" / "Toplam giriş" from
-- these same fields — but no migration ever created the columns, so every
-- login silently failed to persist them (caught and logged, never surfaced)
-- and the UI always showed empty/zero values.

alter table if exists public.users
  add column if not exists last_login_at timestamptz,
  add column if not exists login_count integer not null default 0;

-- RLS already enabled on public.users (supabase/migrations/20260719_rls_lockdown.sql);
-- no policy change needed, all access continues through
-- SUPABASE_SERVICE_ROLE_KEY server-side routes.
