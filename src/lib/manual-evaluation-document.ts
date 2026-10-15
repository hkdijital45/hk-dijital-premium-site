import "server-only";

import type { DocumentPayload, DocumentSection, DocumentMetric, DocumentChart } from "@/lib/server/document-generator";
import { formatNumberTr } from "@/lib/report-design";
import { MODULE_FIELD_GROUPS, MODULE_LABELS, type ManualEvaluationRecord } from "@/lib/manual-evaluations-shared";

export type ManualEvaluationDocumentMode = "internal" | "client";

// Internal report: every field + formula + source, for HK Dijital's own
// use. Client report: a shorter, non-technical read — field labels and
// values only, derived metrics without the raw formula column, no
// "Kaynak"/"Durum" bookkeeping rows a customer doesn't need to see.
export function buildManualEvaluationDocumentPayload(targetName: string, evaluation: ManualEvaluationRecord, mode: ManualEvaluationDocumentMode): DocumentPayload {
  const groups = MODULE_FIELD_GROUPS[evaluation.module];
  const sections: DocumentSection[] = [];

  for (const group of groups) {
    const rows = group.fields
      .map((field) => {
        const raw = evaluation.data[field.key];
        if (raw === undefined || raw === null || raw === "") return null;
        // Turkish number formatting for numeric entries (3120 -> 3.120); text stays as typed.
        const numeric = typeof raw === "number" || (typeof raw === "string" && /^-?\d+([.,]\d+)?$/.test(raw.trim()) && !/^0\d/.test(raw.trim()));
        const shown = numeric ? formatNumberTr(Number(String(raw).replace(",", "."))) : String(raw);
        const value = field.unit ? `${shown} ${field.unit}` : shown;
        return [field.label, value];
      })
      .filter((row): row is [string, string] => row !== null);
    if (rows.length === 0) continue;
    sections.push({ title: group.title, table: { headers: ["Alan", "Değer"], rows } });
  }

  const metricEntries = Object.values(evaluation.derived_metrics || {});
  // Premium V3: the computed metrics as KPI cards (values come from
  // derived_metrics, which the server recomputes from real input on save).
  const headlineMetrics: DocumentMetric[] = metricEntries
    .filter((m) => typeof m.value === "number" && Number.isFinite(m.value))
    .slice(0, 8)
    .map((m) => ({ label: m.label, value: `${m.unit === "%" ? "%" : ""}${formatNumberTr(m.value)}${m.unit && m.unit !== "%" ? ` ${m.unit}` : ""}` }));

  // Instagram: content-format mix, only from counts that were actually entered.
  const charts: DocumentChart[] = [];
  if (evaluation.module === "instagram") {
    const count = (key: string) => {
      const raw = evaluation.data[key];
      if (raw === undefined || raw === null || raw === "") return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    const mix = [["Reels", count("reelsCount")], ["Karusel", count("carouselCount")], ["Tek Görsel", count("staticPostCount")], ["Hikâye", count("storyCount")]] as const;
    charts.push({ type: "donut", title: "İçerik Formatı Dağılımı", data: mix.map(([label, value]) => ({ label, value })), caption: "İncelenen dönemde paylaşılan içeriklerin formatlara dağılımı (girilen sayılara göre)." });
  }
  if (charts.length) sections.unshift({ title: "İçerik Karması", charts });

  if (metricEntries.length > 0) {
    sections.push({
      title: "Hesaplanan Metrikler",
      table: {
        headers: mode === "internal" ? ["Metrik", "Değer", "Formül"] : ["Metrik", "Değer"],
        rows: metricEntries.map((m) =>
          mode === "internal"
            ? [m.label, `${m.value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${m.unit}`, m.formula]
            : [m.label, `${m.value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${m.unit}`]
        )
      }
    });
  }

  if (mode === "internal") {
    sections.push({
      title: "Veri Güvenilirliği",
      table: {
        headers: ["Alan", "Değer"],
        rows: [
          ["Kaynak", evaluation.source === "claude_import" ? "Claude Yorumu (Doğrulama Gerekir)" : "Manuel Girilen"],
          ["Durum", evaluation.status === "submitted" ? "Tamamlandı" : "Taslak"],
          ["Oluşturulma", new Date(evaluation.created_at).toLocaleString("tr-TR")]
        ]
      }
    });
    if (evaluation.notes) sections.push({ title: "Notlar", text: evaluation.notes });
    if (evaluation.claude_import?.text) sections.push({ title: "Claude Analizi (Orijinal Metin)", text: evaluation.claude_import.text });
  }

  return {
    title: `${MODULE_LABELS[evaluation.module]} — ${mode === "internal" ? "Dahili Rapor" : "Müşteri Raporu"}`,
    customerName: targetName,
    period: evaluation.data.analysisStartDate && evaluation.data.analysisEndDate ? `${evaluation.data.analysisStartDate} – ${evaluation.data.analysisEndDate}` : new Date(evaluation.created_at).toLocaleDateString("tr-TR"),
    executiveSummary: evaluation.title || `${MODULE_LABELS[evaluation.module]} değerlendirmesi.`,
    headlineMetrics,
    sections,
    logo: true,
    confidentialLabel: mode === "internal" ? "DAHİLİ KULLANIM" : undefined
  };
}
