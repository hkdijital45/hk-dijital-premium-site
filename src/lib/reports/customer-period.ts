export type CustomerDateRangeKey = "today" | "last_7" | "last_30" | "this_month" | "last_month" | "custom";
export type CustomerPlatformFilter = "all" | "meta" | "google" | "social" | "general";

export type CustomerDateRange = {
  key: CustomerDateRangeKey;
  label: string;
  start: string;
  end: string;
};

export const customerDateRangeOptions: Array<{ key: CustomerDateRangeKey; label: string }> = [
  { key: "today", label: "Bugün" },
  { key: "last_7", label: "Son 7 Gün" },
  { key: "last_30", label: "Son 30 Gün" },
  { key: "this_month", label: "Bu Ay" },
  { key: "last_month", label: "Geçen Ay" },
  { key: "custom", label: "Özel Tarih Aralığı" }
];

export const customerPlatformOptions: Array<{ key: CustomerPlatformFilter; label: string }> = [
  { key: "all", label: "Tümü" },
  { key: "meta", label: "Meta Reklamları" },
  { key: "google", label: "Google Ads" },
  { key: "social", label: "Sosyal Medya" },
  { key: "general", label: "Genel Performans" }
];

export const customerMetricDefinitions = [
  {
    key: "impressions",
    label: "Gösterim",
    explanation: "Reklamınızın veya içeriğinizin ekranda toplam kaç kez göründüğünü gösterir."
  },
  {
    key: "reach",
    label: "Erişim",
    explanation: "Reklamınızın veya içeriğinizin ulaştığı farklı kişi sayısını gösterir."
  },
  {
    key: "clicks",
    label: "Tıklama",
    explanation: "Reklamınıza veya bağlantınıza gelen toplam tıklama sayısıdır."
  },
  {
    key: "link_clicks",
    label: "Bağlantı Tıklaması",
    explanation: "Web sitesi, WhatsApp veya hedef bağlantınıza yapılan tıklamaları gösterir."
  },
  {
    key: "conversions",
    label: "Dönüşüm",
    explanation: "Form, arama, mesaj veya satın alma gibi hedef aksiyonların toplamıdır."
  },
  {
    key: "spent",
    label: "Harcama",
    explanation: "Seçilen dönemde reklam ve pazarlama çalışmaları için kullanılan toplam bütçedir."
  },
  {
    key: "average_cpc",
    label: "Ortalama Tıklama Maliyeti",
    explanation: "Bir tıklama almak için ortalama ne kadar bütçe kullanıldığını gösterir."
  },
  {
    key: "cost_per_conversion",
    label: "Dönüşüm Maliyeti",
    explanation: "Bir dönüşüm veya müşteri aksiyonu için ortalama maliyeti gösterir."
  }
] as const;

const dayMs = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isoDate(date: Date) {
  return startOfLocalDay(date).toISOString().slice(0, 10);
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return startOfLocalDay(date);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfLocalDay(next);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = parseDate(value);
  return date ? date.toLocaleDateString("tr-TR") : value;
}

function daysBetween(start: string, end: string) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return 1;
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / dayMs) + 1);
}

export function getCustomerDateRange(key: CustomerDateRangeKey, customStart?: string, customEnd?: string, now = new Date()): CustomerDateRange {
  const today = startOfLocalDay(now);
  if (key === "today") return { key, label: "Bugün", start: isoDate(today), end: isoDate(today) };
  if (key === "last_7") return { key, label: "Son 7 Gün", start: isoDate(addDays(today, -6)), end: isoDate(today) };
  if (key === "last_30") return { key, label: "Son 30 Gün", start: isoDate(addDays(today, -29)), end: isoDate(today) };
  if (key === "this_month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { key, label: "Bu Ay", start: isoDate(start), end: isoDate(today) };
  }
  if (key === "last_month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { key, label: "Geçen Ay", start: isoDate(start), end: isoDate(end) };
  }
  const fallbackStart = customStart || isoDate(addDays(today, -29));
  const fallbackEnd = customEnd || isoDate(today);
  const start = parseDate(fallbackStart) || addDays(today, -29);
  const end = parseDate(fallbackEnd) || today;
  const normalizedStart = start.getTime() <= end.getTime() ? start : end;
  const normalizedEnd = start.getTime() <= end.getTime() ? end : start;
  return {
    key,
    label: `${formatDate(isoDate(normalizedStart))} - ${formatDate(isoDate(normalizedEnd))}`,
    start: isoDate(normalizedStart),
    end: isoDate(normalizedEnd)
  };
}

