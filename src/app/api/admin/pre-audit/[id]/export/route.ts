import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { getPreAuditReportById } from "@/lib/pre-audit/reports";
import { buildPreAuditDocumentPayload, buildPreAuditFileName } from "@/lib/pre-audit/document";
import { generateDocxBuffer, generatePdfBuffer, DOCUMENT_MIME_TYPES } from "@/lib/server/document-generator";

// Branded PDF/DOCX export for a single, already-saved Ön İnceleme report.
// EXPORT = RENDER, never research: no AI call, no MCP call, no new
// research happens here — the saved pre_audit_reports row (fetched fresh
// from the DB by id, never trusted from the client) is the only source of
// truth. report_type is read from THAT row, not from any client-supplied
// parameter, so a client cannot request a "client" export of an
// INTERNAL_REPORT row and get internal data relabeled as safe — the
// document this route produces always matches the real report_type of
// the report actually stored under `id`.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("on-inceleme");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  if (format !== "pdf" && format !== "docx") {
    return NextResponse.json({ error: "Geçersiz format. 'pdf' veya 'docx' olmalı." }, { status: 400 });
  }

  try {
    const report = await getPreAuditReportById(id);
    if (!report) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });

    const companyDisplayName = await resolveCompanyDisplayName(report.company_id, report.lead_id, report.title);
    const payload = buildPreAuditDocumentPayload(report, companyDisplayName);
    const filename = buildPreAuditFileName(report, companyDisplayName, format);

    const buffer = format === "pdf" ? await generatePdfBuffer(payload) : await generateDocxBuffer(payload);
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": DOCUMENT_MIME_TYPES[format],
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = format === "pdf" ? "PDF oluşturulamadı." : "Word belgesi oluşturulamadı.";
    return NextResponse.json({ error: `${message} ${getSafeSupabaseError(error).detail}` }, { status: 500 });
  }
}

async function resolveCompanyDisplayName(companyId: string | null, leadId: string | null, fallbackTitle: string): Promise<string> {
  try {
    if (companyId) {
      const rows = await supabaseRest<Array<{ name: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=name&limit=1`);
      if (rows[0]?.name) return rows[0].name;
    }
    if (leadId) {
      const rows = await supabaseRest<Array<{ company: string | null; name: string | null }>>(`leads?id=eq.${encodeURIComponent(leadId)}&select=company,name&limit=1`);
      const lead = rows[0];
      if (lead?.company || lead?.name) return lead.company || lead.name || fallbackTitle;
    }
  } catch {
    // Falls through to the report's own title — never blocks export on a lookup failure.
  }
  return fallbackTitle || "Firma";
}
