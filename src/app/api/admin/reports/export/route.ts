import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { buildCsvExport, buildPrintableHtmlReport, buildWordMarkdownReport } from "@/lib/report-export";

function responseForFile(body: string, filename: string, contentType: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    }
  });
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("raporlar");
  if (!session) return NextResponse.json({ error: "Bu işlem için raporlama yetkisi gerekir." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const format = String(body.format || "pdf");
  const payload = {
    title: String(body.title || "HK Dijital Profesyonel Rapor"),
    customerName: String(body.customerName || body.companyName || "-"),
    period: String(body.period || "-"),
    summary: String(body.executiveSummary || body.summary || "Yönetici özeti hazırlanmadı."),
    table: Array.isArray(body.table) ? body.table : [],
    sections: [
      { title: "Bulgular", items: Array.isArray(body.findings) ? body.findings : [] },
      { title: "Riskler", items: Array.isArray(body.risks) ? body.risks : [] },
      { title: "Fırsatlar", items: Array.isArray(body.opportunities) ? body.opportunities : [] },
      { title: "Öncelikli aksiyonlar", items: Array.isArray(body.recommendedActions) ? body.recommendedActions : [] },
      { title: "7 Günlük Plan", items: Array.isArray(body.sevenDayPlan) ? body.sevenDayPlan : [] }
    ]
  };
  const date = new Date().toISOString().slice(0, 10);
  if (format === "csv" || format === "excel") return responseForFile(buildCsvExport(payload.table || []), `hk-dijital-rapor-${date}.csv`, "text/csv; charset=utf-8");
  if (format === "word") return responseForFile(buildWordMarkdownReport(payload), `hk-dijital-rapor-${date}.md`, "text/markdown; charset=utf-8");
  return responseForFile(buildPrintableHtmlReport(payload), `hk-dijital-rapor-${date}.html`, "text/html; charset=utf-8");
}
