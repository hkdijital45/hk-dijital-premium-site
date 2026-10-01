import "server-only";

// Generates + persists all four Reklam Değerlendirme report files (internal
// PDF/DOCX, client PDF/DOCX) for one evaluation in a single call — the
// MCP save_ad_evaluation tool's "report generation must happen
// automatically" step. Reuses the exact same building blocks the
// Ad Insights export route already uses per-format
// (buildAdEvaluationDocumentPayload, generatePdfBuffer/generateDocxBuffer,
// ad-evaluation-storage.ts) rather than a second renderer — this file only
// adds the "do all four, skip what's already stored" orchestration.
import { supabaseRest } from "@/lib/supabase";
import { getAdEvaluationById, updateAdEvaluationStoragePaths, type AdEvaluationRecord } from "./ad-evaluations";
import { buildAdEvaluationDocumentPayload, type AdEvaluationDocumentMode } from "./ad-evaluation-document";
import { generatePdfBuffer, generateDocxBuffer, DOCUMENT_MIME_TYPES } from "@/lib/server/document-generator";
import { adEvaluationStoragePath, uploadAdEvaluationFile } from "./ad-evaluation-storage";

const PATH_FIELD: Record<string, keyof AdEvaluationRecord> = {
  "internal-pdf": "internal_pdf_path", "internal-docx": "internal_docx_path",
  "client-pdf": "client_pdf_path", "client-docx": "client_docx_path"
};

export type AdEvaluationReportStatus = { internalPdf: boolean; internalDocx: boolean; clientPdf: boolean; clientDocx: boolean };

/** Generates + uploads the internal/client PDF and DOCX for an evaluation
 * that doesn't already have a given file stored (section 5/29: never
 * create uncontrolled duplicates on repeat calls — an existing path is
 * reused as-is, not regenerated). Returns the evaluation row with its
 * final storage paths. */
export async function generateAllAdEvaluationReports(companyId: string, evaluationId: string): Promise<AdEvaluationRecord> {
  let evaluation = await getAdEvaluationById(companyId, evaluationId);

  const [companies, campaigns] = await Promise.all([
    supabaseRest<Array<{ name: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=name&limit=1`),
    evaluation.campaign_id
      ? supabaseRest<Array<{ name: string }>>(`campaigns?id=eq.${encodeURIComponent(evaluation.campaign_id)}&select=name&limit=1`).catch(() => [])
      : Promise.resolve([])
  ]);
  const companyName = companies[0]?.name || "Müşteri";
  const campaignName = campaigns[0]?.name || evaluation.meta_campaign_id || "Kampanya";

  const combos: Array<{ mode: AdEvaluationDocumentMode; format: "pdf" | "docx" }> = [
    { mode: "internal", format: "pdf" }, { mode: "internal", format: "docx" },
    { mode: "client", format: "pdf" }, { mode: "client", format: "docx" }
  ];

  for (const { mode, format } of combos) {
    const pathField = PATH_FIELD[`${mode}-${format}`];
    if (evaluation[pathField]) continue;
    const payload = buildAdEvaluationDocumentPayload(companyName, campaignName, evaluation, mode);
    const buffer = format === "docx" ? await generateDocxBuffer(payload) : await generatePdfBuffer(payload);
    const fileName = `${mode === "internal" ? "internal-report" : "client-report"}.${format}`;
    const storagePath = adEvaluationStoragePath(companyId, evaluation.campaign_id, evaluationId, fileName);
    await uploadAdEvaluationFile(storagePath, buffer, DOCUMENT_MIME_TYPES[format]);
    evaluation = await updateAdEvaluationStoragePaths(companyId, evaluationId, { [pathField]: storagePath } as Partial<AdEvaluationRecord>);
  }

  return evaluation;
}

export function reportFileStatus(evaluation: AdEvaluationRecord): AdEvaluationReportStatus {
  return {
    internalPdf: Boolean(evaluation.internal_pdf_path),
    internalDocx: Boolean(evaluation.internal_docx_path),
    clientPdf: Boolean(evaluation.client_pdf_path),
    clientDocx: Boolean(evaluation.client_docx_path)
  };
}
