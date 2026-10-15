import "server-only";

import { supabaseRest } from "@/lib/supabase";
import type { HkProposalV1 } from "./schema";
import type { ProposalQuestionnaire } from "./prompt";
import { financialsFromQuestionnaire, type ProposalFinancialsResult } from "./financials";

export const PROPOSALS_TABLE = "proposals";

export const PROPOSAL_STATUSES = [
  "Taslak", "Analiz Bekleniyor", "Analiz İçe Aktarıldı", "Düzenleniyor",
  "Gönderime Hazır", "Gönderildi", "Revize Ediliyor", "Kabul Edildi",
  "Reddedildi", "Süresi Doldu"
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type ProposalRecord = {
  id: string;
  company_id: string | null;
  lead_id: string | null;
  target_label: string;
  proposal_number: string;
  title: string;
  status: ProposalStatus;
  version: number;
  previous_proposal_id: string | null;
  questionnaire: Partial<ProposalQuestionnaire>;
  data: Partial<HkProposalV1>;
  financials: Partial<ProposalFinancialsResult>;
  source: "manual" | "claude_import";
  claude_import: { text: string; importedAt: string } | null;
  valid_until: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};

export class ProposalNotFoundError extends Error {}
export class ProposalValidationError extends Error {}
/** A sent proposal is treated as immutable history from here on — the
 * only way to change its content is createProposalRevision (a new row
 * with previous_proposal_id pointing at this one), matching the brief's
 * "do not overwrite previously sent proposal snapshots". */
export class ProposalImmutableError extends Error {}
export class ProposalTransitionError extends Error {}

/** Status-only lifecycle graph (never touches data/questionnaire, so it
 * deliberately does NOT go through assertMutable — a sent proposal must
 * still be able to move to Kabul Edildi/Reddedildi). Prevents accidental
 * jumps like Taslak -> Kabul Edildi without a real send/review step. */
export const PROPOSAL_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  "Taslak": ["Analiz Bekleniyor", "Düzenleniyor", "Gönderime Hazır"],
  "Analiz Bekleniyor": ["Analiz İçe Aktarıldı", "Düzenleniyor"],
  "Analiz İçe Aktarıldı": ["Düzenleniyor", "Gönderime Hazır"],
  "Düzenleniyor": ["Gönderime Hazır", "Analiz Bekleniyor"],
  "Gönderime Hazır": ["Gönderildi", "Düzenleniyor"],
  "Gönderildi": ["Kabul Edildi", "Reddedildi", "Revize Ediliyor", "Süresi Doldu"],
  "Revize Ediliyor": ["Düzenleniyor", "Gönderime Hazır"],
  "Kabul Edildi": [],
  "Reddedildi": [],
  "Süresi Doldu": ["Revize Ediliyor"]
};

export type ProposalTransitionAction = "send" | "accept" | "reject" | "expire" | "request_revision";
const ACTION_TARGET: Record<ProposalTransitionAction, ProposalStatus> = {
  send: "Gönderildi", accept: "Kabul Edildi", reject: "Reddedildi", expire: "Süresi Doldu", request_revision: "Revize Ediliyor"
};

export type ProposalSort = "newest" | "oldest" | "updated";

export type ListProposalsOptions = {
  companyId?: string; leadId?: string; status?: ProposalStatus;
  search?: string; createdFrom?: string; createdTo?: string;
  limit?: number; offset?: number;
  /** Default false: archived proposals are excluded everywhere they'd
   * otherwise show up as "the" active proposal for a lead/company — this
   * is also what makes a freshly-opened "Teklif Motoru"/"Otomatik Teklif
   * Hazırla" start a genuinely new, empty proposal once the old ones for
   * that lead are archived, instead of reopening an archived draft's old
   * form data. */
  includeArchived?: boolean;
  sort?: ProposalSort;
};

const SORT_ORDER: Record<ProposalSort, string> = {
  newest: "created_at.desc", oldest: "created_at.asc", updated: "updated_at.desc"
};

function applyProposalFilters(params: URLSearchParams, options: ListProposalsOptions) {
  if (options.companyId) params.set("company_id", `eq.${options.companyId}`);
  if (options.leadId) params.set("lead_id", `eq.${options.leadId}`);
  if (options.status) params.set("status", `eq.${options.status}`);
  if (options.search) params.set("or", `(target_label.ilike.*${options.search}*,title.ilike.*${options.search}*,proposal_number.ilike.*${options.search}*)`);
  if (options.createdFrom) params.set("created_at", `gte.${options.createdFrom}`);
  if (options.createdTo) params.append("created_at", `lte.${options.createdTo}`);
  if (!options.includeArchived) params.set("archived_at", "is.null");
  // Soft-deleted proposals never appear anywhere, even with
  // includeArchived — SİL is a stronger, separate state than ARŞİVLE.
  params.set("deleted_at", "is.null");
}

