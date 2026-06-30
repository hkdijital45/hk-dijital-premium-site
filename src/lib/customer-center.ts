/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { hasSupabaseConfig, supabaseRest } from "./supabase";

export type CustomerCenterData = {
  company: any;
  visibility: any;
  campaigns: any[];
  metrics: any[];
  updates: any[];
  files: any[];
  reports: any[];
  customerReportVisibility: any[];
  metaAdsetMetrics: any[];
  metaAdMetrics: any[];
  metaConversionEvents: any[];
  metaAnalysisSnapshots: any[];
  interpretations: any[];
  reportUpdates: any[];
  branding: any;
  documents: any[];
  payments: any[];
  tasks: any[];
  pixelStatus: any;
  monthlyReports: any[];
  competitorSummaries: any[];
};

const defaultVisibility = {
  show_campaigns: true,
  show_metrics: true,
  show_budget: true,
  show_spent: true,
  show_leads: true,
  show_strategy_notes: true,
  show_work_updates: true,
  show_files: true,
  show_contact_person: true,
  show_payments: true,
  show_tasks: false,
  show_meta_status: false
};

export async function getCustomerCenterData(companyId?: string): Promise<CustomerCenterData> {
  if (hasSupabaseConfig() && !companyId) {
    return {
      company: null,
      visibility: defaultVisibility,
      campaigns: [],
      metrics: [],
      updates: [],
      files: [],
      reports: [],
      customerReportVisibility: [],
      metaAdsetMetrics: [],
      metaAdMetrics: [],
      metaConversionEvents: [],
      metaAnalysisSnapshots: [],
      interpretations: [],
      reportUpdates: [],
      branding: null,
      documents: [],
      payments: [],
      tasks: [],
      pixelStatus: null,
      monthlyReports: [],
      competitorSummaries: []
    };
  }

  if (hasSupabaseConfig() && companyId) {
    const [companies, visibilityRows, campaigns, metrics, reportVisibility, metaAdsets, metaAds, metaConversions, metaAnalyses, updates, files, reports, interpretations, reportUpdates, brandingRows, documents, payments, tasks, pixelRows, monthlyReports, competitorSummaries] = await Promise.all([
      supabaseRest<any[]>(`companies?id=eq.${companyId}&select=*&limit=1`),
      supabaseRest<any[]>(`customer_visibility_settings?company_id=eq.${companyId}&select=*&limit=1`),
      supabaseRest<any[]>(`campaigns?company_id=eq.${companyId}&select=*&order=created_at.desc`),
      supabaseRest<any[]>(`campaign_metrics?company_id=eq.${companyId}&select=*&order=date.desc`),
      supabaseRest<any[]>(`customer_report_visibility?company_id=eq.${companyId}&select=*&order=display_order.asc`).catch(() => []),
      supabaseRest<any[]>(`meta_adset_metrics?company_id=eq.${companyId}&select=*&order=date.desc`).catch(() => []),
      supabaseRest<any[]>(`meta_ad_metrics?company_id=eq.${companyId}&select=*&order=date.desc`).catch(() => []),
      supabaseRest<any[]>(`meta_conversion_events?company_id=eq.${companyId}&select=*&order=date.desc`).catch(() => []),
      supabaseRest<any[]>(`meta_analysis_snapshots?company_id=eq.${companyId}&select=*&order=created_at.desc`).catch(() => []),
      supabaseRest<any[]>(`customer_updates?company_id=eq.${companyId}&visible_to_customer=eq.true&select=*&order=created_at.desc`),
      supabaseRest<any[]>(`customer_files?company_id=eq.${companyId}&visible_to_customer=eq.true&select=*&order=uploaded_at.desc`),
      supabaseRest<any[]>(`reports?company_id=eq.${companyId}&visible_to_customer=eq.true&archived=eq.false&select=*&order=created_at.desc`).catch(() => []),
      supabaseRest<any[]>(`report_interpretations?company_id=eq.${companyId}&select=*&order=created_at.desc`).catch(() => []),
      supabaseRest<any[]>(`report_updates?company_id=eq.${companyId}&is_visible_to_customer=eq.true&select=*&order=is_pinned.desc,update_date.desc`).catch(() => []),
      supabaseRest<any[]>(`customer_branding?company_id=eq.${companyId}&select=*&limit=1`).catch(() => []),
      supabaseRest<any[]>(`customer_documents?company_id=eq.${companyId}&visible_to_customer=eq.true&select=*&order=document_date.desc`).catch(() => []),
      supabaseRest<any[]>(`payment_records?company_id=eq.${companyId}&visible_to_customer=eq.true&select=*&order=due_date.desc`).catch(() => []),
      supabaseRest<any[]>(`agency_tasks?company_id=eq.${companyId}&visible_to_customer=eq.true&select=*&order=due_date.asc`).catch(() => []),
      supabaseRest<any[]>(`ad_integrations?company_id=eq.${companyId}&provider=eq.meta&select=pixel_enabled,capi_enabled,pixel_status,capi_status,last_pixel_test_at,last_capi_test_at,last_event_at,sync_message&limit=1`).catch(() => []),
      supabaseRest<any[]>(`monthly_reports?company_id=eq.${companyId}&visible_to_customer=eq.true&select=*&order=report_month.desc`).catch(() => []),
      supabaseRest<any[]>(`competitor_watchlist?company_id=eq.${companyId}&or=(show_to_customer.eq.true,show_customer_summary.eq.true)&select=id,competitor_name,customer_summary,customer_visible_summary,customer_recommendations,customer_action_plan,last_checked_at,show_to_customer,show_customer_summary&order=last_checked_at.desc`).catch(() => [])
    ]);

    const visibleReports = reports.map(({ internal_note: _internalNote, raw_extracted_data: _rawExtractedData, ...report }) => report);
    const visibleReportIds = new Set(visibleReports.map((report) => report.id).filter(Boolean));
    const visibleInterpretations = interpretations.filter((interpretation) => interpretation.report_id && visibleReportIds.has(interpretation.report_id));

    return {
      company: companies[0] || null,
      visibility: visibilityRows[0] || defaultVisibility,
      campaigns: campaigns.filter((item) => item.visible_to_customer !== false && !item.archived_at && !item.deleted_at && item.status !== "Arşivlendi"),
      metrics: metrics.filter((item) => item.visible_to_customer !== false),
      customerReportVisibility: reportVisibility,
      metaAdsetMetrics: metaAdsets,
      metaAdMetrics: metaAds,
      metaConversionEvents: metaConversions,
      metaAnalysisSnapshots: metaAnalyses,
      updates,
      files,
      reports: visibleReports,
      interpretations: visibleInterpretations,
      reportUpdates,
      branding: brandingRows[0] || null,
      documents,
      payments,
      tasks,
      pixelStatus: pixelRows[0] || null,
      monthlyReports,
      competitorSummaries: competitorSummaries.map(({ analysis_payload: _analysisPayload, internal_analysis: _internalAnalysis, notification_settings: _notificationSettings, ...item }) => item)
    };
  }

  return {
    company: {
      id: "preview-company",
      name: "Müşteri İşletmesi",
      sector: "Hizmet Sektörü",
      city: "Manisa",
      website: "",
      instagram: "",
      phone: "",
      email: ""
    },
    visibility: defaultVisibility,
    campaigns: [
      {
        id: "preview-campaign",
        name: "Reklam Çalışması",
        platform: "Meta",
        objective: "Form",
        status: "Hazırlanıyor",
        total_budget: 0,
        spent_budget: 0,
        budget: 0,
        spent: 0,
        visible_to_customer: true,
        notes: "Kampanya detayları güncellendiğinde burada gösterilir."
      }
    ],
    metrics: [
      {
        impressions: 0,
        reach: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        leads: 0,
        conversions: 0,
        cost_per_lead: 0,
        spent: 0,
        notes: "Performans özeti"
      }
    ],
    updates: [
      {
        id: "preview-update",
        title: "Panel hazırlandı",
        description: "HK Dijital Marketing Center, kampanya ve süreç takibi için hazırlandı.",
        update_type: "Yapılan Çalışma",
        created_at: new Date().toISOString()
      }
    ],
    files: [],
    reports: [],
    customerReportVisibility: [],
    metaAdsetMetrics: [],
    metaAdMetrics: [],
    metaConversionEvents: [],
    metaAnalysisSnapshots: [],
    interpretations: [],
    reportUpdates: [],
    branding: null,
    documents: [],
    payments: [],
    tasks: [],
    pixelStatus: null,
    monthlyReports: [],
    competitorSummaries: []
  };
}

export function summarizeMetrics(metrics: any[]) {
  const totals = metrics.reduce(
    (total, item) => ({
      impressions: total.impressions + Number(item.impressions || 0),
      reach: total.reach + Number(item.reach || 0),
      clicks: total.clicks + Number(item.clicks || 0),
      messages: total.messages + Number(item.messages || 0),
      spent: total.spent + Number(item.spent || 0),
      leads: total.leads + Number(item.leads || item.results || 0),
      cpc: total.cpc + Number(item.cpc || 0),
      cost_per_lead: total.cost_per_lead + Number(item.cost_per_lead || item.costPerLead || item.costPerResult || 0)
    }),
    { impressions: 0, reach: 0, clicks: 0, messages: 0, spent: 0, leads: 0, cpc: 0, cost_per_lead: 0 }
  );
  return {
    ...totals,
    spent: Number(totals.spent.toFixed(2)),
    cpc: Number((totals.clicks > 0 ? totals.spent / totals.clicks : totals.cpc).toFixed(2)),
    cost_per_lead: Number((totals.leads > 0 ? totals.spent / totals.leads : totals.cost_per_lead).toFixed(2))
  };
}
