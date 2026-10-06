// Operations on a pre-audit analysis group. Archiving reuses the existing
// pre_audit_reports.status column (no schema change): archived reports keep
// their content and leave the active list until restored.
export const PRE_AUDIT_ACTIVE_STATUS = "draft";
export const PRE_AUDIT_ARCHIVED_STATUS = "archived";

export type PreAuditReportPatch = { title?: string; sales_notes?: string; status?: string };

export function isArchivedPreAuditReport(report: { status?: string | null }): boolean {
  return report.status === PRE_AUDIT_ARCHIVED_STATUS;
}

export function validatePreAuditReportPatch(input: unknown): { ok: true; patch: PreAuditReportPatch } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Geçersiz istek." };
  const body = input as Record<string, unknown>;
  const patch: PreAuditReportPatch = {};
  if ("title" in body) {
    const title = String(body.title ?? "").trim();
    if (!title || title.length > 200) return { ok: false, error: "Başlık 1–200 karakter olmalıdır." };
    patch.title = title;
  }
  if ("sales_notes" in body) {
    const notes = String(body.sales_notes ?? "").trim();
    if (notes.length > 5000) return { ok: false, error: "Satış notu en fazla 5000 karakter olabilir." };
    patch.sales_notes = notes;
  }
  if ("archived" in body) {
    if (typeof body.archived !== "boolean") return { ok: false, error: "Arşiv durumu geçersiz." };
    patch.status = body.archived ? PRE_AUDIT_ARCHIVED_STATUS : PRE_AUDIT_ACTIVE_STATUS;
  }
  if (!Object.keys(patch).length) return { ok: false, error: "Güncellenecek alan yok." };
  return { ok: true, patch };
}
