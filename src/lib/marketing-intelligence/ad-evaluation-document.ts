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
import type { DocumentPayload, DocumentSection, DocumentTable } from "@/lib/server/document-generator";

export type AdEvaluationDocumentMode = "internal" | "client";

function stripMarkdown(line: string): string {
  return line.replace(/^\s*[-*•]\s+/, "").replace(/\*\*/g, "").trim();
}

// A Markdown table separator row: |---|---|, | :--- | ---: |, etc.
function isMarkdownTableSeparatorRow(line: string): boolean {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(line);
}

// Türkiye (tr-TR) readable "DD.MM.YYYY HH:mm" — never the raw UTC ISO
// string, never seconds. evaluation.created_at is the ONE canonical
// generation timestamp this entire evaluation already has (set once by
// the DB on INSERT, never regenerated) — every one of the 4 exported
// files (internal/client × PDF/DOCX) derives its displayed report time
// from this same source, so they can never drift from one another or
// from a fresh `new Date()` call made independently per renderer.
function formatReportTimestamp(iso: string | null | undefined): string {
  if (!iso) return "Bilinmiyor";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Bilinmiyor";
  return `${d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
}

function splitMarkdownRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim().replace(/\*\*/g, ""));
}

type ContentBlock = { text?: string; table?: DocumentTable };

/** Splits one section's raw Claude markdown content into an ordered list
 * of plain-text blocks and real Markdown tables — the actual fix for
 * section 14/15's critical bug: a literal "| Metrik | ... |" / "|---|---|"
 * string must NEVER reach the PDF/DOCX as text. Claude's evaluation
 * prompt (ad-evaluation-prompt.ts) requires a pipe-table for Ana
 * Metrikler/Reklam Seti/Kreatif/Strateji sections; this recognizes any
 * such table anywhere in a section's content (a header row immediately
 * followed by a separator row) and extracts it as a real DocumentTable,
 * which the canonical document-generator.ts already knows how to render
 * as a genuine PDF/DOCX table (drawTable/buildDocxTable) — never a
 * second, parallel table renderer. A section can contain more than one
 * table (e.g. a wide creative table deliberately split in two, per
 * section 16) — each is extracted in order. */
function parseMarkdownBlocks(content: string): ContentBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: ContentBlock[] = [];
  let buffer: string[] = [];
  const flushText = () => {
    const text = buffer.join("\n").trim();
    if (text) blocks.push({ text });
    buffer = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];
    if (line.includes("|") && next !== undefined && isMarkdownTableSeparatorRow(next)) {
      flushText();
      const headers = splitMarkdownRow(line);
      let j = i + 2;
      const rows: string[][] = [];
      while (j < lines.length && lines[j].includes("|") && lines[j].trim()) {
        rows.push(splitMarkdownRow(lines[j]));
        j++;
      }
      blocks.push({ table: { headers, rows } });
      i = j;
      continue;
    }
    buffer.push(line);
    i++;
  }
  flushText();
  return blocks;
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
function sectionsFrom(report: EvaluationReportText | undefined, mode: AdEvaluationDocumentMode): DocumentSection[] {
  if (!report?.sections?.length) return [];
  const out: DocumentSection[] = [];
  for (const s of report.sections) {
    if (!s.title || !s.content) continue;
    if (mode === "internal" && /^nihai karar$/i.test(s.title.trim())) continue;
    const blocks = parseMarkdownBlocks(s.content);
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
