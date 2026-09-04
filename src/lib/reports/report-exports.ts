/* eslint-disable @typescript-eslint/no-explicit-any */
import { reportHighlights } from "./report-metrics";
import { buildActionPlan, calculateHKIntelligenceScore, calculateHealthScore, formatCurrency, formatNumber, getLeadTracking, getWorkLogItems } from "./report-insights";
import { generateDocxBuffer, generatePdfBuffer, type DocumentPayload } from "@/lib/server/document-generator";

const SECTION_HEADINGS = ["Öne Çıkan Metrikler", "Lead / WhatsApp Takibi", "Yapay Zekâ Destekli Yorum", "Önümüzdeki 7 Gün Planı", "Ajans Notları ve Güncellemeler"];

/** Regroups the flat report-line array (also used for HTML export) into the
 * structured shape document-generator.ts needs for a real PDF/DOCX binary. */
function toDocumentPayload(content: string[], report: any, company: any): DocumentPayload {
  const summaryLines: string[] = [];
  const sections: DocumentPayload["sections"] = [];
  let current: { title: string; items: string[] } | null = null;
  for (let index = 2; index < content.length; index += 1) {
    const line = content[index];
    if (SECTION_HEADINGS.includes(line)) {
      if (current) sections.push(current);
      current = { title: line, items: [] };
      continue;
    }
    if (!line) continue;
    if (current) current.items.push(line);
    else summaryLines.push(line);
  }
  if (current) sections.push(current);
  return {
    title: content[1] || `${company?.name || "Müşteri"} Raporu`,
    customerName: company?.name || "-",
    period: report.period || `${report.start_date || "-"} - ${report.end_date || "-"}`,
    executiveSummary: summaryLines.join("\n"),
    sections,
    footerNote: "Sonuçlar sektör, bütçe, hedef kitle, teklif ve rekabet durumuna göre değişebilir."
  };
}

export type ExportFormat = "excel" | "word" | "pdf";

/** Discovery/SWOT/competitor-analysis reports (see generateDiscoveryReport
 * in api/admin/reports/route.ts) store `{ summary, sections: [{title, items}] }`
 * in `content`, not ad metrics — a structurally different shape from the
 * performance reports `lines()`/toDocumentPayload() below handle. */
export function isDiscoveryStyleReport(report: any) {
  return Array.isArray(report?.content?.sections) && report.content.sections.length > 0;
}

export function discoveryReportToDocumentPayload(report: any, company: any): DocumentPayload {
  return {
    title: report.title || report.business_name || `${report.report_type || "Rapor"}`,
    customerName: company?.name || report.business_name || "-",
    period: report.period || formatTurkishDate(report.created_at),
    executiveSummary: normalizeTurkishText(report.content?.summary || ""),
    sections: (report.content.sections as Array<{ title?: unknown; items?: unknown }>).map((section) => ({
      title: normalizeTurkishText(section.title || "Bölüm"),
      items: Array.isArray(section.items) ? section.items.map((item) => normalizeTurkishText(item)) : undefined
    })),
    footerNote: "Bu rapor gerçek keşif/analiz verilerine dayanır; eksik bilgiler ilgili bölümde ayrıca belirtilir."
  };
}

const exportMetricAliases: Record<string, string> = {
  spent: "spend",
  average_cpc: "cpc",
  cost_per_conversion: "cost_per_lead",
  conversions: "leads",
  link_clicks: "clicks"
};

function lines(report: any, company: any, interpretation?: any, updates: any[] = [], visibilityRules: any[] = []) {
  const canShowMetric = (key: string) => {
    const metricKey = exportMetricAliases[key] || key;
    const rule = visibilityRules.find((item) => item.section_key === "metrics" && item.metric_key === metricKey);
    return rule?.is_visible ?? true;
  };
  const health = calculateHealthScore(report);
  const intelligence = calculateHKIntelligenceScore(report, updates);
  const leadTracking = getLeadTracking(report);
  const plan = buildActionPlan(report, updates);
  const workLog = getWorkLogItems(updates);
  return [
    "HK Dijital",
    `${company?.name || "Müşteri"} Performans Raporu`,
    `Rapor türü: ${report.report_type}`,
    `Rapor dönemi: ${report.period || "-"}`,
    `Tarih aralığı: ${report.start_date || "-"} - ${report.end_date || "-"}`,
    `Platform: ${report.platform || "-"}`,
    "",
    `Reklam Sağlık Skoru: ${health.score}/100 - ${health.label}`,
    health.explanation,
    `HK Intelligence Skoru: ${intelligence.score}/100 - ${intelligence.label}`,
    "",
    "Öne Çıkan Metrikler",
    ...reportHighlights(report).filter((metric) => canShowMetric(metric.key)).map((metric) => `${metric.label}: ${metric.value} - ${metric.explanation}`),
    "",
    "Lead / WhatsApp Takibi",
    `Toplam lead: ${formatNumber(leadTracking.total)} | Arandı: ${formatNumber(leadTracking.called)} | Teklif verildi: ${formatNumber(leadTracking.proposed)} | Satış oldu: ${formatNumber(leadTracking.sold)} | Takip bekliyor: ${formatNumber(leadTracking.pending)}`,
    ...(canShowMetric("spent") ? [`Harcama: ${formatCurrency(Number(report.metrics?.spent || report.metrics?.cost || 0))}`] : []),
    "",
    `Ajans Notu: ${report.customer_note || "Ajans değerlendirmesi eklenecek."}`,
    "",
    "Yapay Zekâ Destekli Yorum",
    interpretation?.interpretation_text || "Bu rapor için henüz yorum oluşturulmadı.",
    "",
    "Önümüzdeki 7 Gün Planı",
    ...plan.map((item: string, index: number) => `${index + 1}. ${item}`),
    "",
    "Ajans Notları ve Güncellemeler",
    ...workLog.map((update) => `${update.date} - ${update.title} (${update.category} / ${update.status}): ${update.description}${updates.find((item) => item.id === update.id)?.next_action ? ` Sonraki adım: ${updates.find((item) => item.id === update.id)?.next_action}` : ""}`),
    "",
    "Not: Sonuçlar sektör, bütçe, hedef kitle, teklif ve rekabet durumuna göre değişebilir."
  ];
}

