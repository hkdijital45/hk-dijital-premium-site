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
  if (!company) return { ok: false, error: "Müşteri kaydı bulunamadı." as const };
  if (!company.deleted_at && String(company.status || "").toLocaleLowerCase("tr-TR") !== "silindi") {
    return { ok: false, error: "Kalıcı silmeden önce müşteri silinenlere taşınmalı." as const };
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

export async function permanentlyDeleteLead(id: string, session: AppSession) {
  const existingRows = await supabaseRest<Array<{ id: string; company_id?: string | null }>>(`leads?id=eq.${encodeURIComponent(id)}&select=id,company_id&limit=1`);
  if (!existingRows[0]) return { ok: false, error: "Başvuru bulunamadı." as const };

  await recordActivity({
    session,
    action: "Silme",
    entity: "Başvuru",
    entityId: id,
    companyId: existingRows[0].company_id,
    details: { message: "CRM başvurusu kalıcı olarak silindi.", permanent_delete: true }
  });
  await supabaseRest(`leads?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  return { ok: true as const };
}
