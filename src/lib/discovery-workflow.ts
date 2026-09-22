// Müşteri Keşfi qualification workflow — pure, dependency-free (no @/
// alias, no server-only import) so it is unit-testable directly with
// `node --test`. Statuses live on the EXISTING public.leads.status column
// (free text, no CHECK constraint — see supabase/migrations/
// 20260921_pre_audit_lead_support.sql's comment on the pre-review queue,
// which uses the same column the same way). No new table, no migration.
//
// Pipeline: Discovery -> (Kaydet) -> SAVED_FOR_REVIEW -> (Onayla) ->
// POTENTIAL -> (Ön İncele, existing pre-audit/reports.ts queue,
// unchanged) -> Lead pipeline / (Reddet) -> REJECTED. A row only becomes
// a real sales-pipeline lead once it leaves POTENTIAL via the existing
// pre-review "Teklif Gönder" action (sendPreReviewToLeadPipeline) — that
// part of the workflow already existed before this file and is reused
// as-is, not reimplemented here.
export const DISCOVERY_WORKFLOW_STATUS = {
  SAVED_FOR_REVIEW: "Değerlendirmede",
  POTENTIAL: "Potansiyel Müşteri",
  REJECTED: "Reddedildi"
} as const;

export type DiscoveryWorkflowStatus = (typeof DISCOVERY_WORKFLOW_STATUS)[keyof typeof DISCOVERY_WORKFLOW_STATUS];

export const DISCOVERY_WORKFLOW_STATUSES: DiscoveryWorkflowStatus[] = Object.values(DISCOVERY_WORKFLOW_STATUS);

export const DISCOVERY_REJECTION_REASONS = [
  "Dijital ihtiyacı düşük",
  "Uygun sektör değil",
  "İletişim bilgisi yetersiz",
  "Zaten güçlü dijital yapı",
  "Mükerrer kayıt",
  "Diğer"
] as const;

// Which CURRENT status a transition into a given target status is valid
// from. A target not listed here is not a workflow-gated status at all
// (e.g. a normal sales-pipeline stage) and is left unrestricted — this
// module only guards the two new evaluation-gate transitions.
const ALLOWED_FROM: Record<string, string[]> = {
  [DISCOVERY_WORKFLOW_STATUS.POTENTIAL]: [DISCOVERY_WORKFLOW_STATUS.SAVED_FOR_REVIEW],
  [DISCOVERY_WORKFLOW_STATUS.REJECTED]: [DISCOVERY_WORKFLOW_STATUS.SAVED_FOR_REVIEW, DISCOVERY_WORKFLOW_STATUS.POTENTIAL]
};

/** True when moving a lead's status from `currentStatus` to `nextStatus`
 * is a legal transition. A status this module doesn't gate (e.g. a plain
 * sales-pipeline stage) is always allowed — this exists to stop illegal
 * jumps like REJECTED -> POTENTIAL, not to police the entire lead
 * lifecycle. Re-applying the same status (idempotent retry) is always
 * allowed. */
export function isValidDiscoveryWorkflowTransition(nextStatus: string, currentStatus: string | null | undefined): boolean {
  const allowedFrom = ALLOWED_FROM[nextStatus];
  if (!allowedFrom) return true;
  if (currentStatus === nextStatus) return true;
  return allowedFrom.includes(currentStatus || "");
}
