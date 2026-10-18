import "server-only";

import type { DocumentPayload, DocumentSection, DocumentCell } from "@/lib/document-model";
import { safeFileNameSegment } from "@/lib/server/document-generator";
import type { ProposalRecord } from "./store";
import type { HkProposalV1, ProposalBudgetScenario, ProposalCompetitor } from "./schema";
import { normalizeBusinessScope } from "./business-scope";
import { formatTRY } from "./financials";
import type { DocumentMetric, DocumentChart, DocumentTimelinePhase } from "@/lib/document-model";
import { humanizeKeyTr } from "@/lib/turkish-text";
import { formatReportDate } from "@/lib/report-timestamp";

export type ProposalDocumentMode = "internal" | "client";

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

function prettifyKey(key: string): string {
  return humanizeKeyTr(key);
}

function arrayItemText(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const lines = objectToLines(v as Record<string, unknown>);
    return lines.length ? lines.join(" · ") : "-";
  }
  return String(v);
}

// Claude's real responses nest arrays of objects inside these free-form
// jsonb fields too (e.g. google_ads_strategy.campaignArchitecture) — a
// bare `.join(", ")` on such an array previously produced literal
// "[object Object]" text in the generated document.
function objectToLines(value: Record<string, unknown>): string[] {
  return Object.entries(value)
    .filter(([, v]) => !isEmpty(v))
    .map(([key, v]) => `${prettifyKey(key)}: ${Array.isArray(v) ? v.map(arrayItemText).join(", ") : typeof v === "object" ? arrayItemText(v) : String(v)}`);
}

// A real Claude Project response is not guaranteed to match
// ProposalBudgetScenario/etc.'s declared field types exactly (e.g.
// `risks` documented as `string` was returned as a real string[] by
// Claude for the Abdulmalik proposal, production record
// ce4187fc-b531-4adf-957e-ab8c78d84387) — validateHkProposalV1 only
// checks array-ness at the top level, not every nested field's type.
// A raw array/object handed to the PDF/DOCX table renderer previously
// crashed the whole export ("text.split is not a function" in
// wrapText) instead of degrading gracefully. cellText always returns a
// real, safe string — joining arrays, flattening objects — so a
// surprising-but-real Claude response degrades to readable text
// instead of breaking the entire document.
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.trim() || "-";
  if (Array.isArray(value)) return value.length ? value.map((v) => cellText(v)).join("; ") : "-";
  if (typeof value === "object") {
    const lines = objectToLines(value as Record<string, unknown>);
    return lines.length ? lines.join(" · ") : "-";
  }
  return String(value);
}

function budgetScenariosTable(scenarios: ProposalBudgetScenario[]) {
  return {
    headers: ["Senaryo", "Aylık Bütçe", "Hedef", "Test Sınırlamaları", "Riskler"],
    rows: scenarios.map((s) => [
      cellText(s.name),
      s.monthlyBudget != null ? `${Number(s.monthlyBudget).toLocaleString("tr-TR")} TL` : "-",
      cellText(s.objective),
      cellText(s.testingLimitations),
      cellText(s.risks)
    ] as DocumentCell[])
  };
}

// recommended_services is documented as string[] but Claude may return
// richer service objects (service/scope/price) — render a readable
// summary line instead of the literal type-mismatch fallback
// ("[object Object]") a bare String(item) would otherwise produce.
function serviceLineText(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    const name = (o.service || o.name || o.title) as string | undefined;
    const price = (o.priceInclVat || o.monthlyServiceFeeInclVat) as number | string | undefined;
    const scope = o.scope as string | undefined;
    const parts = [name, price ? `${Number(price).toLocaleString("tr-TR")} TL (KDV Dahil)` : undefined, scope].filter(Boolean);
    return parts.length ? parts.join(" — ") : cellText(item);
  }
  return cellText(item);
}

