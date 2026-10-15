// Premium PDF V3.2 — automatic charts from a report's OWN structured
// tables. Pure and client-safe (the Rapor Merkezi viewer uses it too).
//
// Never invents data:
//  - Only table cells whose WHOLE content is a number (optionally with a
//    single known unit) are read; numbers inside sentences are ignored.
//  - A column is charted only when every row parses with the same unit;
//    missing / unparsable cells cancel the chart (never zero-filled).
//  - A "Toplam" row is excluded from the bars and must equal the sum of
//    the categories, otherwise no chart is drawn.
//  - Identifier-like columns (yıl, tarih, telefon, kod, no…) are skipped.
//  - Planned / forecast sections are labelled as such in the caption.
// When anything fails validation the original table stays exactly as is.
import type { DocumentChart, DocumentPayload, DocumentSection } from "@/lib/document-model";
import { cellLabel } from "@/lib/document-model";
import { formatChartValue } from "@/lib/report-design";

type Unit = "count" | "currency" | "percent";
type Parsed = { value: number; unit: Unit };

const COUNT_UNITS = "adet|gönderi|post|paylaşım|yorum|takipçi|beğeni|görüntülenme|kişi|tıklama|mesaj|sonuç|video|reels|story|hikaye";
const NUMBER = String.raw`(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?|\d+\.\d{1,2}`;
const CELL_RE = new RegExp(String.raw`^(?:(₺|TL)\s*)?(${NUMBER})\s*(%|TL|₺|(?:${COUNT_UNITS}))?$`, "iu");
const PERCENT_PREFIX_RE = new RegExp(String.raw`^%\s*(${NUMBER})$`, "u");
const SKIP_HEADER_RE = /\b(yıl|tarih|telefon|tel|no|numara|kod|id|posta|adres|sıra|versiyon|sürüm)\b/iu;
const TOTAL_RE = /^(toplam|genel toplam|total|toplam gönderi|analiz edilen)/iu;
const LABEL_HEADER_RE = /^(alan|değer)$/iu;
const RATING_RE = /(puan|rating|yıldız|ortalama puan)/iu;
const FORECAST_RE = /(bütçe|tahmin|öngörü|hedef|plan|öneri|önerilen|projeksiyon)/iu;
const DISTRIBUTION_RE = /(da[gğ][iı]l[iı]m|kategori|category|format|oran[iı]?\b|\bpay\b|breakdown|distribution|content mix)/iu;
const TREND_LABEL_RE = /^(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|\d{1,2}[./]\d{1,2}([./]\d{2,4})?|\d{4}-\d{2}(-\d{2})?|\d+\.\s*(hafta|gün|ay))/iu;

function toNumber(raw: string): number {
  // "1.250,5" (tr) / "4.8" (decimal point with 1-2 digits) / "1.250" (tr thousands)
  if (/^\d+\.\d{1,2}$/.test(raw)) return Number(raw);
  return Number(raw.replace(/\./g, "").replace(",", "."));
}

/** Strict: the whole cell must be one number (+ one optional unit). */
export function parseNumericCell(cell: string): Parsed | null {
  const text = cell.replace(/ /g, " ").trim();
  if (!text || text.length > 32) return null;
  const pct = text.match(PERCENT_PREFIX_RE);
  if (pct) return finite(toNumber(pct[1]), "percent");
  const m = text.match(CELL_RE);
  if (!m) return null;
  const unitToken = (m[1] || m[3] || "").toLocaleLowerCase("tr");
  const unit: Unit = unitToken === "%" ? "percent" : unitToken === "tl" || unitToken === "₺" ? "currency" : "count";
  return finite(toNumber(m[2]), unit);
}

function finite(value: number, unit: Unit): Parsed | null {
  return Number.isFinite(value) ? { value, unit } : null;
}

const FORMAT: Record<Unit, DocumentChart["valueFormat"]> = { count: "number", currency: "currency", percent: "percent" };

