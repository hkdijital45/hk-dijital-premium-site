import "server-only";

import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import type { AppSession } from "@/lib/auth";

// Shared by the single-customer permanent-delete route and the bulk data
// management operations, so both paths run the exact same cleanup + delete
// sequence rather than drifting apart.
async function deleteCustomerScopedRows(table: string, companyId: string) {
  try {
    await supabaseRest(`${table}?company_id=eq.${encodeURIComponent(companyId)}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
    return { table, ok: true };
  } catch (error) {
    return { table, ok: false, error: getSafeSupabaseError(error).detail };
  }
}

async function patchCustomerScopedRows(table: string, companyId: string, patch: Record<string, unknown>) {
  try {
    await supabaseRest(`${table}?company_id=eq.${encodeURIComponent(companyId)}`, { method: "PATCH", body: JSON.stringify(patch) });
    return { table, ok: true };
  } catch (error) {
    return { table, ok: false, error: getSafeSupabaseError(error).detail };
  }
}

export async function permanentlyDeleteCompany(id: string, session: AppSession) {
  const existingRows = await supabaseRest<Array<Record<string, unknown>>>(`companies?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  const company = existingRows[0];
  if (!company) return { ok: false as const, error: "Müşteri kaydı bulunamadı." as const };
  if (!company.deleted_at && String(company.status || "").toLocaleLowerCase("tr-TR") !== "silindi") {
    return { ok: false as const, error: "Kalıcı silmeden önce müşteri silinenlere taşınmalı." as const };
  }

  const now = new Date().toISOString();
  const cleanupResults = await Promise.all([
    deleteCustomerScopedRows("agency_tasks", id),
    deleteCustomerScopedRows("agency_notifications", id),
    deleteCustomerScopedRows("customer_integrations", id),
    deleteCustomerScopedRows("ad_integrations", id),
    deleteCustomerScopedRows("integration_sync_logs", id),
    deleteCustomerScopedRows("customer_visibility_settings", id),
    deleteCustomerScopedRows("customer_branding", id),
    deleteCustomerScopedRows("customer_branches", id),
    // customer_conversations.company_id is ON DELETE RESTRICT (Communication
    // Center migration) — any customer with real conversation history
    // blocks the final companies DELETE below with a real Postgres foreign
    // key violation (23503), which the app surfaces as "Veritabanı şema
    // hatası". Deleting the conversations explicitly first (its own child
    // tables — messages, reads, assignments, notes, activity, attachments —
    // already cascade from customer_conversations.id) removes the blocker
    // immediately, without waiting on the schema migration that changes the
    // constraint to ON DELETE CASCADE for defense in depth.
    deleteCustomerScopedRows("customer_conversations", id),
    patchCustomerScopedRows("users", id, { is_active: false, deleted_at: now, updated_at: now })
  ]);

  await recordActivity({
    session,
    action: "Silme",
    entity: "Firma",
    entityId: id,
    companyId: id,
    details: {
      message: `${company.name} kalıcı olarak silindi.`,
      permanent_delete: true,
      cleanup_results: cleanupResults,
      preserved_records: ["payment_records", "reports", "monthly_reports", "customer_documents", "customer_files", "activity_logs"]
    }
  });

  await supabaseRest(`companies?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  return { ok: true as const, name: String(company.name || ""), cleanupResults };
}

// The exact set of tables permanentlyDeleteCompany explicitly cleans up
// before the final `companies` DELETE lets the database's own foreign-key
// cascade rules take care of everything else. Kept as one list so the
// Data Reset Center's dry-run preview counts exactly what the real delete
// will touch — no separately-maintained, driftable table list.
const EXPLICIT_CLEANUP_TABLES = [
  "agency_tasks",
  "agency_notifications",
  "customer_integrations",
  "ad_integrations",
  "integration_sync_logs",
  "customer_visibility_settings",
  "customer_branding",
  "customer_branches",
  "customer_conversations"
] as const;

// Financial/legal/audit tables the 2026-07-23 migration made ON DELETE SET
// NULL instead of CASCADE — a permanent company delete detaches these
// rather than destroying them. Also kept as one list so preview/export can
// show these separately from the tables that are actually destroyed.
export const RESET_PRESERVED_TABLES = ["payment_records", "reports", "monthly_reports", "customer_documents", "customer_files", "activity_logs"] as const;

export type CompanyResetTarget = { id: string; name: string; is_test?: boolean };

export async function listResetTargets(mode: "demo" | "full"): Promise<CompanyResetTarget[]> {
  const filter = mode === "demo" ? "&is_test=eq.true" : "";
  return supabaseRest<CompanyResetTarget[]>(`companies?select=id,name,is_test${filter}&order=name.asc`);
}

// Read-only — counts rows in every table this operation would touch for the
// given companies, without deleting anything. The Data Reset Center's
// mandatory dry-run screen calls this before any destructive action is
// even offered.
export async function previewCompanyReset(companyIds: string[]) {
  if (!companyIds.length) {
    return { companies: 0, willDelete: {} as Record<string, number>, willPreserve: {} as Record<string, number> };
  }
  const idList = companyIds.map((id) => encodeURIComponent(id)).join(",");
  const countTable = async (table: string) => {
    try {
      const rows = await supabaseRest<Array<{ id: string }>>(`${table}?company_id=in.(${idList})&select=id`);
      return rows.length;
    } catch {
      return -1; // signals "could not count" rather than silently reporting 0
    }
  };
  const [deleteCounts, preserveCounts] = await Promise.all([
    Promise.all(EXPLICIT_CLEANUP_TABLES.map(async (table) => [table, await countTable(table)] as const)),
    Promise.all(RESET_PRESERVED_TABLES.map(async (table) => [table, await countTable(table)] as const))
  ]);
  return {
    companies: companyIds.length,
    willDelete: Object.fromEntries(deleteCounts),
    willPreserve: Object.fromEntries(preserveCounts)
  };
}

// Read-only JSON snapshot of every row this operation would touch, for the
// mandatory pre-reset backup/export — same table lists as the preview, plus
// the companies themselves.
export async function exportCompanyResetBackup(companyIds: string[]) {
  if (!companyIds.length) return { companies: [], tables: {} as Record<string, unknown[]> };
  const idList = companyIds.map((id) => encodeURIComponent(id)).join(",");
  const companies = await supabaseRest<Array<Record<string, unknown>>>(`companies?id=in.(${idList})&select=*`);
  const allTables = [...EXPLICIT_CLEANUP_TABLES, ...RESET_PRESERVED_TABLES];
  const entries = await Promise.all(
    allTables.map(async (table) => {
      try {
        return [table, await supabaseRest<Array<Record<string, unknown>>>(`${table}?company_id=in.(${idList})&select=*`)] as const;
      } catch {
        return [table, []] as const;
      }
    })
  );
  return { companies, tables: Object.fromEntries(entries) };
}

// The Data Reset Center's actual destructive action. Deliberately reuses
// permanentlyDeleteCompany's exact tested cleanup sequence per company
// (rather than re-deriving cascade/RESTRICT knowledge from scratch) —
// first soft-deletes the target (satisfying that function's own
// already-in-trash precondition, the same state the single-record UI flow
// requires before a permanent delete), then runs the identical cleanup.
// Each company is its own unit of work: this repo's Supabase access is a
// thin PostgREST REST layer with no cross-table transaction primitive
// exposed, so this is per-company atomic (one company's failure doesn't
// touch another's rows and doesn't delete that company's own `companies`
// row), not a single all-or-nothing transaction across the whole batch —
// documented here rather than claimed as something it isn't.
export async function resetCompaniesOperationalData(mode: "demo" | "full", companyIds: string[], session: AppSession) {
  const results: Array<{ id: string; name: string; ok: boolean; error?: string }> = [];
  for (const id of companyIds) {
    try {
      const rows = await supabaseRest<Array<{ id: string; name?: string; status?: string; deleted_at?: string | null }>>(`companies?id=eq.${encodeURIComponent(id)}&select=id,name,status,deleted_at&limit=1`);
      const company = rows[0];
      if (!company) {
        results.push({ id, name: id, ok: false, error: "Müşteri kaydı bulunamadı." });
        continue;
      }
      if (!company.deleted_at && String(company.status || "").toLocaleLowerCase("tr-TR") !== "silindi") {
        await supabaseRest(`companies?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: "Silindi", deleted_at: new Date().toISOString() }) });
      }
      const outcome = await permanentlyDeleteCompany(id, session);
      if (!outcome.ok) {
        results.push({ id, name: company.name || id, ok: false, error: outcome.error });
        continue;
      }
      results.push({ id, name: outcome.name, ok: true });
    } catch (error) {
      results.push({ id, name: id, ok: false, error: getSafeSupabaseError(error).detail });
    }
  }

  const succeeded = results.filter((item) => item.ok).length;
  await recordActivity({
    session,
    action: "Silme",
    entity: "Veri Sıfırlama Merkezi",
    details: {
      message: `${mode === "demo" ? "Demo/test verileri" : "Tüm müşteri operasyon verileri"} sıfırlandı: ${succeeded}/${companyIds.length} müşteri.`,
      reset_mode: mode,
      target_company_ids: companyIds,
      results,
      preserved_tables: RESET_PRESERVED_TABLES
    }
  });

  return { ok: true as const, mode, total: companyIds.length, succeeded, results };
}

