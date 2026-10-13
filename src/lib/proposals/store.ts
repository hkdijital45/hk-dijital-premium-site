import "server-only";

import { supabaseRest } from "@/lib/supabase";
import type { HkProposalV1 } from "./schema";
import type { ProposalQuestionnaire } from "./prompt";
import type { ProposalFinancialsResult } from "./financials";

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
};

export class ProposalNotFoundError extends Error {}
export class ProposalValidationError extends Error {}
/** A sent proposal is treated as immutable history from here on — the
 * only way to change its content is createProposalRevision (a new row
 * with previous_proposal_id pointing at this one), matching the brief's
 * "do not overwrite previously sent proposal snapshots". */
export class ProposalImmutableError extends Error {}

export async function listProposals(options: { companyId?: string; leadId?: string; status?: ProposalStatus; limit?: number } = {}): Promise<ProposalRecord[]> {
  const params = new URLSearchParams();
  if (options.companyId) params.set("company_id", `eq.${options.companyId}`);
  if (options.leadId) params.set("lead_id", `eq.${options.leadId}`);
  if (options.status) params.set("status", `eq.${options.status}`);
  params.set("order", "created_at.desc");
  params.set("limit", String(options.limit || 50));
  return supabaseRest<ProposalRecord[]>(`${PROPOSALS_TABLE}?${params.toString()}`);
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
  if (patch.questionnaire !== undefined) body.questionnaire = { ...existing.questionnaire, ...patch.questionnaire };
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
  const [row] = await supabaseRest<ProposalRecord[]>(`${PROPOSALS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "Gönderildi", sent_at: new Date().toISOString() })
  });
  if (!row) throw new ProposalNotFoundError("Teklif bulunamadı.");
  return row;
}

/** Duplicates a (typically already-sent) proposal into a NEW editable
 * revision — never mutates the original, which stays as a permanent,
 * untouched historical snapshot. */
export async function createProposalRevision(id: string): Promise<ProposalRecord> {
  const existing = await getProposal(id);
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
