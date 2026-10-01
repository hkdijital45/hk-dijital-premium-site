// Rapor Merkezi — aggregation/view layer over existing canonical report
// sources. Writes nothing new: every item here is a normalized read of a
// record that already lives in ad_strategies/ad_creative_reports/
// ad_evaluations/pre_audit_reports/monthly_reports/reports, fetched via
// each module's own existing data-layer function where one exists (never
// a bypassed/duplicated query). No new table, no new storage bucket, no
// copied report content.
import "server-only";
import { supabaseRest } from "@/lib/supabase";

export const REPORT_CENTER_SOURCE_TYPES = [
  "ad_strategy", "ad_creative_report", "ad_evaluation", "pre_audit", "monthly_report", "customer_report"
] as const;
export type ReportCenterSourceType = (typeof REPORT_CENTER_SOURCE_TYPES)[number];

export const REPORT_CENTER_SOURCE_LABELS: Record<ReportCenterSourceType, string> = {
  ad_strategy: "Reklam Stratejisi", ad_creative_report: "Reklam Kreatif Raporu", ad_evaluation: "Reklam Değerlendirmesi",
  pre_audit: "Ön İnceleme", monthly_report: "Aylık Rapor", customer_report: "Müşteri Raporu"
};

export type ReportCenterCapabilities = {
  view: boolean; edit: boolean; archive: boolean; delete: boolean;
  internalPdf: boolean; internalDocx: boolean; clientPdf: boolean; clientDocx: boolean;
};

export type ReportCenterItem = {
  id: string; // `${sourceType}:${sourceId}`
  sourceType: ReportCenterSourceType;
  sourceId: string;
  companyId: string;
  title: string;
  reportDate: string | null;
  period: string | null;
  status: string | null;
  statusLabel: string | null;
  clientVisible: boolean | null;
  campaignName: string | null;
  summary: string | null;
  internalAvailable: boolean;
  clientAvailable: boolean;
  archived: boolean;
  decision: string | null;
  decisionLabel: string | null;
  metricsSummary: { spend: number | null; results: number | null; costPerResult: number | null } | null;
  sourceHref: string;
  capabilities: ReportCenterCapabilities;
  createdAt: string;
  updatedAt: string;
};

function hasReportContent(report: { executiveSummary?: string; sections?: Array<{ title: string; content: string }> } | null | undefined): boolean {
  return Boolean(report?.executiveSummary || report?.sections?.length);
}