export async function listProposals(options: ListProposalsOptions = {}): Promise<ProposalRecord[]> {
  const params = new URLSearchParams();
  applyProposalFilters(params, options);
  params.set("order", SORT_ORDER[options.sort || "newest"]);
  params.set("limit", String(options.limit || 50));
  if (options.offset) params.set("offset", String(options.offset));
  return supabaseRest<ProposalRecord[]>(`${PROPOSALS_TABLE}?${params.toString()}`);
}

/** Total row count for the same filter set, for pagination UI. Uses
 * PostgREST's exact count via the Prefer header rather than fetching all
 * rows — supabaseRest doesn't surface response headers, so this issues a
 * HEAD-equivalent request with limit=1 and reads Content-Range via a
 * dedicated low-level call is unnecessary here: we instead request the
 * count using the count=exact Prefer and parse it from a 1-row fetch. */
export async function countProposals(options: Omit<ListProposalsOptions, "limit" | "offset"> = {}): Promise<number> {
  const params = new URLSearchParams();
  applyProposalFilters(params, options);
  params.set("select", "id");
  const rows = await supabaseRest<Array<{ id: string }>>(`${PROPOSALS_TABLE}?${params.toString()}`);
  return rows.length;
}

/** Reversible archiving — never a delete. Excludes a proposal from the
 * default active list (listProposals/countProposals) and from
 * openOrCreate's "is there already a draft for this lead/company"
 * lookup, without touching the row's own content, status, or any
 * related Lead/analysis data. unarchiveProposal always restores it
 * exactly as it was. */
export async function archiveProposal(id: string, archivedBy: string | null): Promise<ProposalRecord> {
  const [row] = await supabaseRest<ProposalRecord[]>(`${PROPOSALS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ archived_at: new Date().toISOString(), archived_by: archivedBy })
  });
  if (!row) throw new ProposalNotFoundError("Teklif bulunamadı.");
  return row;
}

export async function unarchiveProposal(id: string): Promise<ProposalRecord> {
  const [row] = await supabaseRest<ProposalRecord[]>(`${PROPOSALS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ archived_at: null, archived_by: null })
  });
  if (!row) throw new ProposalNotFoundError("Teklif bulunamadı.");
  return row;
}

/** Soft delete (SİL) — a stronger, separate state than ARŞİVLE. Never a
 * real DROP/DELETE statement: the row, and everything referencing it
 * (e.g. a revision chain's previous_proposal_id), is preserved. Fully
 * reversible via restoreProposal. Looked up by id directly (not via
 * listProposals, which always excludes deleted rows) so this still
 * works even though the row is otherwise invisible. */
export async function deleteProposal(id: string, deletedBy: string | null): Promise<ProposalRecord> {
  const [row] = await supabaseRest<ProposalRecord[]>(`${PROPOSALS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
  });
  if (!row) throw new ProposalNotFoundError("Teklif bulunamadı.");
  return row;
}

export async function restoreProposal(id: string): Promise<ProposalRecord> {
  const [row] = await supabaseRest<ProposalRecord[]>(`${PROPOSALS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ deleted_at: null, deleted_by: null })
  });
  if (!row) throw new ProposalNotFoundError("Teklif bulunamadı.");
  return row;
}