function competitorsTable(competitors: ProposalCompetitor[], mode: ProposalDocumentMode) {
  const headers = mode === "internal" ? ["Rakip", "Durum", "Not", "Kaynak"] : ["Rakip", "Not"];
  return {
    headers,
    rows: competitors.map((c): DocumentCell[] => {
      const status = c.verified ? "Doğrulandı" : "Tahmin / Doğrulanmadı";
      const sourceCell: DocumentCell = c.sourceUrl ? { label: "Kaynağı Aç", url: c.sourceUrl } : "—";
      return mode === "internal" ? [cellText(c.name), status, cellText(c.notes), sourceCell] : [cellText(c.name), cellText(c.notes)];
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

  // Teklif kapsamı — only when the proposal explicitly covers more than one
  // business; single-business proposals render exactly as before.
  const scope = normalizeBusinessScope((record.questionnaire as { businessScope?: unknown } | undefined)?.businessScope);
  if (scope.length > 1) {
    sections.push({ title: "Teklif Kapsamı", items: scope.map((item) => `${item.name} — ${item.role === "main" ? "Ana işletme" : item.role === "related_brand" ? "Bağlı marka" : item.role === "branch" ? "Şube" : "İşletme grubu"}${item.instagram ? ` (${item.instagram})` : ""}`) });
  }

  const fin = record.financials;
  if (fin && !isEmpty(fin)) {
    const lines = Array.isArray(fin.serviceLines) ? fin.serviceLines : [];
    if (lines.length) {
      sections.push({
        title: "İşletme Bazlı Hizmet Kalemleri",
        table: {
          headers: ["İşletme", "Hizmet", "Aylık (KDV Dahil)", "Kurulum (KDV Dahil)"],
          rows: lines.map((line): DocumentCell[] => [line.businessName, line.description, line.monthlyFee ? formatTRY(line.monthlyFeeInclVat) : "-", line.setupFee ? formatTRY(line.setupFeeInclVat) : "-"])
        }
      });
    }
    const rows: DocumentCell[][] = [
      ["Toplam Aylık Reklam Bütçesi (platforma ödenir, KDV'ye tabi değil)", fin.formatted?.totalMonthlyAdBudget || "-"],
      ["Aylık Ajans Yönetim Ücreti (KDV Dahil)", fin.formatted?.agencyMonthlyFeeInclVat || "-"],
      ...(lines.length ? [["İşletme Bazlı Hizmetler — Aylık (KDV Dahil)", formatTRY(fin.serviceLinesMonthlyInclVat || 0)] as DocumentCell[]] : []),
      ["Kurulum Ücreti (KDV Dahil)", fin.formatted?.setupFeeInclVat || "-"],
      ...(lines.some((line) => line.setupFee) ? [["İşletme Bazlı Kurulum (KDV Dahil)", formatTRY(fin.serviceLinesSetupInclVat || 0)] as DocumentCell[]] : []),
      ["İlk Ay Toplamı (KDV Dahil)", fin.formatted?.firstMonthTotalInclVat || "-"],
      ["Sonraki Aylar Toplamı (KDV Dahil)", fin.formatted?.subsequentMonthTotalInclVat || "-"]
    ];
    if (fin.formatted?.contractTotalInclVat) rows.push(["Sözleşme Dönemi Toplamı (KDV Dahil)", fin.formatted.contractTotalInclVat]);
    // Premium V3: the same deterministic numbers as cards + a composition
    // chart. Ad budget (paid to the platform, untaxed) is always kept
    // separate from HK Dijital's own fees — nothing here is recalculated.
    const metrics: DocumentMetric[] = [];
    if (fin.formatted?.firstMonthTotalInclVat) metrics.push({ label: "İlk Ay Toplamı (KDV Dahil)", value: fin.formatted.firstMonthTotalInclVat, tone: "accent" });
    if (fin.formatted?.subsequentMonthTotalInclVat) metrics.push({ label: "Sonraki Aylar (KDV Dahil)", value: fin.formatted.subsequentMonthTotalInclVat });
    if (fin.formatted?.totalMonthlyAdBudget) metrics.push({ label: "Aylık Reklam Bütçesi", value: fin.formatted.totalMonthlyAdBudget, note: "Platforma ödenir, KDV'ye tabi değil" });
    if (fin.formatted?.contractTotalInclVat) metrics.push({ label: `Sözleşme Toplamı${fin.contractMonths ? ` (${fin.contractMonths} Ay)` : ""}`, value: fin.formatted.contractTotalInclVat });
    const composition: DocumentChart["data"] = [
      ...(Array.isArray(fin.adBudgetsByPlatform) ? fin.adBudgetsByPlatform.map((b) => ({ label: `${b.platform} bütçesi`, value: Number(b.monthlyBudget) })) : []),
      ...(fin.agencyMonthlyFeeInclVat ? [{ label: "Ajans hizmet bedeli (KDV dahil)", value: Number(fin.agencyMonthlyFeeInclVat) }] : []),
      ...(fin.serviceLinesMonthlyInclVat ? [{ label: "İşletme bazlı hizmetler (KDV dahil)", value: Number(fin.serviceLinesMonthlyInclVat) }] : []),
      ...(fin.additionalServiceFeesInclVat ? [{ label: "Ek hizmetler (KDV dahil)", value: Number(fin.additionalServiceFeesInclVat) }] : [])
    ];
    sections.push({
      title: "Finansal Özet",
      intro: "Tutarlar teklif sihirbazında girilen ücret ve bütçelerden hesaplanmıştır. Reklam bütçesi doğrudan reklam platformuna ödenir ve HK Dijital hizmet bedelinden ayrı gösterilir.",
      metrics,
      charts: [{ type: "donut", title: "Aylık Maliyet Dağılımı (Kurulum Hariç)", valueFormat: "currency", data: composition, caption: "Her ay tekrar eden kalemlerin dağılımı; tek seferlik kurulum ücreti dahil değildir." }],
      table: { headers: ["Kalem", "Tutar"], rows }
    });
  }

  // Ödeme koşulları ve süre — only what the proposal actually states.
  const fees = ((record.questionnaire as { fees?: Record<string, unknown> } | undefined)?.fees || {}) as Record<string, unknown>;
  const termRows: DocumentCell[][] = [];
  const termText = (label: string, value: unknown) => { if (typeof value === "string" && value.trim()) termRows.push([label, value.trim()]); };
  if (typeof fees.packageName === "string" && fees.packageName.trim()) termRows.push(["Paket", fees.packageName.trim()]);
  if (Number(fees.contractDurationMonths) > 0) termRows.push(["Hizmet Süresi", `${Number(fees.contractDurationMonths)} ay`]);
  termText("Ödeme Koşulları", fees.paymentTerms);
  termText("Vergi", fees.taxes);
  termText("İndirim", fees.discounts);
  termText("Ek Hizmet Ücretleri", fees.additionalServiceFees);
  termText("Kapsama Dahil Hizmetler", fees.includedServices);
  termText("Kapsam Dışı Hizmetler", fees.excludedServices);
  if (termRows.length) sections.push({ title: "Hizmet Süresi ve Ödeme Koşulları", table: { headers: ["Konu", "Açıklama"], rows: termRows } });

  if (Array.isArray(data.recommended_services) && data.recommended_services.length) {
    sections.push({ title: "Önerilen HK Dijital Hizmetleri", items: data.recommended_services.map(serviceLineText) });
  }

  if (Array.isArray(data.implementation_plan) && data.implementation_plan.length) {
    sections.push({ title: "İlk 30 Gün Uygulama Planı", items: data.implementation_plan.map((item) => `${item.day ? `${cellText(item.day)}: ` : ""}${cellText(item.action)}`) });
  }

  if (Array.isArray(data.roadmap_90_days) && data.roadmap_90_days.length) {
    // Grouped into phases for a visual timeline when the data names phases;
    // otherwise the original bullet list (content is never reworded).
    const phases = new Map<string, string[]>();
    for (const item of data.roadmap_90_days) {
      const phase = item.phase ? cellText(item.phase) : "";
      if (!phases.has(phase)) phases.set(phase, []);
      phases.get(phase)!.push(cellText(item.action));
    }
    const timeline: DocumentTimelinePhase[] = [...phases.entries()].filter(([phase]) => phase).map(([label, items]) => ({ label, items }));
    if (timeline.length >= 2 && timeline.length <= 8 && !phases.has("")) sections.push({ title: "90 Günlük Yol Haritası", timeline });
    else sections.push({ title: "90 Günlük Yol Haritası", items: data.roadmap_90_days.map((item) => `${item.phase ? `${cellText(item.phase)}: ` : ""}${cellText(item.action)}`) });
  }

  if (mode === "internal") {
    if (Array.isArray(data.risks) && data.risks.length) sections.push({ title: "Riskler", items: data.risks.map(cellText) });
    if (Array.isArray(data.assumptions) && data.assumptions.length) sections.push({ title: "Varsayımlar", items: data.assumptions.map(cellText) });
    if (data.internal_recommendations && !isEmpty(data.internal_recommendations)) sections.push({ title: "Dahili Öneriler", items: objectToLines(data.internal_recommendations as Record<string, unknown>) });
    if (Array.isArray(data.sources) && data.sources.length) {
      sections.push({
        title: "Kaynaklar",
        table: {
          headers: ["Kaynak", "Erişim Tarihi", "Bağlantı"],
          rows: data.sources.map((s): DocumentCell[] => [cellText(s.note), cellText(s.accessDate), s.url ? { label: "Bağlantıyı Aç", url: s.url } : "—"])
        }
      });
    }
  } else if (data.customer_proposal && !isEmpty(data.customer_proposal)) {
    sections.push({ title: "Müşteriye Özel Değerlendirme", items: objectToLines(data.customer_proposal as Record<string, unknown>) });
  }

  return {
    title: mode === "internal" ? `HK Dijital — Dahili Teklif Raporu (${record.proposal_number})` : `HK Dijital — Teklif (${record.proposal_number})`,
    customerName: record.target_label,
    period: formatReportDate(record.created_at),
    // The bare record title ("Teklif") is already the cover title — never repeated as a fake summary.
    executiveSummary: (business?.description as string) || "",
    sections,
    logo: true,
    confidentialLabel: mode === "internal" ? "Dahili Kullanım" : undefined,
    footerNote: mode === "internal" ? "HK Dijital · Dahili Kullanım · Müşteriyle Paylaşılmaz" : "HK Dijital · Dijital Pazarlama & Büyüme Çözümleri · hkdijital.com.tr",
    metaLines: [
      `Firma: ${record.target_label}`,
      `Teklif No: ${record.proposal_number}`,
      `Tarih: ${formatReportDate(record.created_at)}`,
      record.valid_until ? `Geçerlilik: ${formatReportDate(record.valid_until)}` : "",
      "Hazırlayan: HK Dijital"
    ].filter(Boolean)
  };
}

export function buildProposalFileName(record: ProposalRecord, mode: ProposalDocumentMode, format: "pdf" | "docx"): string {
  const company = safeFileNameSegment(record.target_label);
  const suffix = mode === "internal" ? "Dahili-Teklif" : "Teklif";
  return `HK-Dijital-${company}-${suffix}-${record.proposal_number}.${format}`;
}
