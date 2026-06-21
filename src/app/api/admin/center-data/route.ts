/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { normalizeRole } from "@/lib/permissions";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const tables = {
  companies: "companies",
  users: "users",
  leads: "leads",
  campaigns: "campaigns",
  campaignMetrics: "campaign_metrics",
  metaAdsetMetrics: "meta_adset_metrics",
  metaAdMetrics: "meta_ad_metrics",
  metaConversionEvents: "meta_conversion_events",
  metaAnalysisSnapshots: "meta_analysis_snapshots",
  customerReportVisibility: "customer_report_visibility",
  customerUpdates: "customer_updates",
  customerVisibilitySettings: "customer_visibility_settings",
  customerFiles: "customer_files",
  media: "media_files",
  customerBranding: "customer_branding",
  monthlyReports: "monthly_reports",
  agencyTasks: "agency_tasks",
  customerDocuments: "customer_documents",
  paymentRecords: "payment_records",
  reports: "reports",
  competitorAnalyses: "competitor_analyses",
  socialMediaPlans: "social_media_plans",
  agencyExpenses: "agency_expenses",
  sectorConfigs: "sector_configs",
  systemTestRuns: "system_test_runs",
  systemTestChecklist: "system_test_checklist",
  activityLogs: "activity_logs"
} as const;
const allowedUpdateTypes = ["Yapılan Çalışma", "Reklam Güncellemesi", "Rapor Notu", "Strateji Notu", "Uyarı", "Başarı", "Diğer"];

async function requireStaff() {
  const session = await getSession();
  if (!isStaffRole(session?.role) || !["admin", "yonetici"].includes(normalizeRole(session?.role))) {
    return null;
  }
  return session;
}

