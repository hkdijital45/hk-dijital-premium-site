// Document builders for stored analyses that had no PDF/Word export yet
// (Aday Değerlendirmesi, Instagram Profil Analizi, Aylık Rapor, Analiz
// Merkezi özeti). They only reformat what is already stored on the row —
// nothing is calculated, estimated or invented; empty fields are omitted.
import "server-only";

import type { DocumentMetric, DocumentPayload, DocumentSection } from "@/lib/document-model";
import type { CandidateEvaluationReport } from "@/lib/candidate-evaluation/types";
import type { InstagramProfileAudit } from "@/lib/instagram-profile-audits";
import { structuredValueSections } from "@/lib/pre-audit/document";
import { formatDateTr } from "@/lib/report-design";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean) : [];
}

function push(sections: DocumentSection[], title: string, value: unknown) {
  sections.push(...structuredValueSections(title, value));
}

export function buildCandidateEvaluationDocumentPayload(report: CandidateEvaluationReport, displayName: string): DocumentPayload {
  const sections: DocumentSection[] = [];
  const strengths = list(report.strengths);
  const weaknesses = list(report.weaknesses);
  const opportunities = list(report.digital_opportunities);
  if (strengths.length) sections.push({ title: "Güçlü Yönler", items: strengths });
  if (weaknesses.length) sections.push({ title: "Zayıf Yönler", items: weaknesses });
  if (opportunities.length) sections.push({ title: "Dijital Fırsatlar", items: opportunities });
  if (text(report.suggested_next_action)) sections.push({ title: "Önerilen Sonraki Adım", text: text(report.suggested_next_action) });
  if (text(report.report_content)) sections.push({ title: "Değerlendirme", text: text(report.report_content) });
  push(sections, "Kaynaklar", report.sources);

  const metrics: DocumentMetric[] = [];
  if (typeof report.score === "number" && Number.isFinite(report.score)) metrics.push({ label: "Uygunluk Puanı", value: `${report.score}/100` });
  if (text(report.recommendation)) metrics.push({ label: "Öneri", value: text(report.recommendation) });
  if (text(report.priority)) metrics.push({ label: "Öncelik", value: text(report.priority) });

  return {
    title: "Aday Değerlendirme Raporu — Dahili Kullanım",
    customerName: displayName,
    period: formatDateTr(report.report_date) || "-",
    executiveSummary: "",
    headlineMetrics: metrics,
    sections,
    confidentialLabel: "Dahili Kullanım",
    metaLines: [`Firma: ${displayName}`, `Rapor Tarihi: ${formatDateTr(report.report_date) || "-"}`, `Rapor Türü: Müşteri Adayı Değerlendirmesi`],
    logo: true
  };
}

const AUDIT_FIELDS: Array<[keyof InstagramProfileAudit, string]> = [
  ["profile_photo_analysis", "Profil Fotoğrafı"],
  ["username_analysis", "Kullanıcı Adı"],
  ["name_field_analysis", "Ad Alanı"],
  ["link_cta_analysis", "Bağlantı ve Eylem Çağrısı"],
  ["highlights_analysis", "Öne Çıkanlar"],
  ["pinned_posts_analysis", "Sabitlenmiş Gönderiler"],
  ["profile_visual_analysis", "Profil Görsel Bütünlüğü"],
  ["trust_contact_analysis", "Güven ve İletişim"],
  ["priorities", "Öncelikler"],
  ["checklist", "Kontrol Listesi"]
];

export function buildInstagramProfileAuditDocumentPayload(audit: InstagramProfileAudit, companyName: string): DocumentPayload {
  const sections: DocumentSection[] = [];
  const username = String(audit.instagram_username || "").replace(/^@/, "");
  if (text(audit.current_bio)) sections.push({ title: "Mevcut Biyografi", text: text(audit.current_bio) });
  if (text(audit.recommended_bio)) sections.push({ title: "Önerilen Biyografi", text: text(audit.recommended_bio) });
  for (const [field, label] of AUDIT_FIELDS) push(sections, label, audit[field]);
  return {
    title: "Instagram Profil Analizi",
    customerName: companyName,
    period: formatDateTr(audit.audit_date) || "-",
    executiveSummary: text(audit.overall_summary),
    sections,
    metaLines: [`Firma: ${companyName}`, `Instagram: @${username || "-"}`, `Analiz Tarihi: ${formatDateTr(audit.audit_date) || "-"}`],
    logo: true
  };
}

type MonthlyReportRow = {
  report_month?: string | null; summary?: string | null; meta_metrics?: unknown; google_metrics?: unknown; social_metrics?: unknown;
  ai_interpretation?: string | null; next_month_recommendations?: string | null; status?: string | null; created_at?: string | null;
};

export function buildMonthlyReportDocumentPayload(report: MonthlyReportRow, companyName: string): DocumentPayload {
  const sections: DocumentSection[] = [];
  push(sections, "Meta Reklam Metrikleri", report.meta_metrics);
  push(sections, "Google Reklam Metrikleri", report.google_metrics);
  push(sections, "Sosyal Medya Metrikleri", report.social_metrics);
  if (text(report.ai_interpretation)) sections.push({ title: "Değerlendirme", text: text(report.ai_interpretation) });
  if (text(report.next_month_recommendations)) sections.push({ title: "Gelecek Ay Önerileri", text: text(report.next_month_recommendations) });
  return {
    title: "Aylık Rapor",
    customerName: companyName,
    period: report.report_month || "-",
    executiveSummary: text(report.summary),
    sections,
    metaLines: [`Müşteri: ${companyName}`, `Dönem: ${report.report_month || "-"}`, `Oluşturulma: ${formatDateTr(report.created_at) || "-"}`],
    logo: true
  };
}

type AnalyticsReportRow = { title?: string | null; period_start?: string | null; period_end?: string | null; created_at?: string | null; summary?: unknown };

/** On-screen summary for an Analiz Merkezi report — the full document is
 * the stored PDF (served as-is for preview/download). */
export function buildAnalyticsReportSummaryPayload(report: AnalyticsReportRow, companyName: string): DocumentPayload {
  const sections: DocumentSection[] = [];
  push(sections, "Rapor Özeti", report.summary);
  const period = report.period_start && report.period_end ? `${formatDateTr(report.period_start)} – ${formatDateTr(report.period_end)}` : "-";
  return {
    title: report.title || "Analiz Raporu",
    customerName: companyName,
    period,
    executiveSummary: "",
    sections,
    metaLines: [`Müşteri: ${companyName}`, `Dönem: ${period}`, `Oluşturulma: ${formatDateTr(report.created_at) || "-"}`],
    logo: true
  };
}
