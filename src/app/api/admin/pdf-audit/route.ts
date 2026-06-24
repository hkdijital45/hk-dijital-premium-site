import { NextResponse } from "next/server";
import { getSiteContent } from "@/lib/content";
import { auditPdfFilename, generateMiniAuditPdf } from "@/lib/pdf-audit";
import { requireModuleAccess } from "@/lib/permissions";

export async function POST(request: Request) {
  const allowed = await requireModuleAccess("sosyal-medya-denetimi")
    || await requireModuleAccess("crm")
    || await requireModuleAccess("leads")
    || await requireModuleAccess("meta-analiz")
    || await requireModuleAccess("google-analiz")
    || await requireModuleAccess("raporlar");
  if (!allowed) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const content = await getSiteContent();
    const payload = {
      ...body,
      logoUrl: body.logoUrl || content.brand?.logoUrl || content.brand?.footerLogoUrl || "",
      date: body.date || new Date().toISOString().slice(0, 10)
    };
    const buffer = await generateMiniAuditPdf(payload);
    const header = buffer.subarray(0, 5).toString("utf8");
    if (buffer.length <= 1024 || !header.startsWith("%PDF-")) {
      throw new Error("PDF oluşturulamadı. Geçersiz PDF verisi alındı.");
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `attachment; filename="${auditPdfFilename(payload)}"`
      }
    });
  } catch (error) {
    console.error("[pdf-audit] PDF üretim hatası", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "PDF oluşturulamadı. Geçersiz PDF verisi alındı." }, { status: 500 });
  }
}