function normalizeRecord(key: string, item: any) {
  const id = uuidPattern.test(String(item.id || "")) ? item.id : undefined;
  const base: Record<string, unknown> = id ? { id } : {};

  if (key === "companies") {
    return {
      ...base,
      name: item.name || "",
      sector: item.sector || "",
      city: item.city || "",
      website: item.website || "",
      instagram: item.instagram || "",
      phone: item.phone || "",
      email: item.email || "",
      status: item.status || "Aktif",
      notes: item.notes || null,
      updated_at: new Date().toISOString()
    };
  }

  if (key === "campaigns") {
    const totalBudget = Number(item.total_budget ?? item.totalBudget ?? item.budget ?? 0);
    const spentBudget = Number(item.spent_budget ?? item.spentBudget ?? item.spent ?? 0);
    return {
      ...base,
      company_id: item.company_id || null,
      customer_id: item.customer_id || item.customerId || null,
      name: item.name || "Yeni Kampanya",
      platform: item.platform || "Meta Ads",
      objective: item.objective || "Lead",
      status: item.status || "Planlandı",
      start_date: item.start_date || null,
      end_date: item.end_date || null,
      daily_budget: Number(item.daily_budget ?? item.dailyBudget ?? 0),
      total_budget: totalBudget,
      spent_budget: spentBudget,
      budget: totalBudget,
      spent: spentBudget,
      meta_campaign_id: item.meta_campaign_id || item.metaCampaignId || null,
      external_id: item.external_id || item.externalId || item.meta_campaign_id || null,
      source: item.source || null,
      settings: item.settings || {},
      notes: item.notes || null,
      internal_notes: item.internal_notes || item.internalNotes || null,
      visible_to_customer: item.visible_to_customer ?? false,
      archived_at: item.archived_at || (item.status === "Arşivlendi" ? new Date().toISOString() : null),
      deleted_at: item.deleted_at || null,
      updated_at: new Date().toISOString()
    };
  }

  if (key === "leads") {
    return {
      ...base,
      source: item.source || "Teklif Formu",
      company_id: item.company_id || null,
      name: item.name || "",
      company: item.company || "",
      phone: item.phone || "",
      email: item.email || "",
      instagram: item.instagram || "",
      website: item.website || "",
      business_type: item.business_type || item.businessType || "",
      goal: item.goal || "",
      budget: item.budget || "",
      recommended_package: item.recommended_package || item.recommendedPackage || "",
      message: item.message || item.note || "",
      status: item.status || "Yeni",
      pipeline_stage: item.pipeline_stage || item.status || "Yeni Lead",
      notes: item.notes || item.internalNotes || "",
      follow_up_date: item.follow_up_date || item.followUpDate || null,
      last_contact_at: item.last_contact_at || item.lastContactAt || null,
      next_action_at: item.next_action_at || item.nextActionAt || null,
      next_action: item.next_action || item.nextAction || "",
      deleted_at: item.deleted_at || item.deletedAt || null,
      rejected_at: item.rejected_at || item.rejectedAt || null,
      rejection_reason: item.rejection_reason || "",
      digital_maturity_score: Number(item.digital_maturity_score || 0),
      lead_heat_score: Number(item.lead_heat_score || 0),
      ai_analysis: item.ai_analysis || {},
      proposal_history: item.proposal_history || [],
      city: item.city || "",
      district: item.district || "",
      sector: item.sector || item.business_type || item.businessType || "",
      address: item.address || "",
      google_rating: item.google_rating ?? null,
      google_review_count: Number(item.google_review_count || 0),
      google_place_id: item.google_place_id || "",
      source_url: item.source_url || "",
      competitor_notes: item.competitor_notes || "",
      local_opportunity_notes: item.local_opportunity_notes || "",
      updated_at: new Date().toISOString()
    };
  }

  if (key === "campaignMetrics") {
    return {
      ...base,
      campaign_id: item.campaign_id || null,
      company_id: item.company_id || null,
      meta_campaign_id: item.meta_campaign_id || item.metaCampaignId || null,
      campaign_name: item.campaign_name || item.campaignName || null,
      date: item.date || new Date().toISOString().slice(0, 10),
      impressions: Number(item.impressions || 0),
      reach: Number(item.reach || 0),
      clicks: Number(item.clicks || 0),
      messages: Number(item.messages || 0),
      period: item.period || null,
      source: item.source || null,
      leads: Number(item.leads || 0),
      conversions: Number(item.conversions || 0),
      ctr: Number(item.ctr || 0),
      cpc: Number(item.cpc || 0),
      cpm: Number(item.cpm || 0),
      cost_per_lead: Number(item.cost_per_lead || 0),
      spend: Number(item.spend ?? item.spent ?? 0),
      spent: Number(item.spent || 0),
      raw_data: item.raw_data || item.rawData || {},
      notes: item.notes || null,
      visible_to_customer: item.visible_to_customer ?? true
    };
  }

  if (key === "customerReportVisibility") {
    return {
      ...base,
      company_id: item.company_id || null,
      section_key: item.section_key || item.sectionKey || "",
      metric_key: item.metric_key || item.metricKey || "__section",
      is_visible: item.is_visible ?? item.isVisible ?? true,
      display_order: Number(item.display_order ?? item.displayOrder ?? 0),
      updated_at: new Date().toISOString()
    };
  }

  if (key === "customerUpdates") {
    return {
      ...base,
      company_id: item.company_id || null,
      title: item.title || "Yeni çalışma notu",
      description: item.description || "",
      update_type: allowedUpdateTypes.includes(item.update_type) ? item.update_type : "Rapor Notu",
      why_it_matters: item.why_it_matters || "",
      next_step: item.next_step || "",
      visible_to_customer: item.visible_to_customer ?? true,
      updated_at: new Date().toISOString()
    };
  }

  if (key === "customerVisibilitySettings") {
    return {
      ...base,
      company_id: item.company_id || null,
      show_campaigns: item.show_campaigns ?? true,
      show_metrics: item.show_metrics ?? true,
      show_budget: item.show_budget ?? true,
      show_spent: item.show_spent ?? true,
      show_leads: item.show_leads ?? true,
      show_strategy_notes: item.show_strategy_notes ?? true,
      show_work_updates: item.show_work_updates ?? true,
      show_files: item.show_files ?? true,
      show_contact_person: item.show_contact_person ?? true,
      updated_at: new Date().toISOString()
    };
  }

  if (key === "customerFiles") {
    const fileUrl = item.file_url || item.fileUrl || item.document_url || item.documentUrl || item.url || "";
    const fileType = item.file_type || item.fileType || item.document_type || item.type || "Diğer";
    return {
      ...base,
      company_id: item.company_id || null,
      title: item.title || "Yeni Dosya",
      description: item.description || "",
      file_url: fileUrl,
      document_url: item.document_url || item.documentUrl || fileUrl,
      file_type: fileType,
      visible_to_customer: item.visible_to_customer ?? true,
      show_in_creative_center: item.show_in_creative_center ?? item.showInCreativeCenter ?? ["Görsel", "Reklam Görseli", "Kreatif"].includes(fileType),
      status: item.status || "Aktif",
      archived_at: item.archived_at || null,
      deleted_at: item.deleted_at || null,
      updated_at: new Date().toISOString()
    };
  }

  if (key === "customerBranding") {
    return {
      ...base,
      company_id: item.company_id || null,
      logo_url: item.logo_url || item.logoUrl || "",
      brand_name: item.brand_name || item.brandName || "",
      primary_color: item.primary_color || item.primaryColor || "#22d3ee",
      secondary_color: item.secondary_color || item.secondaryColor || "#0ea5e9",
      welcome_text: item.welcome_text || item.welcomeText || "",
      updated_at: new Date().toISOString()
    };
  }

  if (key === "monthlyReports") {
    return {
      ...base,
      company_id: item.company_id || null,
      report_month: item.report_month || item.month || new Date().toISOString().slice(0, 7),
      summary: item.summary || "",
      meta_metrics: item.meta_metrics || item.metaMetrics || {},
      google_metrics: item.google_metrics || item.googleMetrics || {},
      social_metrics: item.social_metrics || item.socialMetrics || {},
      ai_interpretation: item.ai_interpretation || item.aiInterpretation || "",
      next_month_recommendations: item.next_month_recommendations || item.nextMonthRecommendations || "",
      status: item.status || "Taslak",
      visible_to_customer: item.visible_to_customer ?? false,
      updated_at: new Date().toISOString()
    };
  }

  if (key === "agencyTasks") {
    const status = item.status || "Yapılacak";
    const now = new Date().toISOString();
    return {
      ...base,
      company_id: item.company_id || null,
      title: item.title || "Yeni görev",
      description: item.description || "",
      status,
      priority: item.priority || "Orta",
      due_date: item.due_date || item.dueDate || null,
      notes: item.notes || "",
      assigned_user_id: item.assigned_user_id || item.assignedUserId || null,
      completed_at: item.completed_at || (status === "Tamamlandı" ? now : null),
      archived_at: item.archived_at || null,
      deleted_at: item.deleted_at || null,
      cancelled_at: item.cancelled_at || (status === "İptal" ? now : null),
      updated_at: new Date().toISOString()
    };
  }

  if (key === "customerDocuments") {
    return {
      ...base,
      company_id: item.company_id || null,
      title: item.title || "Yeni belge",
      document_type: item.document_type || item.documentType || "Diğer",
      description: item.description || "",
      document_url: item.document_url || item.documentUrl || item.file_url || "",
      document_date: item.document_date || item.documentDate || new Date().toISOString().slice(0, 10),
      visible_to_customer: item.visible_to_customer ?? false,
      package_type: item.package_type || item.packageType || null,
      service_fee: Number(item.service_fee ?? item.serviceFee ?? 0),
      ad_budget: Number(item.ad_budget ?? item.adBudget ?? 0),
      included_services: item.included_services || item.includedServices || null,
      next_step: item.next_step || item.nextStep || null,
      status: item.status || "Aktif",
      archived_at: item.archived_at || null,
      deleted_at: item.deleted_at || null,
      updated_at: new Date().toISOString()
    };
  }

  if (key === "reports") {
    return {
      ...base,
      company_id: item.company_id || null,
      campaign_id: item.campaign_id || null,
      report_type: item.report_type || "Genel Dijital Performans Raporu",
      period: item.period || null,
      start_date: item.start_date || item.startDate || null,
      end_date: item.end_date || item.endDate || null,
      platform: item.platform || null,
      metrics: item.metrics || {},
      time_series: item.time_series || item.timeSeries || [],
      summary: item.summary || "",
      customer_note: item.customer_note || item.customerNote || "",
      internal_note: item.internal_note || item.internalNote || null,
      ai_interpretation: item.ai_interpretation || item.aiInterpretation || "",
      visible_to_customer: item.visible_to_customer ?? false,
      archived: item.archived ?? Boolean(item.archived_at),
      archived_at: item.archived_at || null,
      deleted_at: item.deleted_at || null,
      status: item.status || (item.visible_to_customer ? "Yayınlandı" : "Taslak"),
      updated_at: new Date().toISOString()
    };
  }

  if (key === "paymentRecords") {
    const status = item.status || "Bekliyor";
    return {
      ...base,
      company_id: item.company_id || null,
      amount: Number(item.amount || 0),
      due_date: item.due_date || item.dueDate || null,
      payment_date: item.payment_date || item.paymentDate || null,
      status,
      payment_note: item.payment_note || item.paymentNote || "",
      service_period: item.service_period || item.servicePeriod || new Date().toISOString().slice(0, 7),
      visible_to_customer: item.visible_to_customer ?? false,
      archived_at: item.archived_at || null,
      deleted_at: item.deleted_at || null,
      cancelled_at: item.cancelled_at || (status === "İptal" ? new Date().toISOString() : null),
      updated_at: new Date().toISOString()
    };
  }

  if (key === "competitorAnalyses") {
    return {
      ...base,
      company_id: item.company_id || null,
      sector: item.sector || "",
      city: item.city || "",
      district: item.district || "",
      competitors: item.competitors || [],
      ai_summary: item.ai_summary || item.aiSummary || "",
      opportunities: item.opportunities || "",
      recommended_actions: item.recommended_actions || item.recommendedActions || "",
      updated_at: new Date().toISOString()
    };
  }

  if (key === "socialMediaPlans") {
    return {
      ...base,
      company_id: item.company_id || null,
      sector: item.sector || "",
      goal: item.goal || "Bilinirlik",
      platform: item.platform || "Instagram",
      duration: item.duration || "30 gün",
      plan_items: item.plan_items || item.planItems || [],
      notes: item.notes || "",
      updated_at: new Date().toISOString()
    };
  }

  if (key === "agencyExpenses") {
    return {
      ...base,
      title: item.title || "Yeni gider",
      amount: Number(item.amount || 0),
      expense_date: item.expense_date || item.expenseDate || new Date().toISOString().slice(0, 10),
      category: item.category || "Diğer",
      note: item.note || "",
      updated_at: new Date().toISOString()
    };
  }

  if (key === "sectorConfigs") {
    return {
      ...base,
      sector_name: item.sector_name || item.sectorName || "Yeni sektör",
      suggested_crm_fields: item.suggested_crm_fields || item.suggestedCrmFields || [],
      suggested_package_labels: item.suggested_package_labels || item.suggestedPackageLabels || [],
      suggested_report_metrics: item.suggested_report_metrics || item.suggestedReportMetrics || [],
      suggested_content_categories: item.suggested_content_categories || item.suggestedContentCategories || [],
      is_active: item.is_active ?? true,
      updated_at: new Date().toISOString()
    };
  }

  if (key === "systemTestRuns") {
    return {
      ...base,
      score: Number(item.score || 0),
      status: item.status || "Bekliyor",
      total_tests: Number(item.total_tests ?? item.totalTests ?? 0),
      success_count: Number(item.success_count ?? item.successCount ?? 0),
      warning_count: Number(item.warning_count ?? item.warningCount ?? 0),
      error_count: Number(item.error_count ?? item.errorCount ?? 0),
      tester_id: item.tester_id || item.testerId || null,
      tester_name: item.tester_name || item.testerName || "Admin",
      summary: item.summary || "",
      results: item.results || [],
      issues: item.issues || [],
      recommendations: item.recommendations || [],
      export_payload: item.export_payload || item.exportPayload || {},
      deleted_at: item.deleted_at || null,
      updated_at: new Date().toISOString()
    };
  }

  if (key === "systemTestChecklist") {
    return {
      ...base,
      category: item.category || "Genel",
      item_key: item.item_key || item.itemKey || item.id || null,
      title: item.title || "Test maddesi",
      status: item.status || "Bekliyor",
      notes: item.notes || "",
      tester_id: item.tester_id || item.testerId || null,
      tester_name: item.tester_name || item.testerName || "Admin",
      sort_order: Number(item.sort_order ?? item.sortOrder ?? 0),
      last_tested_at: item.last_tested_at || item.lastTestedAt || null,
      deleted_at: item.deleted_at || null,
      updated_at: new Date().toISOString()
    };
  }

  if (key === "activityLogs") {
    return {
      ...base,
      actor_user_id: item.actor_user_id || item.user_id || null,
      company_id: item.company_id || null,
      actor_name: item.actor_name || item.user_name || "Sistem",
      role: item.role || "system",
      action: item.action || item.action_type || "Güncelleme",
      action_type: item.action_type || item.action || "Güncelleme",
      entity: item.entity || item.module || "Sistem",
      module: item.module || item.entity || "Sistem",
      entity_id: item.entity_id || null,
      details: item.details || {},
      old_value: item.old_value || item.details?.old_value || item.details?.oldValue || null,
      new_value: item.new_value || item.details?.new_value || item.details?.newValue || null,
      status: item.status || (item.is_seen ? "Görüldü" : "Görülmedi"),
      is_seen: item.is_seen ?? item.status === "Görüldü",
      is_critical: item.is_critical ?? false,
      archived_at: item.archived_at || null,
      deleted_at: item.deleted_at || null,
      updated_at: new Date().toISOString()
    };
  }

  return { ...item, ...base };
}

