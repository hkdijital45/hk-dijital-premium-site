-- Root cause of "Müşteriyi Kalıcı Sil" failing in production with the
-- toast "Veritabanı şema hatası": customer_conversations.company_id was
-- created with ON DELETE RESTRICT (see 20260715_customer_communication_center.sql).
-- Any customer with real Communication Center history blocks the final
-- `DELETE FROM companies` with a genuine Postgres foreign key violation:
--
--   code: 23503
--   message: update or delete on table "companies" violates foreign key
--            constraint "customer_conversations_company_id_fkey" on table
--            "customer_conversations"
--   details: Key (id)=(...) is still referenced from table "customer_conversations".
--
-- The application now also deletes customer_conversations explicitly before
-- the final company delete (belt-and-suspenders fix, already deployed and
-- works without this migration). This migration corrects the constraint
-- itself so the schema is consistent for any other/future deletion path.
-- customer_conversations' own child tables (customer_messages,
-- conversation_reads, conversation_assignments, conversation_internal_notes,
-- conversation_activity, conversation_attachments) already cascade from
-- customer_conversations.id, so cascading the company_id link removes the
-- entire conversation history with the customer — treated as operational
-- data, consistent with agency_tasks/customer_integrations/etc., not as a
-- retained financial/audit record.
alter table if exists public.customer_conversations
  drop constraint if exists customer_conversations_company_id_fkey,
  add constraint customer_conversations_company_id_fkey foreign key (company_id) references public.companies(id) on delete cascade;
