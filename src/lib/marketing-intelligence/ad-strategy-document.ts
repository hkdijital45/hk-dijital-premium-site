// Builds the DocumentPayload (see server/document-generator.ts's
// generatePdfBuffer/generateDocxBuffer — the one canonical, Turkish-
// glyph-safe, HK Dijital-branded export engine every export in the app
// already goes through) for a single ad_strategies record — either the
// internal operations version or the client-facing version. Always built
// from the record passed in (the caller is responsible for reading the
// latest saved row first) — never from stale/cached data. Pure/no I/O.
import { AD_STRATEGY_STATUS_LABELS, type AdStrategyRecord, type AdStrategyReport } from "./ad-strategies";
import type { DocumentPayload, DocumentSection, DocumentTable } from "@/lib/server/document-generator";

export type AdStrategyDocumentMode = "internal" | "client";

function reportSections(report: AdStrategyReport | null | undefined): DocumentSection[] {
  if (!report?.sections?.length) return [];
  return report.sections.filter((s) => s.title && s.content).map((s) => ({ title: s.title, text: s.content }));
}

function campaignSequenceTable(strategy: AdStrategyRecord, mode: AdStrategyDocumentMode): DocumentTable | null {
  if (!strategy.campaign_sequence?.length) return null;
  const headers = mode === "internal"
    ? ["Sıra", "Kampanya", "Objective", "Conversion Location", "Günlük Bütçe", "Geçiş Şartı"]
    : ["Sıra", "Kampanya", "Amaç", "Günlük Bütçe"];
  const rows = [...strategy.campaign_sequence].sort((a, b) => (a.order || 0) - (b.order || 0)).map((c) => {
    const budget = c.dailyBudget ? `${c.dailyBudget.toLocaleString("tr-TR")} TL` : "—";
    return mode === "internal"
      ? [String(c.order ?? "—"), c.name || "—", c.objective || "—", c.conversionLocation || "—", budget, c.transitionCondition || "—"]
      : [String(c.order ?? "—"), c.name || "—", c.purpose || c.objective || "—", budget];
  });
  return { headers, rows };
}

function budgetLines(strategy: AdStrategyRecord): string[] {
  const lines: string[] = [];
  if (strategy.monthly_ad_budget) lines.push(`Aylık toplam reklam bütçesi: ${strategy.monthly_ad_budget.toLocaleString("tr-TR")} TL`);
  if (strategy.meta_budget) lines.push(`Meta bütçesi: ${strategy.meta_budget.toLocaleString("tr-TR")} TL`);
  if (strategy.google_budget) lines.push(`Google Ads bütçesi: ${strategy.google_budget.toLocaleString("tr-TR")} TL`);
  if (strategy.daily_budget_estimate) lines.push(`Günlük tahmini bütçe: ${strategy.daily_budget_estimate.toLocaleString("tr-TR")} TL`);
  return lines;
}

export function buildAdStrategyDocumentPayload(companyName: string, strategy: AdStrategyRecord, mode: AdStrategyDocumentMode): DocumentPayload {
  const report = mode === "internal" ? strategy.internal_report : strategy.client_report;
  const sections: DocumentSection[] = [];

  const overview: string[] = [];
  if (strategy.primary_platform) overview.push(`Platform: ${strategy.primary_platform}`);
  if (strategy.primary_goal) overview.push(`Ana Hedef: ${strategy.primary_goal}`);
  overview.push(...budgetLines(strategy));
  if (strategy.primary_kpi) overview.push(`Ana KPI: ${strategy.primary_kpi}`);
  if (overview.length) sections.push({ title: "Genel Bakış", text: overview.join("\n") });

  const campaignTable = campaignSequenceTable(strategy, mode);
  if (campaignTable) sections.push({ title: "Reklam Açılış Sırası", table: campaignTable });

  if (strategy.remarketing?.condition || strategy.remarketing?.status) {
    const remarketingStatusLabel: Record<string, string> = { not_ready: "Hazır Değil", ready: "Hazır", active: "Aktif" };
    const lines = [
      strategy.remarketing.status ? `Durum: ${remarketingStatusLabel[strategy.remarketing.status] || strategy.remarketing.status}` : "",
      strategy.remarketing.condition ? `Başlatma Şartı: ${strategy.remarketing.condition}` : ""
    ].filter(Boolean);
    if (lines.length) sections.push({ title: "Remarketing", text: lines.join("\n") });
  }

  sections.push(...reportSections(report));

  return {
    title: mode === "internal" ? "Reklam Stratejisi — Dahili Rapor" : "Reklam Stratejisi — Müşteri Raporu",
    customerName: companyName,
    period: new Date(strategy.created_at).toLocaleDateString("tr-TR"),
    executiveSummary: report?.executiveSummary || "",
    sections,
    confidentialLabel: mode === "internal" ? "Dahili Kullanım" : undefined,
    metaLines: [
      `Müşteri: ${companyName}`,
      mode === "internal" ? `Versiyon: v${strategy.version} · Durum: ${AD_STRATEGY_STATUS_LABELS[strategy.status]}` : `Hazırlanma tarihi: ${new Date().toLocaleDateString("tr-TR")}`
    ],
    footerNote: mode === "internal" ? "HK Dijital · Dahili Operasyon Belgesi · hkdijital.com.tr" : "HK Dijital · hkdijital.com.tr",
    logo: true
  };
}
