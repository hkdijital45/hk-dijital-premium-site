-- Reversible soft-delete for Teklif Merkezi (SİL action), distinct from
-- the already-applied archived_at (ARŞİVLE action, 20261014_proposals_archive.sql).
-- Same deleted_at convention already used by agency_tasks/leads in this
-- project. Archive state and delete state are deliberately independent
-- columns — a proposal can be "Gönderildi" + archived, or deleted,
-- without the two concepts interfering with each other.
alter table public.proposals
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null;

create index if not exists proposals_deleted_at_idx on public.proposals (deleted_at);

notify pgrst, 'reload schema';
