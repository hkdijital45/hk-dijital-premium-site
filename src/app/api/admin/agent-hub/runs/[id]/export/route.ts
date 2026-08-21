import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import type { ProfessionalReportPayload } from "@/lib/report-export";
import { generateDocxBuffer, generatePdfBuffer, generatePptxBuffer, toDocumentPayload, buildDocumentFileName, DOCUMENT_MIME_TYPES } from "@/lib/server/document-generator";
import { uploadGeneratedDocument } from "@/lib/customer-assets";
import { recordActivity } from "@/lib/activity-log";

const allowedFormats = new Set(["docx", "pdf", "pptx", "copy_text"]);
type FinalReportPayload = {
  executiveSummary?: string;
  findings?: string[];
  risks?: string[];
  opportunities?: string[];
  recommendedActions?: string[];
  sevenDayPlan?: string[];
  customerMessageDraft?: string;
  internalNotes?: string;
  providerChain?: string[];
};
type AgentRunRow = {
  task_type?: string | null;
  created_at?: string | null;
  customer_id?: string | null;
  output_summary?: string | null;
  provider_chain?: unknown;
  final_report?: FinalReportPayload | null;
  output_payload?: FinalReportPayload | null;
};

function buildPlainText(payload: Record<string, unknown>) {
  const list = (title: string, items: unknown) => [
    title,
    ...(Array.isArray(items) ? items.map((item) => `- ${String(item)}`) : [])
  ].join("\n");
  return [
    String(payload.title || "HK Agent Hub Raporu"),
    "",
    String(payload.executiveSummary || ""),
    "",
    list("Bulgular", payload.findings),
    "",
    list("Riskler", payload.risks),
    "",
    list("Fırsatlar", payload.opportunities),
    "",
    list("Önerilen Aksiyonlar", payload.recommendedActions),
    "",
    list("7 Günlük Plan", payload.sevenDayPlan),
    "",
    String(payload.customerMessageDraft || ""),
    "",
    String(payload.internalNotes || "")
  ].filter(Boolean).join("\n");
}