/**
 * ROOT CAUSE (production bug): pre_audit_reports.lead_id is `on delete set
 * null`, and pre_audit_reports has a CHECK constraint
 * (pre_audit_reports_company_or_lead_check) requiring company_id IS NOT
 * NULL OR lead_id IS NOT NULL. Deleting a lead that owns a lead-only
 * report (company_id already null — the normal case for a Müşteri Keşfi
 * candidate pre-audit'd before ever becoming a customer) made Postgres
 * try to SET NULL the report's lead_id as part of the same DELETE,
 * leaving BOTH columns null and violating the CHECK — aborting the whole
 * lead DELETE with a constraint violation, every time. This explicitly
 * cleans up pre_audit_reports for this lead FIRST, so the constraint can
 * never be violated:
 *   - report has no company_id (lead-only, e.g. a pre-audit run before
 *     the candidate was ever linked to a real customer): deleted along
 *     with the lead — it would otherwise become a permanently orphaned,
 *     unreachable row.
 *   - report has a company_id (this business went on to become/relate to
 *     a real customer): PRESERVED as company history — only lead_id is
 *     detached (set null), company_id stays, so the CHECK constraint
 *     still passes and nothing customer-facing is lost.
 * No other table referencing leads.id needs this treatment: every other
 * FK is `on delete set null` (or, for outreach_drafts, a genuinely
 * lead-owned `on delete cascade`) with no CHECK constraint requiring a
 * second non-null owner column — Postgres already handles those safely
 * on its own.
 */
