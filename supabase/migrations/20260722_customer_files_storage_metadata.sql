-- Documents ("Dosyalar" / Belgeler) tab real upload support.
--
-- Before this migration, customer_files only had `file_url`/`document_url`
-- text columns — no genuine upload flow existed, only a manual URL text
-- field plus the generic /api/media uploader (which returns a public URL
-- with no per-file metadata). This adds the metadata columns a real secure
-- upload flow needs, without touching or breaking any existing row: all new
-- columns are nullable, existing manual-URL records keep working exactly as
-- before (storage_path/mime_type/file_size/uploaded_by simply stay null for
-- them).

alter table if exists public.customer_files
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists uploaded_by uuid references public.users(id) on delete set null;

comment on column public.customer_files.storage_path is
  'Supabase Storage object path (bucket: customer-assets) for files uploaded via the real upload flow. Null for legacy manual-URL records.';
