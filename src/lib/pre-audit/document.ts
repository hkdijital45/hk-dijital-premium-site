import "server-only";

import type { PreAuditReport } from "@/lib/pre-audit/types";
import { PRE_AUDIT_SECTION_LABELS, PRE_AUDIT_INTERNAL_SECTION_LABELS } from "@/lib/pre-audit/types";
import type { DocumentPayload, DocumentSection, DocumentTable } from "@/lib/server/document-generator";
import { safeFileNameSegment } from "@/lib/server/document-generator";
import { normalizeTurkishText, formatTurkishDate } from "@/lib/reports/report-exports";

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
  return key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toLocaleUpperCase("tr"));
}

const SWOT_QUADRANTS: Array<[string, string]> = [
  ["strengths", "Güçlü Yönler"],
  ["weaknesses", "Zayıf Yönler"],
  ["opportunities", "Fırsatlar"],
  ["threats", "Tehditler / Rekabet Riskleri"]
];

function swotToSection(value: unknown): DocumentSection | null {
  if (isEmptyValue(value)) return null;
  const swot = value as Record<string, unknown>;
  const rows: string[][] = [];
  for (const [key, label] of SWOT_QUADRANTS) {
    const entry = swot[key];
    if (isEmptyValue(entry)) continue;
    const content = Array.isArray(entry) ? entry.map((item) => textValue(String(item))).join("; ") : textValue(String(entry));
    rows.push([label, content]);
  }
  if (!rows.length) return null;
  const table: DocumentTable = { headers: ["Kategori", "Değerlendirme"], rows };
  return { title: "SWOT", table };
}

function valueToSection(title: string, value: unknown): DocumentSection | null {
  if (isEmptyValue(value)) return null;

  if (typeof value === "string") return { title, text: textValue(value) };

  if (Array.isArray(value)) {
    if (value.every((item) => typeof item !== "object" || item === null)) {
      return { title, items: value.map((item) => textValue(String(item))) };
    }
    const rows = value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
    if (!rows.length) return null;
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 6);
    const table: DocumentTable = {
      headers: headers.map(prettifyKey),
      rows: rows.map((row) => headers.map((key) => {
        const cell = row[key];
        return textValue(typeof cell === "object" && cell !== null ? JSON.stringify(cell) : String(cell ?? "—"));
      }))
    };
    return { title, table };
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const items = entries
      .map(([key, entryValue]) => {
        if (isEmptyValue(entryValue)) return "";
        const rendered = typeof entryValue === "object"
          ? (Array.isArray(entryValue) ? entryValue.map((v) => textValue(String(v))).join(", ") : textValue(JSON.stringify(entryValue)))
          : textValue(String(entryValue));
        return rendered ? `${prettifyKey(key)}: ${rendered}` : "";
      })
      .filter(Boolean);
    return items.length ? { title, items } : null;
  }

  return { title, text: textValue(String(value)) };
}

function buildClientSections(report: PreAuditReport): DocumentSection[] {
  const sections: DocumentSection[] = [];
  for (const [key, label] of PRE_AUDIT_SECTION_LABELS) {
    if (key === "executive_summary") continue; // rendered as the document's executive summary, not a repeated section
    const section = valueToSection(label, (report as unknown as Record<string, unknown>)[key]);
    if (section) sections.push(section);
  }
  // SWOT is not one of PRE_AUDIT_SECTION_LABELS (report.swot is a separate
  // column) — same placement as PreAuditCenter.tsx's ReportDetail, which
  // renders <SwotSection> right after the SECTION_LABELS loop.
  const swotSection = swotToSection(report.swot);
  if (swotSection) sections.push(swotSection);
  return sections;
}

function buildInternalOnlySections(report: PreAuditReport): DocumentSection[] {
  const sections: DocumentSection[] = [];
  for (const [key, label] of PRE_AUDIT_INTERNAL_SECTION_LABELS) {
    const section = valueToSection(label, (report as unknown as Record<string, unknown>)[key]);
    if (section) sections.push(section);
  }
  return sections;
}

function hasOfferContent(report: PreAuditReport): boolean {
  return !isEmptyValue(report.recommended_package) || !isEmptyValue(report.budget_plan) || !isEmptyValue(report.recommended_services);
}

/** Source of truth for BOTH PDF and DOCX — one payload, two renderers
 * (generatePdfBuffer/generateDocxBuffer), so the two formats can never
 * drift into different content. */
export function buildPreAuditDocumentPayload(report: PreAuditReport, companyDisplayName: string): DocumentPayload {
  const isInternal = report.report_type === "INTERNAL_REPORT";
  const reportDateLabel = formatTurkishDate(report.report_date);
  const offerTitle = hasOfferContent(report);

  const sections = buildClientSections(report);
  if (isInternal) {
    const internalSections = buildInternalOnlySections(report);
    if (internalSections.length) sections.push(...internalSections);
  }

  return {
    title: isInternal
      ? "HK Dijital — Dahili Ön İnceleme Raporu"
      : offerTitle ? "HK Dijital — Ön İnceleme ve Teklif Raporu" : "HK Dijital — Ön İnceleme Raporu",
    customerName: companyDisplayName,
    period: reportDateLabel,
    executiveSummary: textValue(report.executive_summary || ""),
    sections,
    footerNote: isInternal
      ? "HK Dijital • Dahili Kullanım — yalnızca HK Dijital ekibi içindir, müşteriyle paylaşılmaz."
      : "HK Dijital • Dijital Büyüme ve Pazarlama  ·  hkdijital.com.tr",
    logo: true,
    confidentialLabel: isInternal ? "Dahili Kullanım" : undefined,
    metaLines: [
      `Firma: ${companyDisplayName}`,
      `Rapor Tarihi: ${reportDateLabel}`,
      "Hazırlayan: HK Dijital"
    ]
  };
}

export function buildPreAuditFileName(report: PreAuditReport, companyDisplayName: string, format: "pdf" | "docx"): string {
  const isInternal = report.report_type === "INTERNAL_REPORT";
  const company = safeFileNameSegment(companyDisplayName);
  const suffix = isInternal
    ? "Dahili-On-Inceleme-Raporu"
    : hasOfferContent(report) ? "On-Inceleme-ve-Teklif-Raporu" : "On-Inceleme-Raporu";
  return `HK-Dijital-${company}-${suffix}.${format}`;
}