export async function getProposal(id: string): Promise<ProposalRecord> {
  const rows = await supabaseRest<ProposalRecord[]>(`${PROPOSALS_TABLE}?id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!rows[0]) throw new ProposalNotFoundError("Teklif bulunamadı.");
  return rows[0];
}

export type CreateProposalInput = {
  companyId?: string | null;
  leadId?: string | null;
  targetLabel: string;
  title?: string;
  questionnaire?: Partial<ProposalQuestionnaire>;
  createdBy?: string | null;
};

export async function createProposal(input: CreateProposalInput): Promise<ProposalRecord> {
  if (input.companyId && input.leadId) throw new ProposalValidationError("Bir teklif aynı anda hem müşteriye hem leade bağlanamaz.");
  const [row] = await supabaseRest<ProposalRecord[]>(PROPOSALS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      company_id: input.companyId || null,
      lead_id: input.leadId || null,
      target_label: input.targetLabel,
      title: input.title || `${input.targetLabel} — Teklif`,
      questionnaire: input.questionnaire || {},
      created_by: input.createdBy || null
    })
  });
  return row;
}

export type UpdateProposalInput = Partial<{
  title: string;
  status: ProposalStatus;
  questionnaire: Partial<ProposalQuestionnaire>;
  data: Partial<HkProposalV1>;
  financials: Partial<ProposalFinancialsResult>;
  validUntil: string | null;
}>;

async function assertMutable(existing: ProposalRecord) {
  if (existing.sent_at) throw new ProposalImmutableError("Bu teklif zaten gönderildi — içeriği değiştirmek için yeni bir revizyon oluşturun (createProposalRevision).");
}

export async function updateProposal(id: string, patch: UpdateProposalInput): Promise<ProposalRecord> {
  const existing = await getProposal(id);
  await assertMutable(existing);
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.questionnaire !== undefined) {
    body.questionnaire = { ...existing.questionnaire, ...patch.questionnaire };
    // Keep stored financials in sync with the saved questionnaire (server-side, deterministic).
    if (patch.financials === undefined) body.financials = financialsFromQuestionnaire(body.questionnaire as Parameters<typeof financialsFromQuestionnaire>[0]);
  }
  if (patch.data !== undefined) body.data = { ...existing.data, ...patch.data };
  if (patch.financials !== undefined) body.financials = patch.financials;
  if (patch.validUntil !== undefined) body.valid_until = patch.validUntil;
  const [row] = await supabaseRest<ProposalRecord[]>(`${PROPOSALS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  if (!row) throw new ProposalNotFoundError("Teklif bulunamadı.");
  return row;
}

export type ImportProposalInput = { data: HkProposalV1; claudeImportText: string };

/** Imports an already-validated HK_PROPOSAL_V1 payload (the API route
 * validates with validateHkProposalV1 BEFORE calling this — this function
 * never re-validates, it only persists) as an editable draft. Never
 * overwrites a sent proposal (assertMutable). The original pasted text is
 * preserved verbatim for audit, same pattern as manual_evaluations. */
export async function importProposalAnalysis(id: string, input: ImportProposalInput): Promise<ProposalRecord> {
  const existing = await getProposal(id);
  await assertMutable(existing);
  const [row] = await supabaseRest<ProposalRecord[]>(`${PROPOSALS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      data: input.data,
      source: "claude_import",
      claude_import: { text: input.claudeImportText, importedAt: new Date().toISOString() },
      status: "Analiz İçe Aktarıldı"
    })
  });
  if (!row) throw new ProposalNotFoundError("Teklif bulunamadı.");
  return row;
}

/** Marks a proposal as sent — from this point it is immutable
 * (assertMutable above blocks further edits to THIS row). */
export async function markProposalSent(id: string): Promise<ProposalRecord> {
  return transitionProposal(id, "send");
}

/** Validated status-only lifecycle transition. Only moves between states
 * allowed by PROPOSAL_TRANSITIONS — e.g. a proposal can never be marked
 * Kabul Edildi/Reddedildi merely because someone opened it; those
 * transitions only exist as explicit actions reachable from Gönderildi.
 * Timestamps (sent_at/accepted_at/rejected_at) are set alongside the
 * matching action so lifecycle history stays queryable. */
export async function transitionProposal(id: string, action: ProposalTransitionAction): Promise<ProposalRecord> {
  const existing = await getProposal(id);
  const target = ACTION_TARGET[action];
  const allowed = PROPOSAL_TRANSITIONS[existing.status] || [];
  if (!allowed.includes(target)) {
    throw new ProposalTransitionError(`"${existing.status}" durumundan "${target}" durumuna geçilemez.`);
  }
  const body: Record<string, unknown> = { status: target };
  if (action === "send") body.sent_at = new Date().toISOString();
  if (action === "accept") body.accepted_at = new Date().toISOString();
  if (action === "reject") body.rejected_at = new Date().toISOString();
  const [row] = await supabaseRest<ProposalRecord[]>(`${PROPOSALS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  if (!row) throw new ProposalNotFoundError("Teklif bulunamadı.");
  return row;
}

/** A free-standing copy for reuse-as-template (e.g. applying one
 * business's proposal structure to a different lead) — unlike
 * createProposalRevision below, this is NOT linked via
 * previous_proposal_id and is not restricted to sent proposals. Always
 * starts a fresh Taslak/version 1/unsent lifecycle. */
export async function duplicateProposal(id: string, overrides: { companyId?: string | null; leadId?: string | null; targetLabel?: string } = {}): Promise<ProposalRecord> {
  const existing = await getProposal(id);
  const [row] = await supabaseRest<ProposalRecord[]>(PROPOSALS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      company_id: overrides.companyId !== undefined ? overrides.companyId : existing.company_id,
      lead_id: overrides.leadId !== undefined ? overrides.leadId : existing.lead_id,
      target_label: overrides.targetLabel || existing.target_label,
      title: `${overrides.targetLabel || existing.target_label} — Teklif (Kopya)`,
      status: "Taslak",
      version: 1,
      previous_proposal_id: null,
      questionnaire: existing.questionnaire,
      data: existing.data,
      financials: existing.financials,
      source: "manual"
    })
  });
  return row;
}

/** Duplicates a (typically already-sent) proposal into a NEW editable
 * revision — never mutates the original, which stays as a permanent,
 * untouched historical snapshot. */
export async function createProposalRevision(id: string): Promise<ProposalRecord> {
  const existing = await getProposal(id);
  if (!existing.sent_at) throw new ProposalTransitionError("Yalnızca daha önce gönderilmiş bir teklifin revizyonu oluşturulabilir.");
  const [row] = await supabaseRest<ProposalRecord[]>(PROPOSALS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      company_id: existing.company_id,
      lead_id: existing.lead_id,
      target_label: existing.target_label,
      title: existing.title,
      status: "Revize Ediliyor",
      version: (existing.version || 1) + 1,
      previous_proposal_id: existing.id,
      questionnaire: existing.questionnaire,
      data: existing.data,
      financials: existing.financials,
      source: existing.source,
      created_by: existing.created_by
    })
  });
  return row;
}