function truncate(text: string | null | undefined, max = 220): string | null {
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

async function fetchStrategyItems(companyId: string): Promise<ReportCenterItem[]> {
  const { getAdStrategyHistory, AD_STRATEGY_STATUS_LABELS } = await import("@/lib/marketing-intelligence/ad-strategies");
  const rows = await getAdStrategyHistory(companyId).catch(() => []);
  return rows.map((r: any) => ({
    id: `ad_strategy:${r.id}`, sourceType: "ad_strategy" as const, sourceId: r.id, companyId,
    title: r.strategy_title || `Reklam Stratejisi v${r.version}`,
    reportDate: r.updated_at || r.created_at, period: null, status: r.status,
    statusLabel: AD_STRATEGY_STATUS_LABELS?.[r.status as keyof typeof AD_STRATEGY_STATUS_LABELS] || r.status,
    clientVisible: hasReportContent(r.client_report), campaignName: null,
    summary: truncate(r.client_report?.executiveSummary || r.internal_report?.executiveSummary || r.strategy_title),
    internalAvailable: hasReportContent(r.internal_report), clientAvailable: hasReportContent(r.client_report),
    archived: r.status === "archived", decision: null, decisionLabel: null, metricsSummary: null,
    sourceHref: "/hk-admin/ad-insights",
    capabilities: {
      view: true, edit: false, archive: false, delete: false,
      internalPdf: hasReportContent(r.internal_report), internalDocx: hasReportContent(r.internal_report),
      clientPdf: hasReportContent(r.client_report), clientDocx: hasReportContent(r.client_report)
    },
    createdAt: r.created_at, updatedAt: r.updated_at
  }));
}

async function fetchCreativeItems(companyId: string): Promise<ReportCenterItem[]> {
  const { getCreativeReportHistory, AD_CREATIVE_REPORT_STATUS_LABELS } = await import("@/lib/marketing-intelligence/ad-creative-reports");
  const rows = await getCreativeReportHistory(companyId).catch(() => []);
  return rows.map((r: any) => ({
    id: `ad_creative_report:${r.id}`, sourceType: "ad_creative_report" as const, sourceId: r.id, companyId,
    title: r.report_title || `Reklam Kreatif Raporu v${r.version}`,
    reportDate: r.updated_at || r.created_at, period: null, status: r.status,
    statusLabel: AD_CREATIVE_REPORT_STATUS_LABELS?.[r.status as keyof typeof AD_CREATIVE_REPORT_STATUS_LABELS] || r.status,
    clientVisible: hasReportContent(r.client_report), campaignName: r.strategy_summary?.campaignGoal || null,
    summary: truncate(r.client_report?.executiveSummary || r.internal_report?.executiveSummary || (r.creatives?.length ? `${r.creatives.length} kreatif` : null)),
    internalAvailable: hasReportContent(r.internal_report), clientAvailable: hasReportContent(r.client_report),
    archived: r.status === "archived", decision: null, decisionLabel: null, metricsSummary: null,
    sourceHref: "/hk-admin/ad-insights",
    capabilities: {
      view: true, edit: false, archive: false, delete: false,
      internalPdf: hasReportContent(r.internal_report), internalDocx: hasReportContent(r.internal_report),
      clientPdf: hasReportContent(r.client_report), clientDocx: hasReportContent(r.client_report)
    },
    createdAt: r.created_at, updatedAt: r.updated_at
  }));
}

async function fetchEvaluationItems(companyId: string): Promise<ReportCenterItem[]> {
  const { getAdEvaluationHistory, AD_EVALUATION_STATUS_LABELS, AD_EVALUATION_DECISION_LABELS } = await import("@/lib/marketing-intelligence/ad-evaluations");
  const rows = await getAdEvaluationHistory(companyId).catch(() => []);
  if (!rows.length) return [];
  const campaignIds = [...new Set(rows.map((r: any) => r.campaign_id).filter(Boolean))];
  const campaigns = campaignIds.length
    ? await supabaseRest<Array<{ id: string; name: string }>>(`campaigns?id=in.(${campaignIds.join(",")})&select=id,name`).catch(() => [])
    : [];
  const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));
  return rows.map((r: any) => {
    const campaignName = (r.campaign_id && campaignNameById.get(r.campaign_id)) || r.meta_campaign_id || null;
    const snapshotCampaign = (r.metrics_snapshot as any)?.campaign || null;
    return {
      id: `ad_evaluation:${r.id}`, sourceType: "ad_evaluation" as const, sourceId: r.id, companyId,
      title: `Reklam Değerlendirmesi — ${campaignName || "Kampanya"}`,
      reportDate: r.created_at, period: r.evaluation_period_start && r.evaluation_period_end ? `${r.evaluation_period_start} → ${r.evaluation_period_end}` : null,
      status: r.status, statusLabel: AD_EVALUATION_STATUS_LABELS[r.status as keyof typeof AD_EVALUATION_STATUS_LABELS] || r.status,
      clientVisible: hasReportContent(r.client_report), campaignName,
      summary: truncate(r.client_report?.executiveSummary || r.internal_report?.executiveSummary),
      internalAvailable: hasReportContent(r.internal_report), clientAvailable: hasReportContent(r.client_report),
      archived: r.status === "archived",
      decision: r.decision, decisionLabel: r.decision ? AD_EVALUATION_DECISION_LABELS[r.decision as keyof typeof AD_EVALUATION_DECISION_LABELS] || r.decision : null,
      metricsSummary: snapshotCampaign ? { spend: snapshotCampaign.spend ?? null, results: snapshotCampaign.results ?? null, costPerResult: snapshotCampaign.costPerResult ?? null } : null,
      sourceHref: "/hk-admin/ad-insights",
      capabilities: {
        view: true, edit: true, archive: true, delete: true,
        internalPdf: hasReportContent(r.internal_report), internalDocx: hasReportContent(r.internal_report),
        clientPdf: hasReportContent(r.client_report), clientDocx: hasReportContent(r.client_report)
      },
      createdAt: r.created_at, updatedAt: r.updated_at
    };
  });
}

async function fetchPreAuditItems(companyId: string): Promise<ReportCenterItem[]> {
  const { listPreAuditReports } = await import("@/lib/pre-audit/reports");
  const rows = await listPreAuditReports(companyId).catch(() => []);
  return rows.map((r: any) => ({
    id: `pre_audit:${r.id}`, sourceType: "pre_audit" as const, sourceId: r.id, companyId,
    title: r.title || (r.report_type === "CLIENT_REPORT" ? "Ön İnceleme — Müşteri Raporu" : "Ön İnceleme — Dahili Rapor"),
    reportDate: r.report_date || r.created_at, period: null, status: r.status, statusLabel: r.status,
    clientVisible: r.report_type === "CLIENT_REPORT", campaignName: null, summary: null,
    internalAvailable: r.report_type === "INTERNAL_REPORT", clientAvailable: r.report_type === "CLIENT_REPORT",
    archived: false, decision: null, decisionLabel: null, metricsSummary: null,
    sourceHref: "/hk-admin/on-inceleme",
    capabilities: {
      view: true, edit: false, archive: false, delete: false,
      internalPdf: r.report_type === "INTERNAL_REPORT", internalDocx: r.report_type === "INTERNAL_REPORT",
      clientPdf: r.report_type === "CLIENT_REPORT", clientDocx: r.report_type === "CLIENT_REPORT"
    },
    createdAt: r.created_at, updatedAt: r.updated_at
  }));
}

