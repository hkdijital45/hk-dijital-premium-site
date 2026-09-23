import "server-only";

import type { PreAuditReport } from "@/lib/pre-audit/types";
import { PRE_AUDIT_SECTION_LABELS, PRE_AUDIT_INTERNAL_SECTION_LABELS } from "@/lib/pre-audit/types";
import type { DocumentPayload, DocumentSection, DocumentTable } from "@/lib/server/document-generator";
import { safeFileNameSegment } from "@/lib/server/document-generator";
import { normalizeTurkishText, formatTurkishDateTime } from "@/lib/reports/report-exports";

// Ön İnceleme report → branded PDF/DOCX document model. EXPORT = RENDER,
// never research: this only reformats what save_pre_audit_report already
// persisted (see src/lib/pre-audit/reports.ts) into the same
// DocumentPayload shape every other export in the app uses
// (src/lib/server/document-generator.ts) — no second document engine, no
// AI call, no new research.
//
// CLIENT_REPORT export reads ONLY PRE_AUDIT_SECTION_LABELS fields — the
// six PRE_AUDIT_INTERNAL_SECTION_LABELS fields (sales_notes, sales_script,
// instagram_dm, whatsapp_initial, whatsapp_with_pdf, objections) are never
// read for a client document, even if a row somehow carried a value. This
// mirrors the same defence-in-depth already applied in reports.ts
// (savePreAuditReport strips them server-side for report_type =
// CLIENT_REPORT) and PreAuditCenter.tsx (never renders them for
// CLIENT_REPORT in the viewer either) — a third independent enforcement
// point at the export boundary.

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/** Strips literal markdown syntax Claude occasionally leaves in a plain-
 * text field (bold/heading/backtick markers, "- " bullets) — the field is
 * stored as plain text, not rendered markdown, so raw `**`/`#`/`` ` ``
 * must never reach the printed document. Never touches factual content. */