// RFC 5987/6266-compatible Content-Disposition — an ASCII-safe filename for
// clients that only read the plain `filename` param, plus a UTF-8 native
// `filename*` for the ones that read the extended one, so a Turkish title
// never turns into "MÃ¼ÅŸteri" in a browser's download list.
function contentDisposition(asciiFileName: string, nativeFileName: string) {
  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(nativeFileName)}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const format = allowedFormats.has(String(body.format)) ? String(body.format) : "copy_text";
  const rows = hasSupabaseConfig()
    ? await supabaseRest<AgentRunRow[]>(`agent_runs?id=eq.${encodeURIComponent(id)}&select=*`).catch(() => [])
    : [];
  const run = rows[0];
  if (!run) return NextResponse.json({ error: "Agent görevi bulunamadı." }, { status: 404 });
  const finalReport = run.final_report || run.output_payload || {};
  const basePayload = {
    format,
    title: `HK Agent Hub - ${run.task_type}`,
    createdAt: run.created_at,
    customerId: run.customer_id || null,
    executiveSummary: finalReport.executiveSummary || run.output_summary || "",
    findings: finalReport.findings || [],
    risks: finalReport.risks || [],
    opportunities: finalReport.opportunities || [],
    recommendedActions: finalReport.recommendedActions || [],
    sevenDayPlan: finalReport.sevenDayPlan || [],
    customerMessageDraft: finalReport.customerMessageDraft || "",
    internalNotes: finalReport.internalNotes || "",
    providerChain: finalReport.providerChain || run.provider_chain || []
  };

  if (format === "copy_text") {
    const payload = {
      status: "text_ready",
      message: "Kopyalanabilir metin hazırlandı.",
      contentType: "text/plain",
      text: buildPlainText(basePayload)
    };
    return NextResponse.json({ ok: true, payload });
  }

  // Real document generation from here — every branch below produces an
  // actual .docx/.pdf/.pptx binary, uploads it to the same Supabase Storage
  // bucket the customer "Dosyalar" tab already uses, and (when this run is
  // tied to a real customer) writes a real customer_documents row so it
  // shows up in that customer's Belgeler list — never just a JSON/HTML
  // payload with a format label attached to it.
  let companyName = "-";
  if (basePayload.customerId && hasSupabaseConfig()) {
    const companyRows = await supabaseRest<Array<{ name?: string }>>(`companies?id=eq.${encodeURIComponent(basePayload.customerId)}&select=name&limit=1`).catch(() => []);
    companyName = companyRows[0]?.name || "-";
  }

  const reportPayload: ProfessionalReportPayload = {
    title: String(basePayload.title),
    customerName: companyName,
    period: basePayload.createdAt ? new Date(String(basePayload.createdAt)).toLocaleDateString("tr-TR") : new Date().toLocaleDateString("tr-TR"),
    summary: String(basePayload.executiveSummary || ""),
    sections: [
      { title: "Bulgular", items: basePayload.findings },
      { title: "Riskler", items: basePayload.risks },
      { title: "Fırsatlar", items: basePayload.opportunities },
      { title: "Önerilen Aksiyonlar", items: basePayload.recommendedActions },
      { title: "7 Günlük Plan", items: basePayload.sevenDayPlan },
      ...(basePayload.customerMessageDraft ? [{ title: "Müşteriye Gönderilebilir Özet", text: String(basePayload.customerMessageDraft) }] : []),
      ...(basePayload.internalNotes ? [{ title: "İç Notlar", text: String(basePayload.internalNotes) }] : [])
    ].filter((section) => section.items?.length || section.text)
  };
  const documentPayload = toDocumentPayload(reportPayload);

  try {
    const buffer = format === "docx"
      ? await generateDocxBuffer(documentPayload)
      : format === "pdf"
        ? await generatePdfBuffer(documentPayload)
        : await generatePptxBuffer(documentPayload);
    const nativeFileName = buildDocumentFileName(companyName, String(basePayload.title), format as "docx" | "pdf" | "pptx").normalize("NFC");
    // Same base name, Turkish characters kept only in the RFC 5987 native
    // variant — the ASCII fallback filename is already transliteration-safe
    // from buildDocumentFileName.
    const asciiFileName = nativeFileName;
    const mimeType = DOCUMENT_MIME_TYPES[format as "docx" | "pdf" | "pptx"];

    let savedDocumentId: string | null = null;
    let saveError: string | null = null;
    if (basePayload.customerId) {
      try {
        const uploaded = await uploadGeneratedDocument(basePayload.customerId, buffer, nativeFileName, mimeType);
        const savedRows = await supabaseRest<Array<{ id: string }>>("customer_documents", {
          method: "POST",
          body: JSON.stringify({
            company_id: basePayload.customerId,
            title: String(basePayload.title),
            document_type: "Rapor",
            document_url: uploaded.url,
            storage_path: uploaded.path,
            mime_type: uploaded.mimeType,
            file_size: uploaded.size,
            document_date: new Date().toISOString().slice(0, 10),
            source_module: "Agent Hub",
            created_by: session.profileId || null,
            visible_to_customer: false
          })
        });
        savedDocumentId = savedRows[0]?.id || null;
        await recordActivity({
          session,
          action: "Oluşturma",
          entity: "Müşteri Belgesi",
          entityId: savedDocumentId,
          companyId: basePayload.customerId,
          details: { message: `${format.toUpperCase()} oluşturuldu ve belgelere kaydedildi: ${basePayload.title}`, source_module: "Agent Hub" }
        }).catch(() => null);
      } catch (error) {
        // The download must never depend on this succeeding — a real
        // generated file always reaches the user even if the customer-
        // document save step fails (e.g. before the storage-metadata
        // migration has been applied). Logged server-side, surfaced to the
        // client via a header rather than blocking the response.
        saveError = getSafeSupabaseError(error).detail;
        console.error("Agent Hub export: customer_documents kaydı oluşturulamadı:", saveError);
      }
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": contentDisposition(asciiFileName, nativeFileName),
        "X-Document-Saved": savedDocumentId ? "true" : "false",
        "X-Document-Id": savedDocumentId || "",
        "X-Customer-Id": String(basePayload.customerId || ""),
        "X-Customer-Name": encodeURIComponent(companyName)
      }
    });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error(`Agent Hub export (${format}) hatası:`, safeError.detail);
    return NextResponse.json({ error: `${format.toUpperCase()} oluşturulamadı.` }, { status: 500 });
  }
}
