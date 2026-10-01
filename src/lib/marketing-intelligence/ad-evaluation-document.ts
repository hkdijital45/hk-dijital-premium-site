// Builds the DocumentPayload (server/document-generator.ts — the same
// canonical, Turkish-glyph-safe, HK Dijital-branded PDF/DOCX engine every
// export in the app already goes through) for a Reklam Değerlendirme —
// Dahili Rapor or Müşteri Raporu. Same readability conventions already
// proven for Reklam Kreatif Raporu (ad-creative-report-document.ts):
// strip any literal Markdown Claude's paste-back carries, split long
// blobs into real bullets, and explain every technical metric term in
// parentheses — client report only, per section 10's exact wording list.
import type { AdEvaluationRecord, EvaluationReportText } from "./ad-evaluations";
import { AD_EVALUATION_DECISION_LABELS } from "./ad-evaluations";
import type { DocumentPayload, DocumentSection } from "@/lib/server/document-generator";

export type AdEvaluationDocumentMode = "internal" | "client";

function stripMarkdown(line: string): string {
  return line.replace(/^\s*[-*•]\s+/, "").replace(/\*\*/g, "").trim();
}

function splitIntoBulletLines(text?: string | null): string[] {
  if (!text) return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  const byNewline = trimmed.split(/\n+/).map((l) => stripMarkdown(l)).filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  const bySentence = trimmed.split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9])/).map((l) => stripMarkdown(l)).filter(Boolean);
  if (bySentence.length > 1 && bySentence.every((s) => s.length >= 3)) return bySentence;
  return [stripMarkdown(trimmed)];
}

// Exact wording required by the spec — client report only. Each gloss is
// checked case-insensitively against text already containing the
// explanation (idempotent — never double-wrap a term Claude already
// explained itself).
const CLIENT_GLOSSARY: Array<{ pattern: RegExp; gloss: string; label: string }> = [
  { pattern: /\bErişim\b/i, gloss: "en az bir kez gören farklı kişi sayısı", label: "Erişim (Reklamı en az bir kez gören farklı kişi sayısı)" },
  { pattern: /\bGösterim\b/i, gloss: "toplam kaç kez görüntülendiği", label: "Gösterim (Reklamın toplam kaç kez görüntülendiği)" },
  { pattern: /\bFrekans\b/i, gloss: "ortalama kaç kez gördüğü", label: "Frekans (Bir kişinin reklamı ortalama kaç kez gördüğü)" },
  { pattern: /\bCTR\b/i, gloss: "bağlantıya tıklayanların oranı", label: "CTR (Reklamı gören kişilerden bağlantıya tıklayanların oranı)" },
  { pattern: /\bCPC\b/i, gloss: "bağlantı tıklamasının ortalama maliyeti", label: "CPC (Bir bağlantı tıklamasının ortalama maliyeti)" },
  { pattern: /\bCPM\b/i, gloss: "1.000 gösterim başına ortalama maliyeti", label: "CPM (Reklamın 1.000 gösterim başına ortalama maliyeti)" },
  { pattern: /\bMesajlaşma konuşması başlatıldı\b/i, gloss: "yeni konuşma başlatan kişi sayısı", label: "Mesajlaşma konuşması başlatıldı (Reklam üzerinden işletmeyle yeni konuşma başlatan kişi sayısı)" },
  { pattern: /\bSonuç başı maliyet\b/i, gloss: "ortalama harcanan tutar", label: "Sonuç başı maliyet (Bir mesaj veya kampanyanın ana sonucunu elde etmek için ortalama harcanan tutar)" },
  { pattern: /\bHarcanan Tutar\b/i, gloss: "kullanılan toplam bütçe", label: "Harcanan Tutar (İncelenen dönemde reklam için kullanılan toplam bütçe)" },
  { pattern: /\bThruPlay\b/i, gloss: "en az 15 saniye", label: "ThruPlay (Videonun en az 15 saniyesinin veya kısa videonun tamamının izlenmesi)" }
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function annotateClient(text: string): string {
  let out = text;
  for (const { pattern, gloss, label } of CLIENT_GLOSSARY) {
    if (new RegExp(escapeRegExp(gloss), "i").test(out)) continue;
    out = out.replace(pattern, label);
  }
  return out;
}

function sectionsFrom(report: EvaluationReportText | undefined, mode: AdEvaluationDocumentMode): DocumentSection[] {
  if (!report?.sections?.length) return [];
  return report.sections
    .filter((s) => s.title && s.content)
    .map((s) => {
      const items = splitIntoBulletLines(s.content);
      return { title: s.title, items: mode === "client" ? items.map(annotateClient) : items };
    })
    .filter((s) => s.items.length);
}

export function buildAdEvaluationDocumentPayload(companyName: string, campaignName: string, evaluation: AdEvaluationRecord, mode: AdEvaluationDocumentMode): DocumentPayload {
  const report = mode === "internal" ? evaluation.internal_report : evaluation.client_report;
  const sections: DocumentSection[] = [];

  const summary = report?.executiveSummary;
  if (summary) {
    const items = splitIntoBulletLines(summary);
    sections.push({ title: "Yönetici Özeti", items: mode === "client" ? items.map(annotateClient) : items });
  }

  sections.push(...sectionsFrom(report, mode));

  if (mode === "internal" && evaluation.decision) {
    sections.push({
      title: "Nihai Karar", titleSize: 13, spacingBefore: 10,
      items: [
        `Karar: ${AD_EVALUATION_DECISION_LABELS[evaluation.decision] || evaluation.decision}`,
        ...(evaluation.next_review_at ? [`Sonraki kontrol: ${new Date(evaluation.next_review_at).toLocaleDateString("tr-TR")}`] : []),
        ...(evaluation.next_review_note ? [`Not: ${evaluation.next_review_note}`] : [])
      ]
    });
  }

  const periodLabel = evaluation.evaluation_period_start && evaluation.evaluation_period_end
    ? `${evaluation.evaluation_period_start} → ${evaluation.evaluation_period_end}`
    : "Belirtilmedi";

  return {
    title: mode === "internal" ? "Reklam Değerlendirme Raporu — Dahili Kullanım" : "Reklam Performans Raporu",
    customerName: companyName,
    period: periodLabel,
    executiveSummary: "",
    sections,
    confidentialLabel: mode === "internal" ? "Dahili Kullanım" : undefined,
    metaLines: [
      `Müşteri: ${companyName}`,
      `Kampanya: ${campaignName || "-"}`,
      `Rapor tarihi: ${new Date(evaluation.created_at).toLocaleDateString("tr-TR")}`,
      `İncelenen dönem: ${periodLabel}`
    ],
    footerNote: mode === "internal" ? "HK Dijital · Dahili Operasyon Belgesi · hkdijital.com.tr" : "HK Dijital · hkdijital.com.tr",
    logo: true
  };
}