function stripMarkdownArtifacts(text: string): string {
  return text
    .replace(/```([\s\S]*?)```/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function textValue(value: unknown): string {
  return stripMarkdownArtifacts(normalizeTurkishText(value));
}

function prettifyKey(key: string): string {
  const spaced = key.replaceAll("_", " ").replace(/([a-zçğıöşü])([A-ZÇĞİÖŞÜ])/g, "$1 $2");
  const known: Record<string, string> = {
    rating: "Puan", reviewcount: "Yorum Sayısı", "review count": "Yorum Sayısı",
    followers: "Takipçi", following: "Takip Edilen", posts: "Paylaşım", handle: "Kullanıcı Adı",
    phonelisted: "Telefon", "phone listed": "Telefon", website: "Web Sitesi", instagram: "Instagram",
    google: "Google", price: "Fiyat", condition: "Koşul", classification: "Sınıflandırma", source: "Kaynak",
    name: "İsim", phone: "Telefon", package: "Paket", objective: "Hedef", targeting: "Hedefleme",
    dailybudget: "Günlük Bütçe", "daily budget": "Günlük Bütçe",
    priceexclvat: "KDV Hariç Fiyat", "price excl vat": "KDV Hariç Fiyat",
    priceinclvat: "KDV Dahil Fiyat", "price incl vat": "KDV Dahil Fiyat",
    phoneongbp: "Google Profilinde Telefon", "phone on gbp": "Google Profilinde Telefon",
    pricesignal: "Fiyat Bilgisi Kaynağı", "price signal": "Fiyat Bilgisi Kaynağı",
    reviewthemes: "Yorumlarda Öne Çıkan Temalar", "review themes": "Yorumlarda Öne Çıkan Temalar",
    websitelisted: "Google Profilinde Web Sitesi", "website listed": "Google Profilinde Web Sitesi",
    hours: "Çalışma Saatleri", address: "Adres", category: "Kategori", status: "Durum",
    location: "Konum", service: "Hizmet",
    gerekce: "Gerekçe", firsat: "Fırsat", kosul: "Koşul", siniflandirma: "Sınıflandırma",
    uyari: "Uyarı", butcesi: "Bütçesi", erisilebilirlik: "Erişilebilirlik"
  };
  // Plain (non-locale) lowercasing for the dictionary lookup only — the
  // dictionary keys above are plain ASCII English, and Turkish-locale
  // lowercasing turns "I" into dotless "ı" (e.g. "priceInclVat" -> "price
  // Incl Vat" -> tr-locale-lowercased "price ıncl vat", which then never
  // matches the ASCII "price incl vat" key). Turkish-locale casing is only
  // used below for the human-facing capitalization of whatever key wasn't
  // in the dictionary (which may legitimately be a Turkish word).
  const lower = spaced.toLowerCase();
  if (known[lower]) return known[lower];
  return spaced.replace(/\b\w/g, (c) => c.toLocaleUpperCase("tr"));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Turkish-locale number formatting only — never touches strings, so a
 * text field that happens to contain digits (a URL, a phone number kept
 * as a string) is never reformatted. 4.6 -> "4,6", 2299 -> "2.299". */
function formatNumberTr(value: number): string {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

/** The one place a single leaf value is turned into display text — the
 * root-cause fix lives here: an object/array NEVER reaches String() (the
 * source of the literal "[object Object]" bug) and NEVER reaches
 * JSON.stringify() for display (the source of raw `{"rating":4.6,...}`
 * leaking into the report body). Composite values are only ever handed
 * to renderValueLines(), never formatted as a single string. */
function formatPrimitiveForDisplay(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return formatNumberTr(value);
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (value === null || value === undefined) return "Bilgi bulunamadı";
  return textValue(String(value));
}

/** Recursively renders ANY JSON value (primitive, nested object, nested
 * array, array of objects, mixed array) into human-readable, indented
 * lines — used everywhere a nested structure previously risked reaching
 * String()/JSON.stringify(). A plain object becomes "Label: value" lines
 * (recursing into nested values instead of dumping raw JSON); an array of
 * objects becomes numbered blocks; a mixed array never silently drops its
 * non-object entries (the old code's array-of-objects branch did). */
function renderValueLines(value: unknown, depth = 0): string[] {
  if (isEmptyValue(value)) return [];
  const indent = "  ".repeat(depth);

  if (Array.isArray(value)) {
    const lines: string[] = [];
    value.forEach((item, index) => {
      if (isEmptyValue(item)) return;
      if (isPlainObject(item)) {
        lines.push(`${indent}${index + 1}.`);
        lines.push(...renderValueLines(item, depth + 1));
      } else if (Array.isArray(item)) {
        lines.push(...renderValueLines(item, depth));
      } else {
        // No manual bullet character here: every DocumentSection.items[]
        // entry is already auto-bulleted by both PDF/DOCX renderers
        // (drawBullet / bullet code "2022") — adding our own "•" would
        // double up into "• • text" for a plain top-level array.
        // Indentation alone conveys nesting depth for sub-items.
        lines.push(`${indent}${formatPrimitiveForDisplay(item)}`);
      }
    });
    return lines;
  }

  if (isPlainObject(value)) {
    const lines: string[] = [];
    for (const [key, entryValue] of Object.entries(value)) {
      if (isEmptyValue(entryValue)) continue;
      const label = prettifyKey(key);
      if (isPlainObject(entryValue) || Array.isArray(entryValue)) {
        lines.push(`${indent}${label}:`);
        lines.push(...renderValueLines(entryValue, depth + 1));
      } else {
        lines.push(`${indent}${label}: ${formatPrimitiveForDisplay(entryValue)}`);
      }
    }
    return lines;
  }

  return [`${indent}${formatPrimitiveForDisplay(value)}`];
}

// INTERNAL keeps the analyst's own SWOT vocabulary. CLIENT uses
// constructive, customer-facing terminology for the same two quadrants —
// a presentation-only relabeling (A7): the underlying analysis/meaning is
// never altered, only how "weaknesses" and "threats" are introduced to
// the business reading about itself.
const SWOT_QUADRANTS_INTERNAL: Array<[string, string]> = [
  ["strengths", "Güçlü Yönler"],
  ["weaknesses", "Zayıf Yönler"],
  ["opportunities", "Fırsatlar"],
  ["threats", "Tehditler / Rekabet Riskleri"]
];
const SWOT_QUADRANTS_CLIENT: Array<[string, string]> = [
  ["strengths", "Güçlü Yönler"],
  ["weaknesses", "Geliştirilebilecek Alanlar"],
  ["opportunities", "Fırsatlar"],
  ["threats", "Rekabet / Dikkat Edilmesi Gerekenler"]
];

function swotToSection(value: unknown, isInternal: boolean): DocumentSection | null {
  if (isEmptyValue(value)) return null;
  const swot = value as Record<string, unknown>;
  const quadrants = isInternal ? SWOT_QUADRANTS_INTERNAL : SWOT_QUADRANTS_CLIENT;
  const rows: string[][] = [];
  for (const [key, label] of quadrants) {
    const entry = swot[key];
    if (isEmptyValue(entry)) continue;
    // renderValueLines handles string/array/object uniformly — never
    // String()'s an object (root cause of literal "[object Object]" when a
    // SWOT quadrant is populated with structured entries, not plain text).
    const content = renderValueLines(entry).join("; ");
    if (content) rows.push([label, content]);
  }
  if (!rows.length) return null;
  const table: DocumentTable = { headers: ["Kategori", "Değerlendirme"], rows };
  return { title: "SWOT", table };
}

/** A single leaf cell in an object-array TABLE: unlike a full section body,
 * a table cell must stay a single (wrapped) string — so a nested
 * object/array inside a cell is flattened via renderValueLines and
 * joined, never JSON.stringify()'d. */
function cellValue(value: unknown): string {
  if (isEmptyValue(value)) return "—";
  if (isPlainObject(value) || Array.isArray(value)) {
    const lines = renderValueLines(value);
    return lines.length ? lines.join("; ") : "—";
  }
  return formatPrimitiveForDisplay(value);
}

function valueToSection(title: string, value: unknown): DocumentSection | null {
  if (isEmptyValue(value)) return null;

  if (typeof value === "string") return { title, text: textValue(value) };

  if (Array.isArray(value)) {
    const objectCount = value.filter((item) => isPlainObject(item)).length;
    if (objectCount === 0) {
      // Every entry is a primitive (or a nested array) — a plain bullet
      // list; formatPrimitiveForDisplay applies Turkish number/boolean
      // formatting instead of a naive String().
      const items = renderValueLines(value);
      return items.length ? { title, items } : null;
    }
    if (objectCount === value.filter((item) => !isEmptyValue(item)).length) {
      // Every non-empty entry is an object with a broadly similar shape
      // (e.g. competitor_analysis) — render as a professional table
      // instead of a bullet dump. Never fabricates a column the data
      // doesn't have; never JSON.stringify()'s a nested cell (root cause
      // of "Competitors: [object Object], [object Object]").
      const rows = value.filter((item): item is Record<string, unknown> => isPlainObject(item));
      const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 6);
      const table: DocumentTable = {
        headers: headers.map(prettifyKey),
        rows: rows.map((row) => headers.map((key) => cellValue(row[key])))
      };
      return { title, table };
    }
    // A genuinely mixed array (some objects, some plain strings/numbers) —
    // no single schema to tabulate. Falls back to the same recursive
    // bullet renderer, which (unlike the old code) never silently drops
    // the non-object entries.
    const items = renderValueLines(value);
    return items.length ? { title, items } : null;
  }

  if (isPlainObject(value)) {
    const items = renderValueLines(value);
    return items.length ? { title, items } : null;
  }

  return { title, text: textValue(String(value)) };
}

// A8 — CLIENT DATA FIREWALL. Even though these three fields are part of
// PRE_AUDIT_SECTION_LABELS (the "not sales-notes/scripts" list), they
// carry package name/price/classification and internal ad-budget
// figures — CLIENT_REPORT must never render them, no matter what the
// row contains. Enforced structurally here (buildClientSections simply
// never reads these keys), not by a regex/keyword scrub — the same
// defence-in-depth pattern already used for PRE_AUDIT_INTERNAL_SECTION_LABELS.
// They move to buildInternalOnlySections instead, so INTERNAL_REPORT
// still shows them in full.
const CLIENT_FIREWALL_KEYS = new Set(["recommended_package", "budget_plan", "ad_strategy"]);

// A6 — customer-first reading order for the client document (digital
// footprint first, then competitive context, then opportunities/next
// steps). Every key here is still one of PRE_AUDIT_SECTION_LABELS — this
// only resequences existing, already-vetted client-safe sections; it
// never adds a field that wasn't already client-visible.
const CLIENT_SECTION_ORDER = [
  "digital_presence", "google_analysis", "maps_analysis", "website_analysis", "seo_analysis",
  "social_analysis", "meta_ads_analysis", "google_ads_analysis", "market_analysis", "competitor_analysis",
  "digital_gaps", "opportunities", "recommended_services", "sources"
];

const CLIENT_ABOUT_TEXT = "Bu ön inceleme, işletmenin erişilebilen dijital varlıkları ve doğrulanabilen açık veriler üzerinden hazırlanmıştır. Amaç; mevcut güçlü yönleri, geliştirilebilecek alanları ve dijital büyüme fırsatlarını ortaya koymaktır.";
const CLIENT_NEXT_STEP_TEXT = "Ön incelemede belirlenen fırsatların işletmenin mevcut kapasitesi, hedefleri ve öncelikleriyle birlikte değerlendirilmesi için kısa bir görüşme öneriyoruz. Görüşme sonrasında ihtiyaçlara uygun çalışma kapsamı ve teklif hazırlanabilir.";

function buildClientSections(report: PreAuditReport, isInternal: boolean): DocumentSection[] {
  const sections: DocumentSection[] = [];
  if (!isInternal) sections.push({ title: "Bu Rapor Hakkında", text: CLIENT_ABOUT_TEXT });
  const order = isInternal ? PRE_AUDIT_SECTION_LABELS.map(([key]) => key) : CLIENT_SECTION_ORDER;
  const byKey = new Map(PRE_AUDIT_SECTION_LABELS);
  for (const key of order) {
    if (key === "executive_summary") continue; // rendered as the document's executive summary, not a repeated section
    if (!isInternal && CLIENT_FIREWALL_KEYS.has(key)) continue; // structurally unreachable for CLIENT_REPORT
    const label = byKey.get(key);
    if (!label) continue;
    const section = valueToSection(label, (report as unknown as Record<string, unknown>)[key]);
    if (section) sections.push(section);
  }
  // SWOT is not one of PRE_AUDIT_SECTION_LABELS (report.swot is a separate
  // column) — same placement as PreAuditCenter.tsx's ReportDetail, which
  // renders <SwotSection> right after the SECTION_LABELS loop. Client
  // quadrant labels (A7): constructive terminology, same underlying data.
  const swotSection = swotToSection(report.swot, isInternal);
  if (swotSection) sections.push(swotSection);
  if (!isInternal) sections.push({ title: "Sonraki Adım", text: CLIENT_NEXT_STEP_TEXT });
  return sections;
}

// sales_notes/sales_script/instagram_dm/whatsapp_initial/whatsapp_with_pdf/
// objections — the PRE_AUDIT_INTERNAL_SECTION_LABELS fields. The 3
// client-firewalled PRE_AUDIT_SECTION_LABELS fields (recommended_package/
// budget_plan/ad_strategy) are already included for INTERNAL_REPORT by
// buildClientSections(report, true) in their natural section order —
// never duplicated here.
function buildInternalOnlySections(report: PreAuditReport): DocumentSection[] {
  const sections: DocumentSection[] = [];
  for (const [key, label] of PRE_AUDIT_INTERNAL_SECTION_LABELS) {
    const section = valueToSection(label, (report as unknown as Record<string, unknown>)[key]);
    if (section) sections.push(section);
  }
  return sections;
}

/** Source of truth for BOTH PDF and DOCX — one payload, two renderers
 * (generatePdfBuffer/generateDocxBuffer), so the two formats can never
 * drift into different content. */
export function buildPreAuditDocumentPayload(report: PreAuditReport, companyDisplayName: string): DocumentPayload {
  const isInternal = report.report_type === "INTERNAL_REPORT";
  // created_at/updated_at (timestamptz) carry real time-of-day; report_date
  // is a bare date column, so the document's "Rapor Tarihi" uses created_at
  // to let the operator tell same-day re-checks apart.
  const createdLabel = formatTurkishDateTime(report.created_at);
  const updatedLabel = formatTurkishDateTime(report.updated_at);
  const meaningfullyUpdated = Boolean(report.created_at && report.updated_at) &&
    Math.abs(new Date(report.updated_at).getTime() - new Date(report.created_at).getTime()) >= 60000;

  // A8: since recommended_package/budget_plan/ad_strategy never reach the
  // CLIENT document body at all, a "... ve Teklif Raporu" title/filename
  // would promise offer content the document no longer contains — both
  // report types now use one plain, honest title regardless of what the
  // underlying report data happens to hold.
  const sections = buildClientSections(report, isInternal);
  if (isInternal) {
    const internalSections = buildInternalOnlySections(report);
    if (internalSections.length) sections.push(...internalSections);
  }

  return {
    title: isInternal ? "HK Dijital — Dahili Ön İnceleme Raporu" : "HK Dijital — Ön İnceleme Raporu",
    customerName: companyDisplayName,
    period: createdLabel,
    executiveSummary: textValue(report.executive_summary || ""),
    sections,
    footerNote: isInternal
      ? "HK Dijital · Dahili Kullanım · Müşteriyle Paylaşılmaz"
      : "HK Dijital · Dijital Pazarlama & Büyüme Çözümleri · hkdijital.com.tr",
    logo: true,
    confidentialLabel: isInternal ? "Dahili Kullanım" : undefined,
    metaLines: [
      `Firma: ${companyDisplayName}`,
      `Rapor Tarihi: ${createdLabel}`,
      ...(meaningfullyUpdated ? [`Son Güncelleme: ${updatedLabel}`] : []),
      "Hazırlayan: HK Dijital",
      isInternal ? "Rapor Türü: Dahili Satış & Toplantı Hazırlığı" : "Rapor Türü: Dijital Ön İnceleme"
    ]
  };
}

export function buildPreAuditFileName(report: PreAuditReport, companyDisplayName: string, format: "pdf" | "docx"): string {
  const isInternal = report.report_type === "INTERNAL_REPORT";
  const company = safeFileNameSegment(companyDisplayName);
  const suffix = isInternal ? "Dahili-On-Inceleme-Raporu" : "On-Inceleme-Raporu";
  return `HK-Dijital-${company}-${suffix}.${format}`;
}
