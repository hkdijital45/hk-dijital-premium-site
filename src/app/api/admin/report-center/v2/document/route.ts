import { NextResponse } from "next/server";
import { reportCenterErrorResponse, requireReportTypeAccess, unauthorized } from "@/lib/report-center-v2/access";
import { loadReport, ReportCenterError } from "@/lib/report-center-v2/server";
import { ownerFromParams, variantFromParams, contentDisposition } from "@/lib/report-center-v2/params";
import { generateDocxBuffer, generatePdfBuffer, DOCUMENT_MIME_TYPES } from "@/lib/server/document-generator";
import { resolveReportClientLogo } from "@/lib/business-logos";

// "PDF Önizle" (disposition=inline) / "PDF İndir" / "Word İndir" for a
// single owner-verified report. Generated on request only, nothing is
// stored or modified. Stored-file reports (Analiz Merkezi) are streamed
// from this project's own storage.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const access = await requireReportTypeAccess(params.get("type"));
  if (!access) return unauthorized();
  const format = params.get("format") === "docx" ? "docx" : "pdf";
  const inline = params.get("disposition") === "inline" && format === "pdf";
  try {
    if (format === "docx" && !access.def.formats.docx) throw new ReportCenterError("Bu rapor türü Word olarak indirilemez.");
    const loaded = await loadReport(access.def.key, params.get("id") || "", ownerFromParams(params), params.get("business") || "all");
    const variant = variantFromParams(params, loaded.variants);
    const fileName = `${loaded.fileBase}-${variant === "internal" ? "dahili" : "musteri"}.${format}`;

    if (access.def.storedFile) {
      if (!loaded.storedUrl) throw new ReportCenterError("Bu rapor için kayıtlı PDF dosyası bulunamadı.", 404);
      const stored = await fetchOwnStorageFile(loaded.storedUrl);
      return new NextResponse(stored as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": contentDisposition(inline, fileName), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }

    const payload = await loaded.build(variant);
    if (!payload.executiveSummary && !payload.sections.length && !payload.headlineMetrics?.length) {
      throw new ReportCenterError("Bu raporda belgeye dönüştürülecek içerik bulunmuyor.", 422);
    }
    payload.clientLogo = await resolveReportClientLogo(loaded.logoScope);
    const buffer = format === "docx" ? await generateDocxBuffer(payload) : await generatePdfBuffer(payload);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: { "Content-Type": DOCUMENT_MIME_TYPES[format], "Content-Disposition": contentDisposition(inline, fileName), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    });
  } catch (error) {
    return reportCenterErrorResponse(error, format === "pdf" ? "PDF oluşturulamadı." : "Word belgesi oluşturulamadı.");
  }
}

/** Only files in this project's own Supabase storage are proxied (the URL
 * comes from the database, but is still never fetched from another host). */
async function fetchOwnStorageFile(url: string): Promise<Uint8Array> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new ReportCenterError("Kayıtlı dosya adresi geçersiz.", 404);
  }
  if (!base || target.protocol !== "https:" || target.host !== new URL(base).host || !target.pathname.startsWith("/storage/v1/object/")) {
    throw new ReportCenterError("Kayıtlı dosya bu sistemin depolama alanında değil.", 404);
  }
  const response = await fetch(target, { cache: "no-store", redirect: "error" });
  if (!response.ok) throw new ReportCenterError("Kayıtlı PDF dosyası okunamadı.", 404);
  return new Uint8Array(await response.arrayBuffer());
}
