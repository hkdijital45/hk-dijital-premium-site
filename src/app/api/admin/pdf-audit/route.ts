import { NextResponse } from "next/server";
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
    // logoUrl/profileImageUrl from the request are no longer fetched: the
    // HK Dijital logo is the bundled official asset and a client logo is
    // only ever a VERIFIED one resolved server-side from leadId.
    const payload = {
      ...body,
      leadId: typeof body.leadId === "string" ? body.leadId : undefined,
      date: body.date || new Date().toISOString().slice(0, 10)
    };
    const buffer = await generateMiniAuditPdf(payload);
    const header = buffer.subarray(0, 5).toString("utf8");
    if (buffer.length <= 1024 || !header.startsWith("%PDF-")) {
      throw new Error("PDF oluşturulamadı. Geçersiz PDF verisi alındı.");
    }

    return new NextResponse(new Uint8Array(buffer), {
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
