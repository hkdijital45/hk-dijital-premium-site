export type ProfessionalReportSection = {
  title: string;
  items?: unknown[];
  text?: string;
};

export type ProfessionalReportPayload = {
  title: string;
  customerName?: string;
  period?: string;
  summary?: string;
  sections?: ProfessionalReportSection[];
  table?: Array<Record<string, unknown>>;
  generatedAt?: string;
};

export function sanitizeExportValue(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n");
}

export function escapeHtml(value: unknown) {
  return sanitizeExportValue(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildCsvExport(rows: Array<Record<string, unknown>>, columns?: string[]) {
  const activeColumns = columns?.length ? columns : Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => `"${sanitizeExportValue(typeof value === "object" && value !== null ? JSON.stringify(value) : value).replace(/"/g, '""')}"`;
  return `\uFEFF${[activeColumns.join(","), ...rows.map((row) => activeColumns.map((column) => escape(row[column])).join(","))].join("\n")}`;
}

export function buildExcelCompatibleCsv(rows: Array<Record<string, unknown>>, columns?: string[]) {
  return buildCsvExport(rows, columns);
}

export function buildWordMarkdownReport(payload: ProfessionalReportPayload) {
  const sections = (payload.sections || []).flatMap((section) => [
    `## ${section.title}`,
    section.text || "",
    ...(section.items || []).map((item) => `- ${sanitizeExportValue(item)}`),
    ""
  ]);
  return `# ${sanitizeExportValue(payload.title)}

Müşteri / Firma: ${sanitizeExportValue(payload.customerName || "-")}
Oluşturulma tarihi: ${sanitizeExportValue(payload.generatedAt || new Date().toISOString())}
Veri dönemi: ${sanitizeExportValue(payload.period || "-")}

## Yönetici Özeti
${sanitizeExportValue(payload.summary || "Bu rapor HK Dijital karar destek çıktısıdır.")}

${sections.join("\n")}
Not: Bu rapor bilgilendirme ve karar destek amaçlıdır; satış garantisi içermez.
`;
}

export function buildPrintableHtmlReport(payload: ProfessionalReportPayload) {
  const tableRows = payload.table || [];
  const columns = Array.from(new Set(tableRows.flatMap((row) => Object.keys(row)))).slice(0, 16);
  const sectionHtml = (payload.sections || []).map((section) => `<section>
    <h2>${escapeHtml(section.title)}</h2>
    ${section.text ? `<p>${escapeHtml(section.text)}</p>` : ""}
    ${section.items?.length ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
  </section>`).join("");
  const tableHtml = tableRows.length ? `<section><h2>Tablo</h2><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${tableRows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("")}</tr>`).join("")}</tbody></table></section>` : "";
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(payload.title)}</title>
  <style>
    @page { size: A4; margin: 17mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Inter, Arial, Helvetica, sans-serif; line-height: 1.55; }
    main { max-width: 980px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 28px; }
    .brand { color: #0891b2; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 8px 0 10px; font-size: 30px; line-height: 1.15; }
    h2 { margin: 22px 0 8px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 17px; }
    .meta { color: #475569; font-size: 13px; }
    .summary { margin-top: 18px; border-radius: 14px; background: #ecfeff; border: 1px solid #bae6fd; padding: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    .note { margin-top: 24px; border-radius: 12px; background: #fff7ed; border: 1px solid #fed7aa; padding: 12px; color: #9a3412; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <p class="brand">HK Dijital</p>
    <h1>${escapeHtml(payload.title)}</h1>
    <p class="meta">Müşteri / Firma: ${escapeHtml(payload.customerName || "-")} · Veri dönemi: ${escapeHtml(payload.period || "-")} · Oluşturulma: ${escapeHtml(payload.generatedAt || new Date().toLocaleString("tr-TR"))}</p>
    <div class="summary"><strong>Yönetici Özeti</strong><p>${escapeHtml(payload.summary || "Bu çıktı profesyonel rapor şablonuyla hazırlanmıştır.")}</p></div>
    ${tableHtml}
    ${sectionHtml}
    <p class="note">Bu rapor bilgilendirme ve karar destek amaçlıdır; satış garantisi içermez.</p>
  </main>
</body>
</html>`;
}
