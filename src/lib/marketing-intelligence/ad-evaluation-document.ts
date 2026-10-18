// Builds the DocumentPayload (server/document-generator.ts — the same
// canonical, Turkish-glyph-safe, HK Dijital-branded PDF/DOCX engine every
// export in the app already goes through) for a Reklam Değerlendirme —
// Dahili Rapor or Müşteri Raporu. Same readability conventions already
// proven for Reklam Kreatif Raporu (ad-creative-report-document.ts):
// strip any literal Markdown Claude's paste-back carries, split long
// blobs into real bullets, and explain the technical metric terms the
// report uses in a closing glossary — client report only.
import type { AdEvaluationRecord, EvaluationReportText } from "./ad-evaluations";
import { AD_EVALUATION_DECISION_LABELS } from "./ad-evaluations";
import type { DocumentPayload, DocumentSection, DocumentMetric, DocumentChart } from "@/lib/server/document-generator";
import { formatCurrencyTr, formatNumberTr, formatPercentTr } from "@/lib/report-design";
import { formatReportDate } from "@/lib/report-timestamp";
import { normalizeLegacyTableBlock, parseMarkdownBlocks } from "./ad-evaluation-markdown";
import { AD_METRIC_GLOSSARY, buildGlossarySection } from "@/lib/report-glossary";

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

// Technical terms are explained in a separate "Terimler Sözlüğü" section
// (client report only, see report-glossary.ts) — never spliced into the
// running text, which broke Turkish suffixes ("Harcanan Tutar (…)ın").

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
    const blocks = parseMarkdownBlocks(s.content).flatMap((b) => (b.table ? normalizeLegacyTableBlock(b.table, createdAt, true) : [b]));
    let first = true;
    for (const block of blocks) {
      const title = first ? s.title : `${s.title} (devam)`;
      if (block.table) {
        out.push({ title, table: block.table });
        first = false;
      } else if (block.text) {
        const items = splitIntoBulletLines(block.text);
        if (items.length) {
          out.push({ title, items });
          first = false;
        }
      }
    }
  }
  return out;
}

type SnapshotEntity = { name?: string; spend?: number | null; results?: number | null };

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Premium Report V3: KPI cards + comparison charts drawn ONLY from the
 * frozen metrics_snapshot stored with this evaluation (real synced Meta
 * data at generation time). A metric that is null/absent is omitted —
 * never shown as 0. Exported for unit tests. */
export function adEvaluationPerformanceSection(snapshot: Record<string, unknown> | null | undefined): DocumentSection | null {
  const campaign = (snapshot?.campaign || null) as Record<string, unknown> | null;
  if (!campaign) return null;
  const metrics: DocumentMetric[] = [];
  const add = (label: string, raw: unknown, format: (n: number) => string, note?: string) => {
    const n = finite(raw);
    if (n !== null) metrics.push({ label, value: format(n), note });
  };
  add("Harcanan Tutar", campaign.spend, formatCurrencyTr);
  add("Erişim", campaign.reach, (n) => formatNumberTr(n, 0), "Reklamı gören farklı kişi");
  add("Gösterim", campaign.impressions, (n) => formatNumberTr(n, 0));
  add("Bağlantı Tıklaması", campaign.linkClicks ?? campaign.clicks, (n) => formatNumberTr(n, 0));
  add("Bağlantı CTR", campaign.linkCtr, (n) => formatPercentTr(n, 2), "Tıklayanların gösterime oranı");
  add("Bağlantı CPC", campaign.linkCpc, formatCurrencyTr, "Tıklama başına ortalama maliyet");
  add("Sonuç", campaign.results, (n) => formatNumberTr(n, 0));
  add("Sonuç Başına Maliyet", campaign.costPerResult, formatCurrencyTr);
  add("Frekans", campaign.frequency, (n) => formatNumberTr(n, 2), "Kişi başı ortalama görüntülenme");

  const charts: DocumentChart[] = [];
  const ads = Array.isArray(snapshot?.ads) ? (snapshot!.ads as SnapshotEntity[]) : [];
  const adsets = Array.isArray(snapshot?.adsets) ? (snapshot!.adsets as SnapshotEntity[]) : [];
  const bySpend = (list: SnapshotEntity[]) => [...list].filter((e) => finite(e.spend) !== null).sort((a, b) => Number(b.spend) - Number(a.spend));
  if (ads.length >= 2) {
    charts.push({ type: "hbar", title: "Reklam Bazında Harcama", valueFormat: "currency", data: bySpend(ads).map((a) => ({ label: a.name || "Adsız reklam", value: finite(a.spend) })), caption: "Bütçenin hangi reklamlarda yoğunlaştığını gösterir; yüksek harcama tek başına başarı anlamına gelmez, sonuçlarla birlikte okunmalıdır." });
    const withResults = ads.filter((a) => finite(a.results) !== null);
    if (withResults.length >= 2) charts.push({ type: "hbar", title: "Reklam Bazında Sonuç", data: withResults.sort((a, b) => Number(b.results) - Number(a.results)).map((a) => ({ label: a.name || "Adsız reklam", value: finite(a.results) })), caption: "Meta'nın kampanya hedefine göre saydığı sonuçlar (ör. başlatılan mesajlaşma)." });
  }
  if (adsets.length >= 2) charts.push({ type: "donut", title: "Reklam Setlerine Göre Harcama Dağılımı", valueFormat: "currency", data: bySpend(adsets).map((a) => ({ label: a.name || "Adsız reklam seti", value: finite(a.spend) })), caption: "Toplam harcamanın reklam setlerine dağılımı." });

  if (!metrics.length && !charts.length) return null;
  return {
    title: "Kampanya Performansı",
    intro: "Bu bölümdeki rakamlar, değerlendirme hazırlanırken Meta'dan senkronize edilen gerçek kampanya verileridir; tahmin içermez.",
    metrics,
    charts
  };
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
    sections.push({ title: mode === "internal" ? "Yönetici Özeti" : "Kısa Özet", items });
  }

  const performance = adEvaluationPerformanceSection(evaluation.metrics_snapshot);
  if (performance) sections.unshift(performance);

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

  if (mode === "client") {
    const glossary = buildGlossarySection(sections, AD_METRIC_GLOSSARY);
    if (glossary) sections.push(glossary);
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
      `Rapor Tarihi: ${formatReportDate(evaluation.created_at)}`,
      // Son Veri Senkronizasyonu is a DIFFERENT timestamp from the report
      // generation time above (section 10) — when this evaluation's
      // underlying Meta metrics snapshot was actually read (metrics_snapshot.
      // syncedAt, already stored by buildMetricsSnapshot — no new DB field).
      // Omitted entirely rather than guessed when genuinely unavailable.
      // Exported documents show date-only (no time-of-day) throughout.
      ...(typeof (evaluation.metrics_snapshot as { syncedAt?: unknown })?.syncedAt === "string"
        ? [`Son Veri Senkronizasyonu: ${formatReportDate((evaluation.metrics_snapshot as { syncedAt: string }).syncedAt)}`]
        : []),
      `İncelenen dönem: ${periodLabel}`
    ],
    footerNote: mode === "internal" ? "HK Dijital · Dahili Operasyon Belgesi · hkdijital.com.tr" : "HK Dijital · hkdijital.com.tr",
    logo: true
  };
}
