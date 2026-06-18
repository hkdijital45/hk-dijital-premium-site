/* eslint-disable @typescript-eslint/no-explicit-any */
import { reportHighlights } from "./report-metrics";
import { buildActionPlan, calculateHKIntelligenceScore, calculateHealthScore, formatCurrency, formatNumber, getLeadTracking, getWorkLogItems } from "./report-insights";

export type ExportFormat = "excel" | "word" | "pdf";

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
    ...plan.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Ajans Notları ve Güncellemeler",
    ...workLog.map((update) => `${update.date} - ${update.title} (${update.category} / ${update.status}): ${update.description}${updates.find((item) => item.id === update.id)?.next_action ? ` Sonraki adım: ${updates.find((item) => item.id === update.id)?.next_action}` : ""}`),
    "",
    "Not: Sonuçlar sektör, bütçe, hedef kitle, teklif ve rekabet durumuna göre değişebilir."
  ];
}

export async function generateReportExport(format: ExportFormat, report: any, company: any, interpretation?: any, updates: any[] = [], visibilityRules: any[] = []) {
  const content = lines(report, company, interpretation, updates, visibilityRules);
  if (format === "excel") {
    const escape = (value: string) => `<Row><Cell><Data ss:Type="String">${value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</Data></Cell></Row>`;
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Performans Raporu"><Table>${content.map(escape).join("")}</Table></Worksheet></Workbook>`;
    return { buffer: Buffer.from(xml), contentType: "application/vnd.ms-excel", extension: "xls" };
  }
  if (format === "word") {
    const html = `<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif">${content.map((line, index) => index < 2 ? `<h${index + 1}>${line}</h${index + 1}>` : `<p>${line}</p>`).join("")}</body></html>`;
    return { buffer: Buffer.from(html), contentType: "application/msword", extension: "doc" };
  }
  const safe = content.join("\n").replace(/[^\x20-\x7E\n]/g, "").replace(/[()\\]/g, "\\$&");
  const linesPdf = safe.split("\n").flatMap((line) => line.match(/.{1,86}(\s|$)/g) || [line]);
  const stream = `BT /F1 10 Tf 45 800 Td ${linesPdf.map((line, index) => `${index ? "0 -14 Td " : ""}(${line.trim()}) Tj`).join(" ")} ET`;
  const objects = [`1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`, `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`, `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`, `4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`, `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object) => { offsets.push(pdf.length); pdf += `${object}\n`; });
  const start = pdf.length; pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => String(offset).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return { buffer: Buffer.from(pdf), contentType: "application/pdf", extension: "pdf" };
}
