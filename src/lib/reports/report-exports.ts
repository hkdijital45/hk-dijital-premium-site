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

function escapeXml(value: unknown) {
  return normalizeTurkishText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeHtml(value: unknown) {
  return normalizeTurkishText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function reportHtml(content: string[], title = "HK Dijital Performans Raporu") {
  const rows = content.map((line, index) => {
    const text = escapeHtml(line);
    if (!line) return `<div class="spacer"></div>`;
    if (index === 0) return `<p class="brand">${text}</p>`;
    if (index === 1) return `<h1>${text}</h1>`;
    if (["Öne Çıkan Metrikler", "Lead / WhatsApp Takibi", "Yapay Zekâ Destekli Yorum", "Önümüzdeki 7 Gün Planı", "Ajans Notları ve Güncellemeler"].includes(line)) return `<h2>${text}</h2>`;
    return `<p>${text}</p>`;
  }).join("");
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Inter, Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.55; }
    main { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 28px; }
    .brand { color: #0891b2; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 8px 0 18px; font-size: 27px; line-height: 1.15; color: #0f172a; }
    h2 { margin: 20px 0 8px; font-size: 16px; color: #0f172a; border-top: 1px solid #e2e8f0; padding-top: 14px; }
    p { margin: 6px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    .spacer { height: 8px; }
  </style>
</head>
<body><main>${rows}</main></body>
</html>`;
}

async function createTurkishPdf(content: string[]) {
  const html = reportHtml(content);
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ locale: "tr-TR" });
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    await browser.close();
    return { buffer: Buffer.from(pdf), contentType: "application/pdf", extension: "pdf" };
  } catch {
    return { buffer: Buffer.from(`\uFEFF${html}`, "utf8"), contentType: "text/html; charset=utf-8", extension: "html" };
  }
}

export async function generateReportExport(format: ExportFormat, report: any, company: any, interpretation?: any, updates: any[] = [], visibilityRules: any[] = []) {
  const content = lines(report, company, interpretation, updates, visibilityRules).map(normalizeTurkishText);
  if (format === "excel") {
    const row = (label: string, value = "") => `<Row><Cell><Data ss:Type="String">${escapeXml(label)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell></Row>`;
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
    const html = reportHtml(content);
    return { buffer: Buffer.from(`\uFEFF${html}`, "utf8"), contentType: "application/msword; charset=utf-8", extension: "doc" };
  }
  return createTurkishPdf(content);
}
