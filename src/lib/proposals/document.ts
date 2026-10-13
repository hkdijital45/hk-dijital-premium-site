import "server-only";

import type { DocumentPayload, DocumentSection, DocumentCell } from "@/lib/document-model";
import { safeFileNameSegment } from "@/lib/server/document-generator";
import type { ProposalRecord } from "./store";
import type { HkProposalV1, ProposalBudgetScenario, ProposalCompetitor } from "./schema";

export type ProposalDocumentMode = "internal" | "client";

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

function prettifyKey(key: string): string {
  const spaced = key.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.replace(/\b\w/g, (c) => c.toLocaleUpperCase("tr"));
}

function objectToLines(value: Record<string, unknown>): string[] {
  return Object.entries(value)
    .filter(([, v]) => !isEmpty(v))
    .map(([key, v]) => `${prettifyKey(key)}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
}

function budgetScenariosTable(scenarios: ProposalBudgetScenario[]) {
  return {
    headers: ["Senaryo", "Aylık Bütçe", "Hedef", "Test Sınırlamaları", "Riskler"],
    rows: scenarios.map((s) => [
      s.name || "-",
      s.monthlyBudget != null ? `${Number(s.monthlyBudget).toLocaleString("tr-TR")} TL` : "-",
      s.objective || "-",
      s.testingLimitations || "-",
      s.risks || "-"
    ] as DocumentCell[])
  };
}

function competitorsTable(competitors: ProposalCompetitor[], mode: ProposalDocumentMode) {
  const headers = mode === "internal" ? ["Rakip", "Durum", "Not", "Kaynak"] : ["Rakip", "Not"];
  return {
    headers,
    rows: competitors.map((c): DocumentCell[] => {
      const status = c.verified ? "Doğrulandı" : "Tahmin / Doğrulanmadı";
      const sourceCell: DocumentCell = c.sourceUrl ? { label: "Kaynağı Aç", url: c.sourceUrl } : "—";
      return mode === "internal" ? [c.name, status, c.notes || "-", sourceCell] : [c.name, c.notes || "-"];
    })
  };
}

export function buildProposalDocumentPayload(record: ProposalRecord, mode: ProposalDocumentMode): DocumentPayload {
  const data = (record.data || {}) as Partial<HkProposalV1>;
  const sections: DocumentSection[] = [];

  const business = data.business as Record<string, unknown> | undefined;
  if (business && !isEmpty(business)) sections.push({ title: "İşletme Değerlendirmesi", items: objectToLines(business) });

  if (data.market_analysis && !isEmpty(data.market_analysis)) sections.push({ title: "Pazar Analizi", items: objectToLines(data.market_analysis as Record<string, unknown>) });

  if (Array.isArray(data.competitors) && data.competitors.length) {
    sections.push({ title: "Rakip Analizi", table: competitorsTable(data.competitors, mode) });
  }

  if (data.google_ads_strategy && !isEmpty(data.google_ads_strategy)) sections.push({ title: "Google Ads Stratejisi", items: objectToLines(data.google_ads_strategy as Record<string, unknown>) });
  if (data.meta_ads_strategy && !isEmpty(data.meta_ads_strategy)) sections.push({ title: "Meta Ads Stratejisi", items: objectToLines(data.meta_ads_strategy as Record<string, unknown>) });
  if (data.audience_strategy && !isEmpty(data.audience_strategy)) sections.push({ title: "Hedef Kitle ve Coğrafi Strateji", items: objectToLines(data.audience_strategy as Record<string, unknown>) });

  if (Array.isArray(data.budget_scenarios) && data.budget_scenarios.length) {
    sections.push({ title: "Reklam Bütçesi Senaryoları", table: budgetScenariosTable(data.budget_scenarios) });
  }

  const fin = record.financials;
  if (fin && !isEmpty(fin)) {
    const rows: DocumentCell[][] = [
      ["Toplam Aylık Reklam Bütçesi", fin.formatted?.totalMonthlyAdBudget || "-"],
      ["Aylık Ajans Yönetim Ücreti (KDV Dahil)", fin.formatted?.agencyMonthlyFeeInclVat || "-"],
      ["Kurulum Ücreti (KDV Dahil)", fin.formatted?.setupFeeInclVat || "-"],
      ["İlk Ay Toplamı (KDV Dahil)", fin.formatted?.firstMonthTotalInclVat || "-"],
      ["Sonraki Aylar Toplamı (KDV Dahil)", fin.formatted?.subsequentMonthTotalInclVat || "-"]
    ];
    if (fin.formatted?.contractTotalInclVat) rows.push(["Sözleşme Dönemi Toplamı (KDV Dahil)", fin.formatted.contractTotalInclVat]);
    sections.push({ title: "Finansal Özet", table: { headers: ["Kalem", "Tutar"], rows } });
  }

  if (Array.isArray(data.recommended_services) && data.recommended_services.length) {
    sections.push({ title: "Önerilen HK Dijital Hizmetleri", items: data.recommended_services.map(String) });
  }

  if (Array.isArray(data.implementation_plan) && data.implementation_plan.length) {
    sections.push({ title: "İlk 30 Gün Uygulama Planı", items: data.implementation_plan.map((item) => `${item.day ? `${item.day}: ` : ""}${item.action}`) });
  }

  if (Array.isArray(data.roadmap_90_days) && data.roadmap_90_days.length) {
    sections.push({ title: "90 Günlük Yol Haritası", items: data.roadmap_90_days.map((item) => `${item.phase ? `${item.phase}: ` : ""}${item.action}`) });
  }

  if (mode === "internal") {
    if (Array.isArray(data.risks) && data.risks.length) sections.push({ title: "Riskler", items: data.risks.map(String) });
    if (Array.isArray(data.assumptions) && data.assumptions.length) sections.push({ title: "Varsayımlar", items: data.assumptions.map(String) });
    if (data.internal_recommendations && !isEmpty(data.internal_recommendations)) sections.push({ title: "Dahili Öneriler", items: objectToLines(data.internal_recommendations as Record<string, unknown>) });
    if (Array.isArray(data.sources) && data.sources.length) {
      sections.push({
        title: "Kaynaklar",
        table: {
          headers: ["Kaynak", "Erişim Tarihi", "Bağlantı"],
          rows: data.sources.map((s): DocumentCell[] => [s.note || "-", s.accessDate || "-", s.url ? { label: "Bağlantıyı Aç", url: s.url } : "—"])
        }
      });
    }
  } else if (data.customer_proposal && !isEmpty(data.customer_proposal)) {
    sections.push({ title: "Müşteriye Özel Değerlendirme", items: objectToLines(data.customer_proposal as Record<string, unknown>) });
  }

  return {
    title: mode === "internal" ? `HK Dijital — Dahili Teklif Raporu (${record.proposal_number})` : `HK Dijital — Teklif (${record.proposal_number})`,
    customerName: record.target_label,
    period: new Date(record.created_at).toLocaleDateString("tr-TR"),
    executiveSummary: (business?.description as string) || record.title || "",
    sections,
    logo: true,
    confidentialLabel: mode === "internal" ? "Dahili Kullanım" : undefined,
    footerNote: mode === "internal" ? "HK Dijital · Dahili Kullanım · Müşteriyle Paylaşılmaz" : "HK Dijital · Dijital Pazarlama & Büyüme Çözümleri · hkdijital.com.tr",
    metaLines: [
      `Firma: ${record.target_label}`,
      `Teklif No: ${record.proposal_number}`,
      `Tarih: ${new Date(record.created_at).toLocaleDateString("tr-TR")}`,
      record.valid_until ? `Geçerlilik: ${new Date(record.valid_until).toLocaleDateString("tr-TR")}` : "",
      "Hazırlayan: HK Dijital"
    ].filter(Boolean)
  };
}

export function buildProposalFileName(record: ProposalRecord, mode: ProposalDocumentMode, format: "pdf" | "docx"): string {
  const company = safeFileNameSegment(record.target_label);
  const suffix = mode === "internal" ? "Dahili-Teklif" : "Teklif";
  return `HK-Dijital-${company}-${suffix}-${record.proposal_number}.${format}`;
}