export function getPreviousDateRange(range: CustomerDateRange): CustomerDateRange {
  const start = parseDate(range.start) || new Date();
  const length = daysBetween(range.start, range.end);
  const end = addDays(start, -1);
  return {
    key: range.key,
    label: "Önceki dönem",
    start: isoDate(addDays(end, -(length - 1))),
    end: isoDate(end)
  };
}

export function platformFilterLabel(platform: CustomerPlatformFilter) {
  return customerPlatformOptions.find((item) => item.key === platform)?.label || "Tümü";
}

export function reportMatchesPlatform(report: any, platform: CustomerPlatformFilter) {
  if (platform === "all") return true;
  const text = `${report?.report_type || ""} ${report?.platform || ""}`.toLocaleLowerCase("tr-TR");
  if (platform === "meta") return text.includes("meta") || text.includes("facebook") || text.includes("instagram");
  if (platform === "google") return text.includes("google");
  if (platform === "social") return text.includes("sosyal") || text.includes("instagram") || text.includes("facebook") || text.includes("tiktok") || text.includes("youtube") || text.includes("linkedin");
  return text.includes("genel");
}

export function rowDate(row: any, fallback?: string | null) {
  return row?.date || row?.day || row?.period_date || fallback || null;
}

function isInRange(value: string | null, range: CustomerDateRange) {
  const date = parseDate(value);
  const start = parseDate(range.start);
  const end = parseDate(range.end);
  if (!date || !start || !end) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function reportIntersectsRange(report: any, range: CustomerDateRange) {
  const start = parseDate(report?.start_date || report?.date || report?.created_at);
  const end = parseDate(report?.end_date || report?.date || report?.created_at || report?.start_date);
  const rangeStart = parseDate(range.start);
  const rangeEnd = parseDate(range.end);
  if (!start || !end || !rangeStart || !rangeEnd) return true;
  return start.getTime() <= rangeEnd.getTime() && end.getTime() >= rangeStart.getTime();
}

function numberValue(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeMetricRow(row: any = {}) {
  const spent = numberValue(row.spent ?? row.cost);
  const clicks = numberValue(row.clicks);
  const conversions = numberValue(row.conversions ?? row.leads ?? row.messages);
  return {
    ...row,
    impressions: numberValue(row.impressions),
    reach: numberValue(row.reach),
    clicks,
    link_clicks: numberValue(row.link_clicks ?? row.outbound_clicks ?? row.clicks),
    conversions,
    spent,
    average_cpc: clicks > 0 ? spent / clicks : numberValue(row.average_cpc ?? row.cpc),
    cost_per_conversion: conversions > 0 ? spent / conversions : numberValue(row.cost_per_conversion ?? row.cost_per_lead)
  };
}

export function rowsForReport(report: any, range: CustomerDateRange) {
  const rows = Array.isArray(report?.time_series) ? report.time_series : [];
  const filteredRows = rows
    .filter((row) => isInRange(rowDate(row, report?.end_date || report?.start_date), range))
    .map((row) => normalizeMetricRow({ ...row, date: rowDate(row, report?.end_date || report?.start_date) }));
  if (filteredRows.length) return filteredRows;
  if (!reportIntersectsRange(report, range)) return [];
  const fallbackDate = report?.end_date || report?.start_date || range.end;
  return [normalizeMetricRow({ ...(report?.metrics || {}), date: fallbackDate })];
}

export function sumMetricRows(rows: any[]) {
  const totals = rows.reduce(
    (sum, row) => {
      const normalized = normalizeMetricRow(row);
      sum.impressions += normalized.impressions;
      sum.reach += normalized.reach;
      sum.clicks += normalized.clicks;
      sum.link_clicks += normalized.link_clicks;
      sum.conversions += normalized.conversions;
      sum.spent += normalized.spent;
      return sum;
    },
    { impressions: 0, reach: 0, clicks: 0, link_clicks: 0, conversions: 0, spent: 0, average_cpc: 0, cost_per_conversion: 0 }
  );
  totals.average_cpc = totals.clicks > 0 ? totals.spent / totals.clicks : 0;
  totals.cost_per_conversion = totals.conversions > 0 ? totals.spent / totals.conversions : 0;
  return totals;
}

export function filteredReportsForPeriod(reports: any[], range: CustomerDateRange, platform: CustomerPlatformFilter) {
  return (reports || [])
    .filter((report) => reportMatchesPlatform(report, platform))
    .map((report) => {
      const timeSeries = rowsForReport(report, range);
      return {
        ...report,
        period: `${range.label} · ${platformFilterLabel(platform)}`,
        metrics: sumMetricRows(timeSeries),
        time_series: timeSeries
      };
    })
    .filter((report) => report.time_series.length > 0);
}

export function aggregateCustomerReports(reports: any[], range: CustomerDateRange, platform: CustomerPlatformFilter) {
  const filteredReports = filteredReportsForPeriod(reports, range, platform);
  const rows = filteredReports.flatMap((report) => report.time_series || []);
  return {
    id: filteredReports[0]?.id || "selected-period",
    company_id: filteredReports[0]?.company_id,
    report_type: platform === "all" ? "Genel Dijital Performans Raporu" : `${platformFilterLabel(platform)} Performans Raporu`,
    platform: platformFilterLabel(platform),
    period: range.label,
    start_date: range.start,
    end_date: range.end,
    visible_to_customer: true,
    metrics: sumMetricRows(rows),
    time_series: rows,
    customer_note: filteredReports.map((report) => report.customer_note).filter(Boolean).join("\n")
  };
}

export function comparisonPercent(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatCustomerMetricValue(key: string, value: number) {
  if (key === "spent" || key === "average_cpc" || key === "cost_per_conversion") {
    return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL`;
  }
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export function buildTrendRows(reports: any[], range: CustomerDateRange, platform: CustomerPlatformFilter) {
  const rows = filteredReportsForPeriod(reports, range, platform).flatMap((report) => report.time_series || []);
  const weekly = daysBetween(range.start, range.end) > 31;
  const rangeStart = parseDate(range.start) || new Date();
  const grouped = new Map<string, any>();
  rows.forEach((row) => {
    const date = parseDate(rowDate(row, range.end));
    if (!date) return;
    const bucketStart = weekly ? addDays(rangeStart, Math.floor((date.getTime() - rangeStart.getTime()) / dayMs / 7) * 7) : date;
    const bucketEnd = weekly ? addDays(bucketStart, 6) : bucketStart;
    const key = weekly ? `${isoDate(bucketStart)}_${isoDate(bucketEnd)}` : isoDate(bucketStart);
    const label = weekly ? `${formatDate(isoDate(bucketStart))} - ${formatDate(isoDate(bucketEnd))}` : formatDate(isoDate(bucketStart));
    const current = grouped.get(key) || { date: isoDate(bucketStart), label, clicks: 0, reach: 0, conversions: 0, spent: 0 };
    const normalized = normalizeMetricRow(row);
    current.clicks += normalized.clicks;
    current.reach += normalized.reach;
    current.conversions += normalized.conversions;
    current.spent += normalized.spent;
    grouped.set(key, current);
  });
  return Array.from(grouped.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function filterUpdatesForRange(updates: any[], range: CustomerDateRange, reportIds?: string[]) {
  const allowedIds = reportIds?.length ? new Set(reportIds) : null;
  return (updates || []).filter((update) => {
    if (allowedIds && !allowedIds.has(update.report_id)) return false;
    return isInRange(update.update_date || update.created_at, range);
  });
}

