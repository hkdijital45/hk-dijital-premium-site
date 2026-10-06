// Ön İnceleme Hazırlığı — structured prep notes an admin fills in on a
// lead before handing it to Claude Project for the actual pre-audit.
// Deliberately a SEPARATE status from both leads.status (sales pipeline)
// and the existing Müşteri Keşfi pre-review queue status
// (LEAD_PRE_REVIEW_STATUS, also stored on leads.status) — conflating
// either with this would silently corrupt the other, which is exactly
// what this table exists to avoid. One row per lead (lead_id unique).
import "server-only";
import { supabaseRest } from "@/lib/supabase";
import { PLATFORM_LABELS, type PlatformKey } from "@/lib/platform-selection";
import { buildPreAuditLeadPrompt, type PreAuditLeadSnapshot } from "@/lib/pre-audit-lead-prompt";

export const LEAD_PRE_AUDIT_PREP_TABLE = "lead_pre_audit_preparations";

export const LEAD_PRE_AUDIT_PREP_STATUSES = ["not_prepared", "preparing", "ready", "sent_to_claude", "completed", "failed"] as const;
export type LeadPreAuditPrepStatus = (typeof LEAD_PRE_AUDIT_PREP_STATUSES)[number];
export const LEAD_PRE_AUDIT_PREP_STATUS_LABELS: Record<LeadPreAuditPrepStatus, string> = {
  not_prepared: "Hazırlanmadı", preparing: "Hazırlanıyor", ready: "Hazır",
  sent_to_claude: "Claude'a Gönderildi", completed: "Tamamlandı", failed: "Başarısız"
};

export const LEAD_ADVERTISING_STATUSES = ["yes", "no", "unknown"] as const;
export type LeadAdvertisingStatus = (typeof LEAD_ADVERTISING_STATUSES)[number];

export type LeadPreAuditPreparation = {
  id: string; lead_id: string;
  social_observations: string; business_notes: string;
  advertising_status: LeadAdvertisingStatus;
  potential_reason: string; focus_notes: string; competitor_reference: string;
  status: LeadPreAuditPrepStatus;
  created_at: string; updated_at: string;
};

export class LeadPreAuditPrepValidationError extends Error {}
export class LeadNotFoundError extends Error {}

async function assertLeadExists(leadId: unknown): Promise<string> {
  if (typeof leadId !== "string" || !leadId.trim()) throw new LeadPreAuditPrepValidationError("leadId zorunludur.");
  const rows = await supabaseRest<Array<{ id: string }>>(`leads?id=eq.${encodeURIComponent(leadId)}&select=id&limit=1`);
  if (!rows.length) throw new LeadNotFoundError(`Lead bulunamadı: ${leadId}`);
  return leadId;
}

/** A completed pre_audit_reports row for this lead always overrides a
 * stale "preparing"/"sent_to_claude" stored status on read — the report
 * itself (not an admin click) is the real source of truth for
 * "completed", so this can never drift out of sync with Ön İnceleme
 * Merkezi. */
async function reconcileCompletedStatus(prep: LeadPreAuditPreparation): Promise<LeadPreAuditPreparation> {
  if (prep.status === "completed") return prep;
  const reports = await supabaseRest<Array<{ id: string }>>(`pre_audit_reports?lead_id=eq.${encodeURIComponent(prep.lead_id)}&select=id&limit=1`).catch(() => []);
  if (!reports.length) return prep;
  const rows = await supabaseRest<LeadPreAuditPreparation[]>(
    `${LEAD_PRE_AUDIT_PREP_TABLE}?lead_id=eq.${encodeURIComponent(prep.lead_id)}&select=*`,
    { method: "PATCH", body: JSON.stringify({ status: "completed" }) }
  );
  return rows[0] || { ...prep, status: "completed" };
}

