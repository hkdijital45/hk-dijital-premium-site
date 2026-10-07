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
import { formatReportTimestamp } from "@/lib/report-timestamp";
import { normalizeLegacyTableBlock, parseMarkdownBlocks } from "./ad-evaluation-markdown";

export type AdEvaluationDocumentMode = "internal" | "client";

// Geist-Regular.ttf (the embedded PDF font) has no real glyphs for ✓/☐
// — verified directly: pdf-lib/fontkit reports the SAME advance width
// for ✓, ☐, and the 5 status emoji as for a genuinely unmapped
// codepoint, while "•" (the renderer's own existing bullet prefix) has
// its own distinct, correct width. Claude's prompt asks for ✓/•/☐
// markers (readability instruction), so any leading one of these must
// be stripped here rather than reach the PDF as a broken glyph box —
// the renderer's own reliable "•" bullet prefix (drawBullet) still
// marks every list item either way, so no visual marker is ever lost
// to a blank box, and the real text content is fully preserved.
function stripMarkdown(line: string): string {
  return line.replace(/^\s*[-*•✓☐]\s+/, "").replace(/\*\*/g, "").trim();
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
  // Compound click-metric-family labels must be glossed BEFORE the bare
  // CTR/CPC entries below (ordered first), and the bare entries then
  // skip over them via a negative lookaround — otherwise the generic
  // "CTR"/"CPC" pattern re-matches the word embedded inside "CTR
  // (Tümü)"/"Bağlantı CTR" and double-annotates it.
  // No trailing \b here: "ı" (dotless i) falls outside \w, so a \b
  // immediately after it never matches (both sides end up non-word) —
  // verified live, this silently skipped the whole pattern.
  { pattern: /\bBağlantı Tıklaması/i, gloss: "bağlantıya yapılan tıklama sayısı", label: "Bağlantı Tıklaması (Reklamdaki bağlantıya yapılan tıklama sayısı)" },
  { pattern: /\bCTR \(Tümü\)/i, gloss: "tüm tıklamaların gösterimlere oranı", label: "CTR (Tümü) (Reklamdaki tüm tıklamaların gösterimlere oranı)" },
  { pattern: /\bCPC \(Tümü\)/i, gloss: "tüm tıklamalardan birinin ortalama maliyeti", label: "CPC (Tümü) (Reklamdaki tüm tıklamalardan birinin ortalama maliyeti)" },
  { pattern: /\bBağlantı CTR\b/i, gloss: "bağlantı tıklamalarının gösterimlere oranı", label: "Bağlantı CTR (Reklamdaki bağlantı tıklamalarının gösterimlere oranı)" },
  { pattern: /\bBağlantı CPC\b/i, gloss: "bir bağlantı tıklamasının ortalama maliyeti", label: "Bağlantı CPC (Bir bağlantı tıklamasının ortalama maliyeti)" },
  { pattern: /(?<!\(Tümü\)\s)(?<!Bağlantı )\bCTR\b(?!\s*\(Tümü\))/i, gloss: "bağlantıya tıklayanların oranı", label: "CTR (Reklamı gören kişilerden bağlantıya tıklayanların oranı)" },
  { pattern: /(?<!\(Tümü\)\s)(?<!Bağlantı )\bCPC\b(?!\s*\(Tümü\))/i, gloss: "bağlantı tıklamasının ortalama maliyeti", label: "CPC (Bir bağlantı tıklamasının ortalama maliyeti)" },
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

// "Nihai Karar" is excluded here (internal mode) — buildAdEvaluationDocumentPayload
// appends its OWN structured decision section built from the record's
// real decision/next_review_at/next_review_note fields (more reliable
// than re-parsing Claude's own freeform prose under the same heading,
// which the evaluation prompt also asks Claude to write — producing a
// duplicated "Nihai Karar" section otherwise, proven in the current
// generated reports).
function sectionsFrom(report: EvaluationReportText | undefined, mode: AdEvaluationDocumentMode, createdAt: string | null | undefined): DocumentSection[] {
  if (!report?.sections?.length) return [];
  const out: DocumentSection[] = [];
  for (const s of report.sections) {
    if (!s.title || !s.content) continue;
    if (mode === "internal" && /^nihai karar$/i.test(s.title.trim())) continue;
    const blocks = parseMarkdownBlocks(s.content).flatMap((b) => (b.table ? normalizeLegacyTableBlock(b.table, createdAt) : [b]));
    let first = true;
    for (const block of blocks) {
      const title = first ? s.title : `${s.title} (devam)`;
      if (block.table) {
        out.push({ title, table: block.table });
        first = false;
      } else if (block.text) {
        const items = splitIntoBulletLines(block.text);
        const annotated = mode === "client" ? items.map(annotateClient) : items;
        if (annotated.length) {
          out.push({ title, items: annotated });
          first = false;
        }
      }
    }
  }
  return out;
}

export function buildAdEvaluationDocumentPayload(companyName: string, campaignName: string, evaluation: AdEvaluationRecord, mode: AdEvaluationDocumentMode): DocumentPayload {
  const report = mode === "internal" ? evaluation.internal_report : evaluation.client_report;
  const sections: DocumentSection[] = [];

  // Claude's own evaluation prompt asks it to write "Yönetici Özeti"
  // (internal) / "Kısa Özet" (client) as its OWN first "## " section —
  // so report.sections (parsed below) already contains one. The
  // preamble text before Claude's first heading (report.executiveSummary)
  // is only ever a SEPARATE, synthesized duplicate of that same summary
  // when both happen to be present — proven live (production PDF showed
  // "Yönetici Özeti" rendered twice). Only synthesize this section when
  // Claude's own structured section is genuinely absent, so real content
  // is never dropped but never duplicated either.
  const parsedSections = sectionsFrom(report, mode, evaluation.created_at);
  const summaryTitle = mode === "internal" ? "yönetici özeti" : "kısa özet";
  const hasOwnSummarySection = parsedSections.some((s) => s.title.trim().toLocaleLowerCase("tr") === summaryTitle);

  const summary = report?.executiveSummary;
  if (summary && !hasOwnSummarySection) {
    const items = splitIntoBulletLines(summary);
    sections.push({ title: mode === "internal" ? "Yönetici Özeti" : "Kısa Özet", items: mode === "client" ? items.map(annotateClient) : items });
  }

  sections.push(...parsedSections);

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
      `Rapor Tarihi ve Saati: ${formatReportTimestamp(evaluation.created_at)}`,
      // Son Veri Senkronizasyonu is a DIFFERENT timestamp from the report
      // generation time above (section 10) — when this evaluation's
      // underlying Meta metrics snapshot was actually read (metrics_snapshot.
      // syncedAt, already stored by buildMetricsSnapshot — no new DB field).
      // Omitted entirely rather than guessed when genuinely unavailable.
      ...(typeof (evaluation.metrics_snapshot as { syncedAt?: unknown })?.syncedAt === "string"
        ? [`Son Veri Senkronizasyonu: ${formatReportTimestamp((evaluation.metrics_snapshot as { syncedAt: string }).syncedAt)}`]
        : []),
      `İncelenen dönem: ${periodLabel}`
    ],
    footerNote: mode === "internal" ? "HK Dijital · Dahili Operasyon Belgesi · hkdijital.com.tr" : "HK Dijital · hkdijital.com.tr",
    logo: true
  };
}
