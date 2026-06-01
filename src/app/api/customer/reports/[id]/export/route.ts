import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { generateReportExport, type ExportFormat } from "@/lib/reports/report-exports";
import { getReportBundle } from "@/lib/reports/report-server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (session?.role !== "customer") return NextResponse.json({ error: "Bu sayfaya erişim yetkiniz yok." }, { status: 403 });
  const { id } = await context.params;
  const format = new URL(request.url).searchParams.get("format") as ExportFormat;
  if (!["excel", "word", "pdf"].includes(format)) return NextResponse.json({ error: "Geçerli bir dosya biçimi seçin." }, { status: 400 });
  const bundle = await getReportBundle(id);
  if (bundle.report.company_id !== session.companyId || !bundle.report.visible_to_customer) return NextResponse.json({ error: "Bu raporu indirme yetkiniz yok." }, { status: 403 });
  const file = await generateReportExport(format, bundle.report, bundle.company, bundle.interpretation, bundle.updates);
  await recordActivity({ session, action: "Dışa Aktarma", entity: "Rapor", entityId: id, companyId: bundle.report.company_id, details: { message: "Müşteri raporu indirdi", format } });
  return new NextResponse(file.buffer, { headers: { "Content-Type": file.contentType, "Content-Disposition": `attachment; filename="hk-dijital-rapor.${file.extension}"` } });
}
