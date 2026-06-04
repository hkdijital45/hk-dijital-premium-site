import { NextResponse } from "next/server";
import { getSession, isCustomerRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { filterUpdatesForRange, filteredReportsForPeriod, getCustomerDateRange, platformFilterLabel, type CustomerPlatformFilter } from "@/lib/reports/customer-period";
import { generateReportExport, type ExportFormat } from "@/lib/reports/report-exports";
import { getReportBundle } from "@/lib/reports/report-server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!isCustomerRole(session?.role)) return NextResponse.json({ error: "Bu sayfaya erişim yetkiniz yok." }, { status: 403 });
  const { id } = await context.params;
  const searchParams = new URL(request.url).searchParams;
  const format = searchParams.get("format") as ExportFormat;
  if (!["excel", "word", "pdf"].includes(format)) return NextResponse.json({ error: "Geçerli bir dosya biçimi seçin." }, { status: 400 });
  const bundle = await getReportBundle(id);
  if (bundle.report.company_id !== session.companyId || !bundle.report.visible_to_customer) return NextResponse.json({ error: "Bu raporu indirme yetkiniz yok." }, { status: 403 });
  const platform = (searchParams.get("platform") || "all") as CustomerPlatformFilter;
  const range = getCustomerDateRange("custom", searchParams.get("start") || bundle.report.start_date || bundle.report.end_date, searchParams.get("end") || bundle.report.end_date || bundle.report.start_date);
  const filteredReport = filteredReportsForPeriod([bundle.report], range, platform)[0];
  if (!filteredReport) return NextResponse.json({ error: "Bu tarih aralığında rapor verisi bulunamadı." }, { status: 404 });
  filteredReport.period = `${range.label} · ${platformFilterLabel(platform)}`;
  const updates = filterUpdatesForRange(bundle.updates, range, [bundle.report.id]);
  const file = await generateReportExport(format, filteredReport, bundle.company, bundle.interpretation, updates);
  await recordActivity({ session, action: "Dışa Aktarma", entity: "Rapor", entityId: id, companyId: bundle.report.company_id, details: { message: "Müşteri seçili dönem raporu indirdi", format, period: range.label, platform: platformFilterLabel(platform) } });
  return new NextResponse(file.buffer, { headers: { "Content-Type": file.contentType, "Content-Disposition": `attachment; filename="hk-dijital-rapor.${file.extension}"` } });
}