function pct(part: number, total: number) {
  return (part / total * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

function caption(kind: "distribution" | "comparison" | "trend", data: Array<{ label: string; value: number }>, format: DocumentChart["valueFormat"], forecast: boolean, source: string): string {
  const total = data.reduce((s, d) => s + d.value, 0);
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const low = sorted[sorted.length - 1];
  const f = (v: number) => formatChartValue(v, format);
  let body: string;
  if (kind === "distribution") {
    body = `Toplam ${f(total)} içinde en büyük pay ${top.label} (${f(top.value)}, %${pct(top.value, total)}); en küçük pay ${low.label} (${f(low.value)}, %${pct(low.value, total)}).`;
  } else if (kind === "trend") {
    const first = data[0];
    const last = data[data.length - 1];
    body = `${first.label} döneminde ${f(first.value)}, ${last.label} döneminde ${f(last.value)}; en yüksek değer ${top.label} (${f(top.value)}).`;
  } else {
    body = `En yüksek değer ${top.label} (${f(top.value)}), en düşük değer ${low.label} (${f(low.value)}).`;
  }
  const prefix = forecast ? "Planlanan / önerilen değerlerdir, gerçekleşmiş performans değildir. " : "";
  return `${prefix}${body} Kaynak: rapordaki "${source}" tablosu.`;
}

type Candidate = { chart: DocumentChart; signature: string };

function sectionCharts(section: DocumentSection): Candidate[] {
  const table = section.table;
  if (!table || table.headers.length < 2 || table.rows.length < 2 || table.rows.length > 24) return [];
  const labels = table.rows.map((r) => cellLabel(r[0] ?? "").trim());
  if (labels.some((l) => !l) || new Set(labels).size !== labels.length) return [];
  const sectionTitle = section.title.replace(/\s*\(devam\)\s*$/i, "");
  const forecast = FORECAST_RE.test(sectionTitle);
  const out: Candidate[] = [];

  for (let col = 1; col < table.headers.length && out.length < 2; col += 1) {
    const header = table.headers[col] || "";
    if (SKIP_HEADER_RE.test(header)) continue;
    const parsed = table.rows.map((r) => parseNumericCell(cellLabel(r[col] ?? "")));
    if (parsed.some((p) => !p)) continue; // a missing value cancels the chart — never 0
    const units = new Set(parsed.map((p) => p!.unit));
    if (units.size !== 1) continue; // never mix TL / % / counts
    const unit = parsed[0]!.unit;
    let data = labels.map((label, i) => ({ label, value: parsed[i]!.value }));
    if (data.some((d) => d.value < 0)) continue;
    if (labels.every((l) => /^\d{4}$/.test(l)) && data.every((d) => d.value >= 1900 && d.value <= 2100)) continue;

    // A "Toplam" row must equal the categories' sum; it is not drawn.
    const totalIndex = data.findIndex((d) => TOTAL_RE.test(d.label));
    if (totalIndex >= 0) {
      const total = data[totalIndex].value;
      data = data.filter((_, i) => i !== totalIndex);
      const sum = data.reduce((s, d) => s + d.value, 0);
      if (Math.abs(sum - total) > 0.001 * Math.max(1, total)) continue;
    }
    if (data.length < 2) continue;
    // A key/value table lists DIFFERENT metrics (takipçi, gönderi, puan…):
    // they are only charted together when the table is a real breakdown of
    // one quantity (a validated "Toplam" row or a distribution title).
    const keyValue = /^(kategori|alan|metrik)$/iu.test(table.headers[0] || "") && LABEL_HEADER_RE.test(header);
    if (keyValue && !(totalIndex >= 0 || DISTRIBUTION_RE.test(sectionTitle))) continue;
    if (data.some((d) => RATING_RE.test(d.label))) continue; // ratings never share an axis with counts
    const sum = data.reduce((s, d) => s + d.value, 0);
    if (sum <= 0 || data.every((d) => d.value === data[0].value)) continue;

    const format = FORMAT[unit];
    const rating = RATING_RE.test(header);
    if (rating && data.some((d) => d.value > 10)) continue; // not a rating scale
    const trend = data.length >= 3 && data.every((d) => TREND_LABEL_RE.test(d.label));
    const longLabels = data.some((d) => d.label.length > 14);
    const distribution = !trend && !rating && unit !== "percent" && (totalIndex >= 0 || DISTRIBUTION_RE.test(`${sectionTitle} ${header}`)) && data.length <= 6;
    const type: DocumentChart["type"] = trend ? "line" : distribution ? "donut" : longLabels || data.length > 6 ? "hbar" : "bar";
    const valueHeader = LABEL_HEADER_RE.test(header) ? "" : header;
    const title = valueHeader && !LABEL_HEADER_RE.test(table.headers[0] || "") ? `${sectionTitle} — ${valueHeader}` : sectionTitle;
    out.push({
      chart: { type, title, data, valueFormat: format, caption: caption(trend ? "trend" : distribution ? "distribution" : "comparison", data, format, forecast, sectionTitle) },
      signature: data.map((d) => d.value).sort((a, b) => a - b).join("|")
    });
  }
  return out;
}

/** Returns a copy of the payload with validated automatic charts added to
 * sections that have chartable structured tables and no chart of their
 * own. Charts whose values duplicate an existing chart are not added. */
export function withAutomaticCharts<T extends Pick<DocumentPayload, "sections">>(payload: T): T {
  const existing = new Set<string>();
  for (const section of payload.sections) {
    for (const chart of section.charts || []) {
      existing.add(chart.data.map((d) => d.value).filter((v): v is number => typeof v === "number").sort((a, b) => a - b).join("|"));
    }
  }
  let changed = false;
  const sections = payload.sections.map((section) => {
    if (section.charts?.length) return section;
    const candidates = sectionCharts(section).filter((c) => !existing.has(c.signature));
    if (!candidates.length) return section;
    candidates.forEach((c) => existing.add(c.signature));
    changed = true;
    return { ...section, charts: candidates.map((c) => c.chart) };
  });
  return changed ? { ...payload, sections } : payload;
}