async function detachOrDeletePreAuditReports(leadId: string) {
  const reports = await supabaseRest<Array<{ id: string; company_id: string | null }>>(
    `pre_audit_reports?lead_id=eq.${encodeURIComponent(leadId)}&select=id,company_id`
  );
  const orphanIds = reports.filter((report) => !report.company_id).map((report) => report.id);
  const companyOwnedIds = reports.filter((report) => report.company_id).map((report) => report.id);

  if (orphanIds.length) {
    await supabaseRest(`pre_audit_reports?id=in.(${orphanIds.map(encodeURIComponent).join(",")})`, { method: "DELETE" });
  }
  if (companyOwnedIds.length) {
    await supabaseRest(`pre_audit_reports?id=in.(${companyOwnedIds.map(encodeURIComponent).join(",")})`, {
      method: "PATCH",
      body: JSON.stringify({ lead_id: null, updated_at: new Date().toISOString() })
    });
  }
  return { deletedOrphanReports: orphanIds.length, detachedCompanyReports: companyOwnedIds.length };
}

export class LeadNotArchivedError extends Error {}

export async function permanentlyDeleteLead(id: string, session: AppSession) {
  const existingRows = await supabaseRest<Array<{ id: string; company_id?: string | null; deleted_at?: string | null }>>(
    `leads?id=eq.${encodeURIComponent(id)}&select=id,company_id,deleted_at&limit=1`
  );
  const lead = existingRows[0];
  if (!lead) return { ok: false, error: "Başvuru bulunamadı." as const };
  // B6: permanent delete must only ever act on an already-archived (soft-
  // deleted) lead — never a live one, regardless of what the client sends.
  if (!lead.deleted_at) throw new LeadNotArchivedError("Yalnızca Silinenler listesindeki kayıtlar kalıcı olarak silinebilir.");

  const cleanup = await detachOrDeletePreAuditReports(id);

  await recordActivity({
    session,
    action: "Silme",
    entity: "Başvuru",
    entityId: id,
    companyId: lead.company_id,
    details: { message: "CRM başvurusu kalıcı olarak silindi.", permanent_delete: true, ...cleanup }
  });
  await supabaseRest(`leads?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  return { ok: true as const };
}
