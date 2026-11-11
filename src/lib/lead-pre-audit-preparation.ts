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

// "Who asked for this pre-audit" — deliberately separate from
// leads.source (the lead's own acquisition channel): a lead that came in
// via "Website" can still have HK Dijital itself initiate the pre-audit,
// and conflating the two would silently misrepresent who asked for it.
export const LEAD_PRE_AUDIT_REQUESTED_BY = ["", "customer", "hk_dijital", "business_owner", "referral", "other"] as const;
export type LeadPreAuditRequestedBy = (typeof LEAD_PRE_AUDIT_REQUESTED_BY)[number];
export const LEAD_PRE_AUDIT_REQUESTED_BY_LABELS: Record<Exclude<LeadPreAuditRequestedBy, "">, string> = {
  customer: "Müşteri kendisi talep etti",
  hk_dijital: "HK Dijital tarafından önerildi / başlatıldı",
  business_owner: "İşletme yetkilisi talep etti",
  referral: "Referans / üçüncü kişi talep etti",
  other: "Diğer"
};

export type LeadPreAuditPreparation = {
  id: string; lead_id: string;
  social_observations: string; business_notes: string;
  advertising_status: LeadAdvertisingStatus;
  potential_reason: string; focus_notes: string; competitor_reference: string;
  // Optional at the TYPE level (not just runtime) because a production
  // database that hasn't run the 20261112 migration yet simply omits these
  // keys from a `select=*` response — never a crash, never a fabricated
  // default pretending the column exists.
  requested_by?: LeadPreAuditRequestedBy;
  requested_by_detail?: string;
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
  requested_by: LeadPreAuditRequestedBy; requested_by_detail: string;
}>;

const EDITABLE_FIELDS = ["social_observations", "business_notes", "advertising_status", "potential_reason", "focus_notes", "competitor_reference", "status"] as const;
// Saved in a SEPARATE patch call below (not merged into EDITABLE_FIELDS)
// so a production database that hasn't run the 20261112 migration yet
// still saves every OTHER field normally instead of failing the whole
// save on an unknown-column error.
const REQUESTED_BY_FIELDS = ["requested_by", "requested_by_detail"] as const;

export async function savePreparation(leadId: string, patch: LeadPreAuditPrepPatch): Promise<LeadPreAuditPreparation> {
  await assertLeadExists(leadId);
  if (patch.advertising_status && !(LEAD_ADVERTISING_STATUSES as readonly string[]).includes(patch.advertising_status)) {
    throw new LeadPreAuditPrepValidationError(`Geçersiz reklam durumu: ${patch.advertising_status}.`);
  }
  if (patch.status && !(LEAD_PRE_AUDIT_PREP_STATUSES as readonly string[]).includes(patch.status)) {
    throw new LeadPreAuditPrepValidationError(`Geçersiz hazırlık durumu: ${patch.status}.`);
  }
  if (patch.requested_by !== undefined && !(LEAD_PRE_AUDIT_REQUESTED_BY as readonly string[]).includes(patch.requested_by)) {
    throw new LeadPreAuditPrepValidationError(`Geçersiz talep eden: ${patch.requested_by}.`);
  }
  const body: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) if (field in patch) body[field] = (patch as Record<string, unknown>)[field];
  const requestedByBody: Record<string, unknown> = {};
  for (const field of REQUESTED_BY_FIELDS) if (field in patch) requestedByBody[field] = (patch as Record<string, unknown>)[field];
  req(Object.keys(body).length > 0 || Object.keys(requestedByBody).length > 0, "Güncellenecek en az bir alan belirtilmelidir.");

  // Ensure the row exists first (1:1, created lazily on first open) so a
  // PATCH never silently no-ops against a missing row.
  await getOrCreatePreparation(leadId);
  let rows: LeadPreAuditPreparation[] = [];
  if (Object.keys(body).length > 0) {
    rows = await supabaseRest<LeadPreAuditPreparation[]>(
      `${LEAD_PRE_AUDIT_PREP_TABLE}?lead_id=eq.${encodeURIComponent(leadId)}&select=*`,
      { method: "PATCH", body: JSON.stringify(body) }
    );
  }
  if (Object.keys(requestedByBody).length > 0) {
    try {
      rows = await supabaseRest<LeadPreAuditPreparation[]>(
        `${LEAD_PRE_AUDIT_PREP_TABLE}?lead_id=eq.${encodeURIComponent(leadId)}&select=*`,
        { method: "PATCH", body: JSON.stringify(requestedByBody) }
      );
    } catch {
      throw new LeadPreAuditPrepValidationError(
        rows.length
          ? "Ön incelemeyi talep eden alanı henüz veritabanında mevcut değil (migration uygulanmadı); diğer alanlar kaydedildi."
          : "Ön incelemeyi talep eden alanı henüz veritabanında mevcut değil (migration uygulanmadı)."
      );
    }
  }
  if (!rows.length) throw new LeadNotFoundError(`Hazırlık kaydı güncellenemedi: ${leadId}`);
  return rows[0];
}

function req(cond: unknown, message: string) {
  if (!cond) throw new LeadPreAuditPrepValidationError(message);
}

// source/google_maps_url added: both were already shown to staff in this
// same panel's own info cards but never reached the actual Claude prompt —
// the same bug class as the preparation notes themselves. phone/email/name
// remain deliberately excluded (see pre-audit-lead-prompt.ts's own comment
// and its test coverage) — the prompt leaves the app boundary, and that
// privacy rule predates and is independent of this fix.
const LEAD_SNAPSHOT_COLUMNS = "company,business_type,address,instagram,website,goal,budget,requested_platforms,message,source,google_maps_url";

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

export function buildLeadPreAuditPrompt(leadId: string, lead: PreAuditLeadSnapshot, prep?: LeadPreAuditPreparation | null): string {
  return buildPreAuditLeadPrompt(leadId, lead, prep);
}