async function fetchMonthlyItems(companyId: string): Promise<ReportCenterItem[]> {
  const rows = await supabaseRest<any[]>(`monthly_reports?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=created_at.desc`).catch(() => []);
  return rows.map((r) => ({
    id: `monthly_report:${r.id}`, sourceType: "monthly_report" as const, sourceId: r.id, companyId,
    title: `Aylık Rapor — ${r.report_month || "Dönem belirtilmemiş"}`,
    reportDate: r.created_at, period: r.report_month || null, status: r.status || null, statusLabel: r.status || null,
    clientVisible: Boolean(r.visible_to_customer), campaignName: null, summary: truncate(r.summary),
    internalAvailable: true, clientAvailable: Boolean(r.visible_to_customer), archived: false,
    decision: null, decisionLabel: null, metricsSummary: null,
    sourceHref: "/hk-admin/aylik-raporlar",
    capabilities: { view: true, edit: false, archive: false, delete: false, internalPdf: false, internalDocx: false, clientPdf: false, clientDocx: false },
    createdAt: r.created_at, updatedAt: r.updated_at || r.created_at
  }));
}

async function fetchCustomerReportItems(companyId: string): Promise<ReportCenterItem[]> {
  const rows = await supabaseRest<any[]>(`reports?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=created_at.desc`).catch(() => []);
  return rows.map((r) => ({
    id: `customer_report:${r.id}`, sourceType: "customer_report" as const, sourceId: r.id, companyId,
    title: `${r.report_type || "Rapor"}${r.period ? ` — ${r.period}` : ""}`,
    reportDate: r.created_at, period: r.period || null, status: r.archived ? "archived" : "active", statusLabel: r.archived ? "Arşivlendi" : "Aktif",
    clientVisible: Boolean(r.visible_to_customer), campaignName: null, summary: truncate(r.customer_note || r.internal_note),
    internalAvailable: true, clientAvailable: Boolean(r.visible_to_customer), archived: Boolean(r.archived),
    decision: null, decisionLabel: null, metricsSummary: null,
    sourceHref: "/hk-admin/musteri-raporlari",
    capabilities: { view: true, edit: false, archive: false, delete: false, internalPdf: true, internalDocx: true, clientPdf: true, clientDocx: true },
    createdAt: r.created_at, updatedAt: r.updated_at || r.created_at
  }));
}

export type ReportCenterSummary = {
  total: number; completed: number; draft: number; clientVisible: number; archived: number;
};

export type ReportCenterResult = { items: ReportCenterItem[]; summary: ReportCenterSummary };

/** Single company-scoped aggregation call — fetches every source's own
 * canonical history function in parallel (never bypassing a module's
 * own read logic), normalizes to ReportCenterItem, and sorts newest
 * first. Company isolation is enforced by each underlying source
 * function/query, not by client-side filtering. */
export async function getReportCenterItems(companyId: string): Promise<ReportCenterResult> {
  const [strategies, creatives, evaluations, preAudits, monthly, customerReports] = await Promise.all([
    fetchStrategyItems(companyId), fetchCreativeItems(companyId), fetchEvaluationItems(companyId),
    fetchPreAuditItems(companyId), fetchMonthlyItems(companyId), fetchCustomerReportItems(companyId)
  ]);
  const items = [...strategies, ...creatives, ...evaluations, ...preAudits, ...monthly, ...customerReports]
    .sort((a, b) => new Date(b.reportDate || b.createdAt).getTime() - new Date(a.reportDate || a.createdAt).getTime());

  const summary: ReportCenterSummary = {
    total: items.length,
    completed: items.filter((i) => i.status === "active" || i.status === "approved" || i.status === "evaluated" || i.status === "Tamamlandı").length,
    draft: items.filter((i) => i.status === "draft" || i.status === "Taslak").length,
    clientVisible: items.filter((i) => i.clientVisible).length,
    archived: items.filter((i) => i.archived).length
  };
  return { items, summary };
}
