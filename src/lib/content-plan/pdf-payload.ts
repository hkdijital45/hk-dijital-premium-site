// Builds the DocumentPayload (see server/document-generator.ts's
// generatePdfBuffer — the one canonical, Turkish-glyph-safe, HK Dijital-
// branded PDF engine every export in the app already goes through) for
// an İçerik Takip content plan — either a client-facing "Müşteri PDF" or
// an internal-only "İç Operasyon PDF". Pure/no I/O — easy to unit test
// without generating an actual PDF binary.
//
// Readability design: each content item becomes its own compact header
// section (bigger titleSize, extra spacingBefore/minSpaceBefore so its
// title is never orphaned alone at the bottom of a page) followed by ONE
// SMALL SECTION PER FIELD (label as the section title — rendered in the
// engine's existing gold/13pt-by-default subheading style at a slightly
// smaller size, value as the body) instead of one long label:value wall
// of text — this is presentation-only: no field is added, removed, or
// reworded, only how it's laid out on the page.
import { parseContentPlanNotes } from "./notes-parser";
import { CONTENT_FORMAT_LABELS, type ContentFormatKey, type ContentPlanItem } from "./types";
import type { DocumentPayload, DocumentSection } from "@/lib/server/document-generator";

export type ContentPlanPdfMode = "customer" | "internal";

const FIELD_TITLE_SIZE = 10.5;

export function formatContentPlanDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Splits free text into readable chunks WITHOUT inventing or reordering
 * any content — prefers the author's own line breaks (the only fully
 * safe signal), and only falls back to sentence-boundary splitting when
 * there are no line breaks at all. If neither produces a confident,
 * reasonably-sized split, the original text is kept as a single block —
 * an unsplit block is always safer than a wrongly-cut one. */
function splitIntoReadableChunks(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const byLines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (byLines.length > 1) return byLines;
  const bySentence = trimmed.split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9])/).map((s) => s.trim()).filter(Boolean);
  if (bySentence.length > 1 && bySentence.every((s) => s.length >= 3)) return bySentence;
  return [trimmed];
}

/** Presentation-only helper (not a parser) — renders a naturally step-like
 * field (e.g. contentFlow) as a numbered list when it safely splits into
 * more than one real chunk, otherwise returns the original text
 * untouched. Never fabricates a step. */
function formatAsNumberedText(value: string): string {
  const chunks = splitIntoReadableChunks(value);
  if (chunks.length <= 1) return value.trim();
  // If every chunk already starts with its own number/step marker (the
  // author already wrote "1 kapak", "2. Adım 1: ..." etc.), adding a
  // second "N. " prefix on top would look redundant — the source is left
  // exactly as written instead.
  if (chunks.every((c) => /^\d+[.):-]?\s/.test(c))) return chunks.join("\n");
  return chunks.map((c, i) => `${i + 1}. ${c}`).join("\n");
}

/** Same idea as formatAsNumberedText but for bulleted fields (Story
 * Desteği, internal Koşullar/Üretim Notu) — returns an `items` array for
 * the engine's existing bullet renderer; a single-chunk value still comes
 * back as one bullet so it stays visually separated from other fields. */
function formatAsBullets(value: string): string[] {
  return splitIntoReadableChunks(value);
}

function fieldSection(label: string, text: string | null | undefined): DocumentSection | null {
  if (!text) return null;
  return { title: label, titleSize: FIELD_TITLE_SIZE, text };
}

function bulletFieldSection(label: string, value: string | null | undefined): DocumentSection | null {
  if (!value) return null;
  return { title: label, titleSize: FIELD_TITLE_SIZE, items: formatAsBullets(value) };
}

function itemSections(item: ContentPlanItem, mode: ContentPlanPdfMode, index: number): DocumentSection[] {
  const parsed = parseContentPlanNotes(item.notes);
  const formatLabel = (CONTENT_FORMAT_LABELS[item.content_format as ContentFormatKey] || item.content_format).toLocaleUpperCase("tr");
  const metaLines = [`${formatContentPlanDate(item.scheduled_date)}  •  ${formatLabel}`, item.theme || ""].filter(Boolean);

  const sections: DocumentSection[] = [
    {
      title: `${index + 1}. ${(item.content_title || "İçerik").toLocaleUpperCase("tr")}`,
      titleSize: 14,
      spacingBefore: index === 0 ? 0 : 18,
      minSpaceBefore: 90,
      text: metaLines.join("\n")
    }
  ];

  const clientFields = [
    fieldSection("HOOK", parsed.hook),
    parsed.contentFlow ? { title: "İÇERİK AKIŞI", titleSize: FIELD_TITLE_SIZE, text: formatAsNumberedText(parsed.contentFlow) } : null,
    fieldSection("CAPTION", parsed.caption),
    fieldSection("CTA", parsed.cta),
    fieldSection("HASHTAG YAKLAŞIMI", parsed.hashtagApproach),
    fieldSection("AMAÇ", parsed.goal),
    fieldSection("HEDEF KİTLE", parsed.audience),
    bulletFieldSection("STORY DESTEĞİ", parsed.storySupport)
  ].filter((s): s is DocumentSection => Boolean(s));
  sections.push(...clientFields);

  if (mode === "internal") {
    const internalFields = [
      fieldSection("STRATEJİK GEREKÇE", parsed.rationale),
      fieldSection("ÖNCELİK", parsed.priority),
      bulletFieldSection("⚠ KOŞULLAR / DOĞRULANACAK", parsed.conditions),
      bulletFieldSection("ÜRETİM NOTU", parsed.productionNotes)
    ].filter((s): s is DocumentSection => Boolean(s));
    if (internalFields.length) {
      sections.push({ title: "AJANS İÇİ NOTLAR", titleSize: 11, spacingBefore: 8, text: "Bu bölüm yalnızca HK Dijital içindir." });
      sections.push(...internalFields);
    }
  } else if (parsed.conditions) {
    // Never print the raw internal condition/[DOĞRULANACAK] placeholder to
    // a customer as if it were confirmed fact — a small, honest note
    // instead, never silently dropped either.
    sections.push({ title: "UYGULAMA NOTU", titleSize: FIELD_TITLE_SIZE, text: "Bu içerik uygulama öncesi ekibimizce teyit edilecektir." });
  }

  return sections;
}

export function buildContentPlanDocumentPayload(companyName: string, items: ContentPlanItem[], mode: ContentPlanPdfMode): DocumentPayload {
  const sorted = [...items].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const sections: DocumentSection[] = sorted.flatMap((item, index) => itemSections(item, mode, index));
  const period = sorted.length
    ? `${formatContentPlanDate(sorted[0].scheduled_date)} – ${formatContentPlanDate(sorted[sorted.length - 1].scheduled_date)}`
    : "—";

  return {
    title: "Instagram İçerik Planı",
    customerName: companyName,
    period,
    executiveSummary: mode === "customer"
      ? `${companyName} için hazırlanan ${sorted.length} içeriklik Instagram planı.`
      : `${companyName} için iç operasyon üretim detayları (${sorted.length} içerik).`,
    sections,
    confidentialLabel: mode === "internal" ? "Dahili Kullanım" : undefined,
    footerNote: mode === "customer" ? "HK Dijital · hkdijital.com.tr" : "HK Dijital · Dahili Operasyon Belgesi · hkdijital.com.tr",
    metaLines: [`Müşteri: ${companyName}`, `Plan dönemi: ${period}`, `Hazırlanma tarihi: ${new Date().toLocaleDateString("tr-TR")}`],
    logo: true
  };
}
