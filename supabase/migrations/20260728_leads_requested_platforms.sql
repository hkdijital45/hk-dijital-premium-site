-- Paket Öneri Robotu (/teklif-al) "Platform İhtiyacınız" step is now
-- multi-select. Persist the selected services on the lead record.
--
-- Safe/backward compatible: additive column, nullable-equivalent default of
-- an empty array, no existing rows are modified or dropped. Canonical
-- values are "meta" | "google" | "social-media" only — "Hepsi" is a
-- client-side select-all shortcut and is never stored literally.
alter table public.leads
  add column if not exists requested_platforms text[] not null default '{}'::text[];
