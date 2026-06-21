-- Customer file preview and creative center support.
-- Keeps existing customer file records usable while adding explicit creative visibility.

alter table if exists public.customer_files
  add column if not exists file_url text,
  add column if not exists document_url text,
  add column if not exists file_type text default 'Diğer',
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists visible_to_customer boolean default false,
  add column if not exists show_in_creative_center boolean default false,
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if to_regclass('public.customer_files') is not null then
    update public.customer_files
    set document_url = file_url
    where document_url is null
      and file_url is not null;

    update public.customer_files
    set file_url = document_url
    where file_url is null
      and document_url is not null;

    update public.customer_files
    set show_in_creative_center = true
    where coalesce(show_in_creative_center, false) = false
      and file_type in ('Görsel', 'Reklam Görseli', 'Kreatif');

    create index if not exists customer_files_company_visible_idx
      on public.customer_files(company_id, visible_to_customer);

    create index if not exists customer_files_creative_visible_idx
      on public.customer_files(company_id, show_in_creative_center, visible_to_customer);
  end if;
end $$;
