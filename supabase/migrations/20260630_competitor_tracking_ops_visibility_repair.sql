alter table if exists public.competitor_watchlist
  add column if not exists is_tracking boolean default false;

alter table if exists public.competitor_watchlist
  add column if not exists archived_at timestamptz;

alter table if exists public.competitor_watchlist
  add column if not exists deleted_at timestamptz;

alter table if exists public.competitor_watchlist
  add column if not exists last_signal_at timestamptz;

alter table if exists public.competitor_watchlist
  add column if not exists next_check_at timestamptz;

alter table if exists public.competitor_watchlist
  add column if not exists notification_channels jsonb default '[]'::jsonb;

alter table if exists public.competitor_signals
  add column if not exists resolved_at timestamptz;

alter table if exists public.competitor_signals
  add column if not exists resolved_by uuid references public.users(id) on delete set null;

alter table if exists public.competitor_signals
  add column if not exists customer_visible_summary text;

alter table if exists public.competitor_signals
  add column if not exists agency_action text;

create index if not exists competitor_watchlist_tracking_idx
  on public.competitor_watchlist (is_tracking);

create index if not exists competitor_watchlist_next_check_idx
  on public.competitor_watchlist (next_check_at);

create index if not exists competitor_watchlist_archived_idx
  on public.competitor_watchlist (archived_at);

create index if not exists competitor_watchlist_deleted_idx
  on public.competitor_watchlist (deleted_at);

create index if not exists competitor_watchlist_last_signal_idx
  on public.competitor_watchlist (last_signal_at);

create index if not exists competitor_signals_resolved_idx
  on public.competitor_signals (resolved_at);

create index if not exists competitor_signals_customer_visible_idx
  on public.competitor_signals (show_to_customer);

create index if not exists competitor_signals_action_status_idx
  on public.competitor_signals (action_status);
