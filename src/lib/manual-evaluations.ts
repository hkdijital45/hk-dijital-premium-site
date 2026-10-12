import "server-only";

import { supabaseRest } from "@/lib/supabase";
import {
  calculateDerivedMetrics,
  validateManualEvaluationInput,
  ManualEvaluationValidationError,
  MANUAL_EVALUATIONS_TABLE,
  type ManualEvaluationModule,
  type ManualEvaluationRecord
} from "@/lib/manual-evaluations-shared";

// Server-only CRUD for the shared "Manuel Değerlendirme" engine. Field
// configs, calculation formulas and types live in
// manual-evaluations-shared.ts (imported by client components too) —
// this file only ever talks to Supabase, so it must never be imported
// from a "use client" module.
export {
  MANUAL_EVALUATION_MODULES,
  MODULE_LABELS,
  MODULE_FIELD_GROUPS,
  ManualEvaluationValidationError,
  validateManualEvaluationInput,
  calculateDerivedMetrics,
  calculateAdDoctorMetrics,
  calculateAdEvaluationMetrics,
  calculateInstagramMetrics,
  MANUAL_EVALUATIONS_TABLE,
  type ManualEvaluationModule,
  type ManualEvaluationRecord,
  type FieldConfig,
  type FieldGroup,
  type DerivedMetric
} from "@/lib/manual-evaluations-shared";

export class ManualEvaluationNotFoundError extends Error {}

export async function listManualEvaluations(module: ManualEvaluationModule, options: { companyId?: string; leadId?: string; limit?: number } = {}): Promise<ManualEvaluationRecord[]> {
  const params = new URLSearchParams();
  params.set("module", `eq.${module}`);
  if (options.companyId) params.set("company_id", `eq.${options.companyId}`);
  if (options.leadId) params.set("lead_id", `eq.${options.leadId}`);
  params.set("order", "created_at.desc");
  params.set("limit", String(options.limit || 20));
  return supabaseRest<ManualEvaluationRecord[]>(`${MANUAL_EVALUATIONS_TABLE}?${params.toString()}`);
}

export async function getManualEvaluation(id: string): Promise<ManualEvaluationRecord> {
  const rows = await supabaseRest<ManualEvaluationRecord[]>(`${MANUAL_EVALUATIONS_TABLE}?id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!rows[0]) throw new ManualEvaluationNotFoundError("Değerlendirme bulunamadı.");
  return rows[0];
}

export type CreateManualEvaluationInput = {
  module: ManualEvaluationModule;
  companyId?: string | null;
  leadId?: string | null;
  targetLabel?: string;
  title?: string;
  status?: "draft" | "submitted";
  data: Record<string, unknown>;
  notes?: string;
  source?: "manual" | "claude_import";
  claudeImportText?: string;
  createdBy?: string | null;
};

export async function createManualEvaluation(input: CreateManualEvaluationInput): Promise<ManualEvaluationRecord> {
  if (input.companyId && input.leadId) throw new ManualEvaluationValidationError("Bir değerlendirme aynı anda hem müşteriye hem adaya bağlanamaz.");
  const validationError = validateManualEvaluationInput(input.module, input.data);
  if (validationError) throw new ManualEvaluationValidationError(validationError);

  const derivedMetrics = calculateDerivedMetrics(input.module, input.data);
  const [row] = await supabaseRest<ManualEvaluationRecord[]>(MANUAL_EVALUATIONS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      module: input.module,
      company_id: input.companyId || null,
      lead_id: input.leadId || null,
      target_label: input.targetLabel || "",
      title: input.title || "",
      status: input.status || "draft",
      data: input.data,
      derived_metrics: derivedMetrics,
      source: input.source || "manual",
      claude_import: input.claudeImportText ? { text: input.claudeImportText, importedAt: new Date().toISOString() } : null,
      notes: input.notes || "",
      created_by: input.createdBy || null
    })
  });
  return row;
}

export type UpdateManualEvaluationInput = Partial<Pick<CreateManualEvaluationInput, "title" | "status" | "data" | "notes" | "claudeImportText" | "source">>;

export async function updateManualEvaluation(id: string, patch: UpdateManualEvaluationInput): Promise<ManualEvaluationRecord> {
  const existing = await getManualEvaluation(id);
  const nextData = patch.data ? { ...existing.data, ...patch.data } : existing.data;
  if (patch.data) {
    const validationError = validateManualEvaluationInput(existing.module, nextData);
    if (validationError) throw new ManualEvaluationValidationError(validationError);
  }
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.notes !== undefined) body.notes = patch.notes;
  if (patch.data !== undefined) {
    body.data = nextData;
    body.derived_metrics = calculateDerivedMetrics(existing.module, nextData);
  }
  if (patch.claudeImportText !== undefined) {
    body.claude_import = { text: patch.claudeImportText, importedAt: new Date().toISOString() };
    body.source = "claude_import";
  }
  const [row] = await supabaseRest<ManualEvaluationRecord[]>(`${MANUAL_EVALUATIONS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  if (!row) throw new ManualEvaluationNotFoundError("Değerlendirme bulunamadı.");
  return row;
}