export function normalizeTurkishText(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "");
}

export function formatTurkishDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return normalizeTurkishText(value);
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatTurkishCurrency(value: unknown) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(value || 0));
}

export function formatTurkishPercent(value: unknown) {
  return new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 2 }).format(Number(value || 0) / 100);
}

// Defense-in-depth against formula injection: customer notes, AI
// interpretation text and discovery-report content all reach this sheet
// from user/AI-influenced fields. A leading =/+/-/@ prefixed with a
// literal apostrophe forces Excel/LibreOffice to render it as text even
// if a viewer's re-save/import path ever treats this as CSV-like input.
function escapeXml(value: unknown) {
  const text = normalizeTurkishText(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return safe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function discoverySheetXml(payload: DocumentPayload) {
  const row = (label: string, value = "") => `<Row><Cell><Data ss:Type="String">${escapeXml(label)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell></Row>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Language>tr-TR</Language></DocumentProperties>
  <Styles><Style ss:ID="header"><Font ss:Bold="1"/></Style></Styles>
  <Worksheet ss:Name="Rapor">
    <Table>
      <Row ss:StyleID="header"><Cell><Data ss:Type="String">Bölüm</Data></Cell><Cell><Data ss:Type="String">İçerik</Data></Cell></Row>
      ${row("Müşteri", payload.customerName)}
      ${row("Dönem", payload.period)}
      ${row("Özet", payload.executiveSummary)}
      ${payload.sections.map((section) => row(section.title, (section.items || []).join(" | ") || section.text || "")).join("")}
    </Table>
  </Worksheet>
</Workbook>`;
}

export async function generateReportExport(format: ExportFormat, report: any, company: any, interpretation?: any, updates: any[] = [], visibilityRules: any[] = []) {
  const payload = isDiscoveryStyleReport(report)
    ? discoveryReportToDocumentPayload(report, company)
    : toDocumentPayload(lines(report, company, interpretation, updates, visibilityRules).map(normalizeTurkishText), report, company);

  if (format === "excel") {
    if (isDiscoveryStyleReport(report)) {
      return { buffer: Buffer.from(`\uFEFF${discoverySheetXml(payload)}`, "utf8"), contentType: "application/vnd.ms-excel; charset=utf-8", extension: "xls" };
    }
    const row = (label: string, value = "") => `<Row><Cell><Data ss:Type="String">${escapeXml(label)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell></Row>`;
    const content = lines(report, company, interpretation, updates, visibilityRules).map(normalizeTurkishText);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Language>tr-TR</Language></DocumentProperties>
  <Styles><Style ss:ID="header"><Font ss:Bold="1"/></Style></Styles>
  <Worksheet ss:Name="Performans Raporu">
    <Table>
      <Row ss:StyleID="header"><Cell><Data ss:Type="String">Başlık</Data></Cell><Cell><Data ss:Type="String">Açıklama</Data></Cell></Row>
      ${content.map((line) => row(line)).join("")}
      ${row("Müşteri", company?.name || "-")}
      ${row("Kampanya", report.campaign_name || report.metrics?.campaignName || "-")}
      ${row("Harcama", formatTurkishCurrency(report.metrics?.spent || report.metrics?.spend || 0))}
      ${row("Gösterim", formatNumber(Number(report.metrics?.impressions || 0)))}
      ${row("Erişim", formatNumber(Number(report.metrics?.reach || 0)))}
      ${row("Tıklama", formatNumber(Number(report.metrics?.clicks || 0)))}
      ${row("Tıklama Oranı", `${Number(report.metrics?.ctr || 0).toLocaleString("tr-TR")}%`)}
      ${row("Dönüşüm", formatNumber(Number(report.metrics?.leads || report.metrics?.conversions || 0)))}
      ${row("Açıklama", report.customer_note || "-")}
      ${row("AI Yorumu", interpretation?.interpretation_text || "-")}
    </Table>
  </Worksheet>
</Workbook>`;
    return { buffer: Buffer.from(`\uFEFF${xml}`, "utf8"), contentType: "application/vnd.ms-excel; charset=utf-8", extension: "xls" };
  }
  if (format === "word") {
    return { buffer: await generateDocxBuffer(payload), contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx" };
  }
  return { buffer: await generatePdfBuffer(payload), contentType: "application/pdf", extension: "pdf" };
}
