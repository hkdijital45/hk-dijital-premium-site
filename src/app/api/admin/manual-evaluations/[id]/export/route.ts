import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { supabaseRest } from "@/lib/supabase";
import { getManualEvaluation, ManualEvaluationNotFoundError } from "@/lib/manual-evaluations";
import { buildManualEvaluationDocumentPayload, type ManualEvaluationDocumentMode } from "@/lib/manual-evaluation-document";
import { generatePdfBuffer, generateDocxBuffer, safeFileNameSegment, DOCUMENT_MIME_TYPES } from "@/lib/server/document-generator";

// Direct-download export (no storage persistence — a manual evaluation's
// report is cheap to regenerate on demand, unlike the ad-evaluation flow's
// larger creative-asset-bundled documents).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz kimlik." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const mode: ManualEvaluationDocumentMode = body.mode === "internal" ? "internal" : "client";
  const format: "pdf" | "docx" = body.format === "docx" ? "docx" : "pdf";

  try {
    const evaluation = await getManualEvaluation(id);
    let targetName = evaluation.target_label || "Değerlendirme";
    if (evaluation.company_id) {
      const companies = await supabaseRest<Array<{ name: string }>>(`companies?id=eq.${encodeURIComponent(evaluation.company_id)}&select=name&limit=1`).catch(() => []);
      targetName = companies[0]?.name || targetName;
    } else if (evaluation.lead_id) {
      const leads = await supabaseRest<Array<{ name: string }>>(`leads?id=eq.${encodeURIComponent(evaluation.lead_id)}&select=name&limit=1`).catch(() => []);
      targetName = leads[0]?.name || targetName;
    }

    const payload = buildManualEvaluationDocumentPayload(targetName, evaluation, mode);
    const buffer = format === "docx" ? await generateDocxBuffer(payload) : await generatePdfBuffer(payload);

    const slug = safeFileNameSegment(targetName).toLocaleLowerCase("en");
    const suffix = mode === "internal" ? "dahili" : "musteri";
    const dateSegment = new Date().toISOString().slice(0, 10);
    const filename = `${slug}-${evaluation.module}-${suffix}-${dateSegment}.${format}`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: { "Content-Type": DOCUMENT_MIME_TYPES[format], "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" }
    });
  } catch (error) {
    if (error instanceof ManualEvaluationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Belge oluşturulamadı." }, { status: 500 });
  }
}
