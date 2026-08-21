-- Document/export system finalization: customer_documents and
-- customer_files both need real upload metadata columns.
--
-- customer_files: the "Dosyalar" tab's upload route
-- (src/app/api/admin/customers/[id]/files/upload/route.ts) already writes
-- storage_path/mime_type/file_size/uploaded_by on every real upload — but
-- those columns never existed, so every real upload through that route has
-- been failing with a real Postgres "column does not exist" error (42703),
-- surfaced to the user as a generic "Dosya yüklenemedi." This migration
-- makes that already-written code path actually work, rather than adding
-- new code around a schema gap.
--
-- customer_documents: needed for the new document-generation flow (Word/
-- PDF/PowerPoint export) to record a real, storage-backed document instead
-- of only ever supporting a manually-typed external URL.
alter table if exists public.customer_files
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists uploaded_by uuid references public.users(id) on delete set null;

alter table if exists public.customer_documents
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists uploaded_by uuid references public.users(id) on delete set null,
  add column if not exists source_module text,
  add column if not exists created_by uuid references public.users(id) on delete set null;

create index if not exists customer_files_uploaded_by_idx on public.customer_files(uploaded_by);
create index if not exists customer_documents_uploaded_by_idx on public.customer_documents(uploaded_by);
create index if not exists customer_documents_source_module_idx on public.customer_documents(source_module);

comment on column public.customer_files.storage_path is 'Path within the customer-assets Supabase Storage bucket for a real uploaded file, null for legacy URL-only rows.';
comment on column public.customer_documents.storage_path is 'Path within the customer-assets Supabase Storage bucket for a real uploaded/generated file, null for legacy URL-only rows.';
comment on column public.customer_documents.source_module is 'Which part of the app generated this document, e.g. "Agent Hub", "Manual Upload" — lets the Belgeler list show provenance.';

notify pgrst, 'reload schema';