export async function getOrCreatePreparation(leadId: string): Promise<LeadPreAuditPreparation> {
  await assertLeadExists(leadId);
  const existing = await supabaseRest<LeadPreAuditPreparation[]>(`${LEAD_PRE_AUDIT_PREP_TABLE}?lead_id=eq.${encodeURIComponent(leadId)}&select=*&limit=1`);
  if (existing[0]) return reconcileCompletedStatus(existing[0]);
  const created = await supabaseRest<LeadPreAuditPreparation[]>(LEAD_PRE_AUDIT_PREP_TABLE, { method: "POST", body: JSON.stringify({ lead_id: leadId }) });
  return created[0];
}

export type LeadPreAuditPrepPatch = Partial<{
  social_observations: string; business_notes: string; advertising_status: LeadAdvertisingStatus;
  potential_reason: string; focus_notes: string; competitor_reference: string; status: LeadPreAuditPrepStatus;
}>;

const EDITABLE_FIELDS = ["social_observations", "business_notes", "advertising_status", "potential_reason", "focus_notes", "competitor_reference", "status"] as const;

export async function savePreparation(leadId: string, patch: LeadPreAuditPrepPatch): Promise<LeadPreAuditPreparation> {
  await assertLeadExists(leadId);
  if (patch.advertising_status && !(LEAD_ADVERTISING_STATUSES as readonly string[]).includes(patch.advertising_status)) {
    throw new LeadPreAuditPrepValidationError(`Geçersiz reklam durumu: ${patch.advertising_status}.`);
  }
  if (patch.status && !(LEAD_PRE_AUDIT_PREP_STATUSES as readonly string[]).includes(patch.status)) {
    throw new LeadPreAuditPrepValidationError(`Geçersiz hazırlık durumu: ${patch.status}.`);
  }
  const body: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) if (field in patch) body[field] = (patch as Record<string, unknown>)[field];
  req(Object.keys(body).length > 0, "Güncellenecek en az bir alan belirtilmelidir.");

  // Ensure the row exists first (1:1, created lazily on first open) so a
  // PATCH never silently no-ops against a missing row.
  await getOrCreatePreparation(leadId);
  const rows = await supabaseRest<LeadPreAuditPreparation[]>(
    `${LEAD_PRE_AUDIT_PREP_TABLE}?lead_id=eq.${encodeURIComponent(leadId)}&select=*`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
  if (!rows.length) throw new LeadNotFoundError(`Hazırlık kaydı güncellenemedi: ${leadId}`);
  return rows[0];
}

function req(cond: unknown, message: string) {
  if (!cond) throw new LeadPreAuditPrepValidationError(message);
}

const LEAD_SNAPSHOT_COLUMNS = "company,business_type,address,instagram,website,goal,budget,requested_platforms,message";

/** Reads the lead fields the pre-audit prompt uses. pre_analysis is selected
 * separately and only when its column exists, so older schemas keep working. */
export async function loadLeadPreAuditSnapshot(leadId: string): Promise<PreAuditLeadSnapshot> {
  await assertLeadExists(leadId);
  const base = await supabaseRest<Array<Record<string, unknown>>>(`leads?id=eq.${encodeURIComponent(leadId)}&select=${LEAD_SNAPSHOT_COLUMNS}&limit=1`);
  const row = base[0] || {};
  const withPre = await supabaseRest<Array<{ pre_analysis?: PreAuditLeadSnapshot["pre_analysis"] }>>(`leads?id=eq.${encodeURIComponent(leadId)}&select=pre_analysis&limit=1`).catch(() => []);
  return {
    ...(row as PreAuditLeadSnapshot),
    platforms_label: Array.isArray(row.requested_platforms)
      ? row.requested_platforms.map((key) => PLATFORM_LABELS[key as PlatformKey] || String(key)).join(", ")
      : "",
    pre_analysis: withPre[0]?.pre_analysis ?? null
  };
}

export function buildLeadPreAuditPrompt(leadId: string, lead: PreAuditLeadSnapshot): string {
  return buildPreAuditLeadPrompt(leadId, lead);
}