async function upsertItems(key: keyof typeof tables, items: any[] = []) {
  if (!items.length || key === "users") return [];
  const table = tables[key];
  const normalized = items.map((item) => normalizeRecord(key, item));
  const deduped = key === "paymentRecords"
    ? normalized.filter((item: any, index: number, list: any[]) => {
        const signature = [item.company_id, item.service_period, item.due_date, item.amount, item.status].join("|");
        return list.findIndex((candidate: any) => [candidate.company_id, candidate.service_period, candidate.due_date, candidate.amount, candidate.status].join("|") === signature) === index;
      })
    : normalized;
  const records = deduped.filter((item: any) => {
    if (["campaigns", "campaignMetrics", "metaAdsetMetrics", "metaAdMetrics", "metaConversionEvents", "metaAnalysisSnapshots", "customerReportVisibility", "customerUpdates", "customerVisibilitySettings", "customerFiles", "customerBranding", "monthlyReports", "customerDocuments", "paymentRecords", "reports", "competitorAnalyses", "socialMediaPlans"].includes(key)) {
      return Boolean(item.company_id);
    }
    return true;
  });
  if (!records.length) return [];

  const conflictTarget = key === "customerVisibilitySettings" ? "company_id" : key === "customerReportVisibility" ? "company_id,section_key,metric_key" : key === "systemTestChecklist" ? "item_key" : "id";
  const stripOptionalColumns = (record: any) => {
    const copy = { ...record };
    if (key === "companies") delete copy.notes;
    if (key === "campaigns") {
      delete copy.customer_id;
      delete copy.daily_budget;
      delete copy.total_budget;
      delete copy.spent_budget;
      delete copy.internal_notes;
      delete copy.visible_to_customer;
      delete copy.archived_at;
      delete copy.deleted_at;
    }
    if (key === "campaignMetrics") {
      delete copy.messages;
      delete copy.visible_to_customer;
      delete copy.period;
    }
    if (key === "customerUpdates") {
      delete copy.why_it_matters;
      delete copy.next_step;
    }
    if (key === "agencyTasks") {
      delete copy.description;
      delete copy.completed_at;
      delete copy.archived_at;
      delete copy.deleted_at;
      delete copy.cancelled_at;
    }
    if (key === "paymentRecords") {
      delete copy.archived_at;
      delete copy.deleted_at;
      delete copy.cancelled_at;
    }
    if (key === "customerFiles" || key === "customerDocuments" || key === "reports") {
      delete copy.status;
      delete copy.archived_at;
      delete copy.deleted_at;
      if (key === "reports") delete copy.ai_interpretation;
    }
    if (key === "activityLogs") {
      delete copy.status;
      delete copy.is_seen;
      delete copy.archived_at;
      delete copy.deleted_at;
      delete copy.is_critical;
      delete copy.module;
      delete copy.action_type;
      delete copy.old_value;
      delete copy.new_value;
      delete copy.updated_at;
    }
    if (key === "leads") {
      delete copy.digital_maturity_score;
      delete copy.lead_heat_score;
      delete copy.ai_analysis;
      delete copy.proposal_history;
      delete copy.city;
      delete copy.district;
      delete copy.sector;
      delete copy.address;
      delete copy.google_rating;
      delete copy.google_review_count;
      delete copy.google_place_id;
      delete copy.source_url;
      delete copy.competitor_notes;
      delete copy.local_opportunity_notes;
      delete copy.deleted_at;
      delete copy.rejected_at;
      delete copy.rejection_reason;
    }
    return copy;
  };

  try {
    return await supabaseRest(`${table}?on_conflict=${conflictTarget}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(records)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase kaydetme hatası.";
    if (["metaAdsetMetrics", "metaAdMetrics", "metaConversionEvents", "metaAnalysisSnapshots", "customerReportVisibility", "customerBranding", "monthlyReports", "agencyTasks", "customerDocuments", "paymentRecords", "reports", "competitorAnalyses", "socialMediaPlans", "agencyExpenses", "sectorConfigs", "systemTestRuns", "systemTestChecklist", "activityLogs"].includes(key) && (message.includes("schema cache") || message.includes("relation") || message.includes("table"))) {
      console.warn(`${table} tablosu canlı şemada bulunamadı; migration uygulanana kadar bu modül atlandı.`);
      return [];
    }
    if (message.includes("schema cache") || message.includes("column")) {
      const fallbackRecords = records.map(stripOptionalColumns);
      return await supabaseRest(`${table}?on_conflict=${conflictTarget}`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(fallbackRecords)
      });
    }
    console.error(`${table} kaydetme Supabase hatası:`, message);
    throw error;
  }
}

export async function GET() {
  if (!(await requireStaff())) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const [companies, users, leads, campaigns, campaignMetrics, metaAdsetMetrics, metaAdMetrics, metaConversionEvents, metaAnalysisSnapshots, customerReportVisibility, customerUpdates, customerVisibilitySettings, customerFiles, media, customerBranding, monthlyReports, agencyTasks, customerDocuments, paymentRecords, reports, competitorAnalyses, socialMediaPlans, agencyExpenses, sectorConfigs, systemTestRuns, systemTestChecklist, activityLogs] =
    await Promise.all([
      supabaseRest("companies?select=*&order=created_at.desc"),
      supabaseRest("users?deleted_at=is.null&select=*&order=created_at.desc"),
      supabaseRest("leads?select=*&order=created_at.desc"),
      supabaseRest("campaigns?select=*&order=created_at.desc"),
      supabaseRest("campaign_metrics?select=*&order=date.desc"),
      supabaseRest("meta_adset_metrics?select=*&order=date.desc").catch(() => []),
      supabaseRest("meta_ad_metrics?select=*&order=date.desc").catch(() => []),
      supabaseRest("meta_conversion_events?select=*&order=date.desc").catch(() => []),
      supabaseRest("meta_analysis_snapshots?select=*&order=created_at.desc").catch(() => []),
      supabaseRest("customer_report_visibility?select=*&order=display_order.asc").catch(() => []),
      supabaseRest("customer_updates?select=*&order=created_at.desc"),
      supabaseRest("customer_visibility_settings?select=*&order=updated_at.desc"),
      supabaseRest("customer_files?select=*&order=uploaded_at.desc"),
      supabaseRest("media_files?select=*&order=uploaded_at.desc"),
      supabaseRest("customer_branding?select=*&order=updated_at.desc").catch(() => []),
      supabaseRest("monthly_reports?select=*&order=updated_at.desc").catch(() => []),
      supabaseRest("agency_tasks?select=*&order=due_date.asc").catch(() => []),
      supabaseRest("customer_documents?select=*&order=document_date.desc").catch(() => []),
      supabaseRest("payment_records?select=*&order=due_date.desc").catch(() => []),
      supabaseRest("reports?select=*&order=created_at.desc").catch(() => []),
      supabaseRest("competitor_analyses?select=*&order=updated_at.desc").catch(() => []),
      supabaseRest("social_media_plans?select=*&order=updated_at.desc").catch(() => []),
      supabaseRest("agency_expenses?select=*&order=expense_date.desc").catch(() => []),
      supabaseRest("sector_configs?select=*&order=sector_name.asc").catch(() => []),
      supabaseRest("system_test_runs?deleted_at=is.null&select=*&order=created_at.desc").catch(() => []),
      supabaseRest("system_test_checklist?deleted_at=is.null&select=*&order=sort_order.asc").catch(() => []),
      supabaseRest("activity_logs?deleted_at=is.null&select=*&order=created_at.desc&limit=500").catch(() => [])
    ]);

  return NextResponse.json({
    companies,
    users,
    leads,
    campaigns,
    campaignMetrics,
    metaAdsetMetrics,
    metaAdMetrics,
    metaConversionEvents,
    metaAnalysisSnapshots,
    customerReportVisibility,
    customerUpdates,
    customerVisibilitySettings,
    customerFiles,
    media,
    customerBranding,
    monthlyReports,
    agencyTasks,
    customerDocuments,
    paymentRecords,
    reports,
    competitorAnalyses,
    socialMediaPlans,
    agencyExpenses,
    sectorConfigs,
    systemTestRuns,
    systemTestChecklist,
    activityLogs
  });
}

export async function PUT(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  const payload = await request.json();
  try {
    await Promise.all([
      upsertItems("companies", payload.companies),
      upsertItems("leads", payload.leads),
      upsertItems("campaigns", payload.campaigns),
      upsertItems("campaignMetrics", payload.campaignMetrics),
      upsertItems("customerReportVisibility", payload.customerReportVisibility),
      upsertItems("customerUpdates", payload.customerUpdates),
      upsertItems("customerVisibilitySettings", payload.customerVisibilitySettings),
      upsertItems("customerFiles", payload.customerFiles),
      upsertItems("customerBranding", payload.customerBranding),
      upsertItems("monthlyReports", payload.monthlyReports),
      upsertItems("agencyTasks", payload.agencyTasks),
      upsertItems("customerDocuments", payload.customerDocuments),
      upsertItems("paymentRecords", payload.paymentRecords),
      upsertItems("reports", payload.reports),
      upsertItems("competitorAnalyses", payload.competitorAnalyses),
      upsertItems("socialMediaPlans", payload.socialMediaPlans),
      upsertItems("agencyExpenses", payload.agencyExpenses),
      upsertItems("sectorConfigs", payload.sectorConfigs),
      upsertItems("systemTestRuns", payload.systemTestRuns),
      upsertItems("systemTestChecklist", payload.systemTestChecklist),
      upsertItems("activityLogs", payload.activityLogs)
    ]);

    await recordActivity({ session, action: "Güncelleme", entity: "Kontrol Merkezi", details: { message: "Kontrol merkezi kayıtları güncellendi" } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    return NextResponse.json(
      {
        error: safeError.title,
        supabaseError: safeError.detail,
        possibleCause: "Service role kullanılıyor. Hata devam ediyorsa canlı Supabase şeması, RLS force ayarı veya tablo izinleri kontrol edilmelidir."
      },
      { status: 500 }
    );
  }
}
