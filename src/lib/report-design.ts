// HK Dijital Premium Report System — pure, framework-free helpers shared by
// the PDF renderer (src/lib/server/premium-pdf.ts), the report payload
// builders and unit tests: brand palette, Turkish number/date formatting,
// chart-data integrity rules and logo fitting. No I/O, no pdf-lib.

/** Corporate palette. Turquoise matches the logo's cyan family but is
 * darkened enough to print well; text-safe variants are used whenever a
 * colour carries small text on white (contrast ≥ 4.5:1). */
export const REPORT_COLORS = {
  navy: "#10243A",
  navyDeep: "#0B1A2B",
  navySoft: "#173352",
  anthracite: "#273340",
  turquoise: "#11AFA8",
  turquoiseText: "#0B7B76",
  turquoiseLight: "#7FE0DA",
  gold: "#BFA33E", // existing --hk-gold brand value (authoritative)
  emerald: "#21866C",
  coral: "#E47868",
  coralText: "#B4483A",
  surface: "#F5F8FA",
  border: "#DCE3E8",
  muted: "#5E6B78",
  white: "#FFFFFF"
} as const;

/** Categorical order for multi-series/donut charts — restrained, brand-first. */
export const CHART_SERIES_COLORS = [REPORT_COLORS.turquoise, REPORT_COLORS.navy, REPORT_COLORS.gold, REPORT_COLORS.emerald, "#7A8CA0", REPORT_COLORS.coral] as const;

export function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// --- Turkish formatting -------------------------------------------------

export function formatNumberTr(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString("tr-TR", { maximumFractionDigits });
}

/** 1250.5 -> "1.250,50 TL" */
export function formatCurrencyTr(value: number): string {
  return `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
}

/** 12.5 -> "%12,5" (Turkish puts the sign before the number). */
export function formatPercentTr(value: number, maximumFractionDigits = 1): string {
  return `%${value.toLocaleString("tr-TR", { maximumFractionDigits })}`;
}

const TR_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** "2026-10-15" / Date -> "15 Ekim 2026". Invalid input -> "" (never "Invalid Date"). */
export function formatDateTr(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCDate()} ${TR_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export type ChartValueFormat = "number" | "currency" | "percent";

export function formatChartValue(value: number, format: ChartValueFormat = "number"): string {
  if (format === "currency") return formatCurrencyTr(value);
  if (format === "percent") return formatPercentTr(value);
  return formatNumberTr(value);
}

/** Compact axis label: 12500 -> "12,5 B", 1_250_000 -> "1,3 Mn". */
export function formatAxisValue(value: number, format: ChartValueFormat = "number"): string {
  const abs = Math.abs(value);
  const suffix = format === "currency" ? " TL" : "";
  if (format === "percent") return formatPercentTr(value, 0);
  if (abs >= 1_000_000) return `${formatNumberTr(value / 1_000_000, 1)} Mn${suffix}`;
  if (abs >= 10_000) return `${formatNumberTr(value / 1_000, 1)} B${suffix}`;
  return `${formatNumberTr(value, abs < 10 ? 1 : 0)}${suffix}`;
}

// --- Chart data integrity -----------------------------------------------

export type ChartDatum = { label: string; value: number | null | undefined };

/** Missing values are DROPPED (never treated as 0); negative values make a
 * bar/donut misleading so the whole chart is rejected; fewer than the
 * minimum meaningful points -> no chart at all. */
export function sanitizeChartData(data: ChartDatum[], type: "bar" | "hbar" | "line" | "donut"): Array<{ label: string; value: number }> | null {
  const clean = (data || [])
    .filter((d) => d && typeof d.label === "string" && d.label.trim() && typeof d.value === "number" && Number.isFinite(d.value))
    .map((d) => ({ label: d.label.trim(), value: d.value as number }));
  if (clean.some((d) => d.value < 0)) return null;
  const minPoints = type === "line" ? 3 : 2;
  if (clean.length < minPoints) return null;
  const total = clean.reduce((sum, d) => sum + d.value, 0);
  if (total <= 0) return null;
  if (type === "donut" && clean.filter((d) => d.value > 0).length < 2) return null;
  return clean;
}

/** "Nice" upper bound for a 0-based axis with `ticks` gridlines. */
export function niceAxisMax(max: number, ticks = 4): number {
  if (max <= 0) return 1;
  const rough = max / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * magnitude).find((s) => s >= rough) || 10 * magnitude;
  return step * ticks;
}

// --- Logo fitting --------------------------------------------------------

/** Fits a logo inside a box WITHOUT stretching or cropping, using an
 * equal-visual-area rule so a very wide wordmark and a square emblem look
 * equally weighted side by side (a square logo is not allowed to tower
 * over a wide one, a wide one is not shrunk to a sliver). */
export function fitLogo(width: number, height: number, maxWidth: number, maxHeight: number, targetArea = maxWidth * maxHeight * 0.55): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const ratio = width / height;
  let h = Math.sqrt(targetArea / ratio);
  let w = h * ratio;
  if (w > maxWidth) { w = maxWidth; h = w / ratio; }
  if (h > maxHeight) { h = maxHeight; w = h * ratio; }
  return { width: Math.round(w * 100) / 100, height: Math.round(h * 100) / 100 };
}

/** "Rapor Tarihi: 15 Ekim 2026" -> { label, value }; lines without a colon keep label "". */
export function splitMetaLine(line: string): { label: string; value: string } {
  const index = line.indexOf(":");
  if (index <= 0 || index > 40) return { label: "", value: line.trim() };
  return { label: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
}

/** "HK Dijital — Ön İnceleme Raporu" -> "Ön İnceleme Raporu" (the cover already shows the HK Dijital logo). */
export function displayReportTitle(title: string): string {
  return title.replace(/^HK\s*Dijital\s*[—–-]\s*/i, "").trim() || title;
}
