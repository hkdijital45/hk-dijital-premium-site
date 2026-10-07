-- "HK Dijital ile Çalışan Markalar": admin-managed brand showcase shown on
-- the public homepage. One flat table (no relational services table —
-- services is a small, order-preserving JSON array the admin edits as
-- chips, which keeps this additive and simple) plus a public storage
-- bucket for logos. Idempotent: safe to run once; re-running is a no-op.
create table if not exists public.brand_showcases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  services jsonb not null default '[]'::jsonb,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The public homepage query filters on is_active and orders by sort_order.
create index if not exists brand_showcases_public_order_idx
  on public.brand_showcases (is_active, sort_order);

-- Public bucket for brand logos, following the same pattern as the existing
-- customer-assets bucket (public=true, no RLS policy — every write in this
-- project already goes through the server-side service-role key).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-showcases',
  'brand-showcases',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
