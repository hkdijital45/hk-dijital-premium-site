import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { supabaseRest } from "@/lib/supabase";
import { getCreativeReportById, AdCreativeReportNotFoundError } from "@/lib/marketing-intelligence/ad-creative-reports";
import { buildCreativeReportDocumentPayload, type CreativeReportDocumentMode } from "@/lib/marketing-intelligence/ad-creative-report-document";
import { generatePdfBuffer, generateDocxBuffer, safeFileNameSegment, DOCUMENT_MIME_TYPES } from "@/lib/server/document-generator";

// Always exports the exact currently-saved row (re-read by id+companyId
// right here) — never a cached/stale response. Reuses the canonical
// document-generator.ts engine — no parallel PDF/DOCX implementation.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz rapor kimliği." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const mode: CreativeReportDocumentMode = body.mode === "internal" ? "internal" : "client";
  const format: "pdf" | "docx" = body.format === "docx" ? "docx" : "pdf";

  try {
    const [report, companies] = await Promise.all([
      getCreativeReportById(companyId, id),
      supabaseRest<Array<{ name: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=name&limit=1`)
    ]);
    const companyName = companies[0]?.name || "Müşteri";

    const payload = buildCreativeReportDocumentPayload(companyName, report, mode);
    const buffer = format === "docx" ? await generateDocxBuffer(payload) : await generatePdfBuffer(payload);

    const slug = safeFileNameSegment(companyName).toLocaleLowerCase("en");
    const suffix = mode === "internal" ? "dahili-rapor" : "musteri-raporu";
    const filename = `${slug}-reklam-kreatif-${suffix}-v${report.version}.${format}`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: { "Content-Type": DOCUMENT_MIME_TYPES[format], "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" }
    });
  } catch (error) {
    if (error instanceof AdCreativeReportNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Belge oluşturulamadı." }, { status: 500 });
  }
}
