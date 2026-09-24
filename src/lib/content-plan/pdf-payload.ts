// Builds the DocumentPayload (see server/document-generator.ts's
// generatePdfBuffer — the one canonical, Turkish-glyph-safe, HK Dijital-
// branded PDF engine every export in the app already goes through) for
// an İçerik Takip content plan — either a client-facing "Müşteri PDF" or
// an internal-only "İç Operasyon PDF". Pure/no I/O — easy to unit test
// without generating an actual PDF binary.
import { parseContentPlanNotes } from "./notes-parser";
import { CONTENT_FORMAT_LABELS, type ContentFormatKey, type ContentPlanItem } from "./types";
import type { DocumentPayload, DocumentSection } from "@/lib/server/document-generator";

export type ContentPlanPdfMode = "customer" | "internal";

export function formatContentPlanDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function itemSectionText(item: ContentPlanItem, mode: ContentPlanPdfMode): string {
  const parsed = parseContentPlanNotes(item.notes);
  const lines: string[] = [];
  lines.push(`Tarih: ${formatContentPlanDate(item.scheduled_date)}`);
  lines.push(`Format: ${CONTENT_FORMAT_LABELS[item.content_format as ContentFormatKey] || item.content_format}`);
  if (item.theme) lines.push(`Tema: ${item.theme}`);
  if (parsed.hook) lines.push(`Hook: ${parsed.hook}`);
  if (parsed.contentFlow) lines.push(`İçerik Akışı: ${parsed.contentFlow}`);
  if (parsed.caption) lines.push(`Caption: ${parsed.caption}`);
  if (parsed.cta) lines.push(`CTA: ${parsed.cta}`);
  if (parsed.hashtagApproach) lines.push(`Hashtag Yaklaşımı: ${parsed.hashtagApproach}`);
  if (parsed.goal) lines.push(`Amaç: ${parsed.goal}`);
  if (parsed.audience) lines.push(`Hedef Kitle: ${parsed.audience}`);
  if (parsed.storySupport) lines.push(`Story Desteği: ${parsed.storySupport}`);

  if (mode === "internal") {
    if (parsed.rationale) lines.push(`Gerekçe: ${parsed.rationale}`);
    if (parsed.priority) lines.push(`Öncelik: ${parsed.priority}`);
    if (parsed.conditions) lines.push(`Koşullar / Doğrulanacak: ${parsed.conditions}`);
    if (parsed.productionNotes) lines.push(`Üretim Notu: ${parsed.productionNotes}`);
  } else if (parsed.conditions) {
    // Never print the raw internal condition/[DOĞRULANACAK] placeholder to
    // a customer as if it were confirmed fact — a neutral, honest note
    // instead, never silently dropped either.
    lines.push("Not: Bu içerik uygulama öncesi ekibimizce teyit edilecektir.");
  }
  return lines.join("\n");
}

export function buildContentPlanDocumentPayload(companyName: string, items: ContentPlanItem[], mode: ContentPlanPdfMode): DocumentPayload {
  const sorted = [...items].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const sections: DocumentSection[] = sorted.map((item, index) => ({
    title: `${index + 1}. ${item.content_title || "İçerik"}`,
    text: itemSectionText(item, mode)
  }));
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
