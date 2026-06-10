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
  customerUpdates: "customer_updates",
  customerVisibilitySettings: "customer_visibility_settings",
  customerFiles: "customer_files",
  media: "media_files",
  customerBranding: "customer_branding",
  monthlyReports: "monthly_reports",
  agencyTasks: "agency_tasks",
  customerDocuments: "customer_documents",
  paymentRecords: "payment_records",
  competitorAnalyses: "competitor_analyses",
  socialMediaPlans: "social_media_plans",
  agencyExpenses: "agency_expenses",
  sectorConfigs: "sector_configs"
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
    return {
      ...base,
      company_id: item.company_id || null,
      name: item.name || "Yeni Kampanya",
      platform: item.platform || "Meta",
      objective: item.objective || "Form",
      status: item.status || "Hazırlanıyor",
      start_date: item.start_date || null,
      end_date: item.end_date || null,
      budget: Number(item.budget || 0),
      spent: Number(item.spent || 0),
      notes: item.notes || null,
      visible_to_customer: item.visible_to_customer ?? true,
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
      notes: item.notes || item.internalNotes || "",
      follow_up_date: item.follow_up_date || item.followUpDate || null,
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
      spent: Number(item.spent || 0),
      notes: item.notes || null,
      visible_to_customer: item.visible_to_customer ?? true
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
    return {
      ...base,
      company_id: item.company_id || null,
      title: item.title || "Yeni Dosya",
      description: item.description || "",
      file_url: item.file_url || item.url || "",
      file_type: item.file_type || item.type || "file",
      visible_to_customer: item.visible_to_customer ?? true
    };
  }

  if (key === "customerBranding") {
    return {
      ...base,
      company_id: item.company_id || null,
      logo_url: item.logo_url || item.logoUrl || "",
      brand_name: item.brand_name || item.brandName || "",
      primary_color: item.primary_color || item.primaryColor || "#22d3ee",
      secondary_color: item.secondary_color || item.secondaryColor || "#0f172a",
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
    return {
      ...base,
      company_id: item.company_id || null,
      title: item.title || "Yeni görev",
      status: item.status || "Yapılacak",
      priority: item.priority || "Orta",
      due_date: item.due_date || item.dueDate || null,
      notes: item.notes || "",
      assigned_user_id: item.assigned_user_id || item.assignedUserId || null,
      updated_at: new Date().toISOString()
    };
  }

  if (key === "customerDocuments") {
    return {
      ...base,
      company_id: item.company_id || null,
      title: item.title || "Yeni belge",
      document_type: item.document_type || item.documentType || "Diğer",
      document_url: item.document_url || item.documentUrl || item.file_url || "",
      document_date: item.document_date || item.documentDate || new Date().toISOString().slice(0, 10),
      visible_to_customer: item.visible_to_customer ?? false,
      updated_at: new Date().toISOString()
    };
  }

  if (key === "paymentRecords") {
    return {
      ...base,
      company_id: item.company_id || null,
      amount: Number(item.amount || 0),
      due_date: item.due_date || item.dueDate || null,
      payment_date: item.payment_date || item.paymentDate || null,
      status: item.status || "Bekliyor",
      payment_note: item.payment_note || item.paymentNote || "",
      service_period: item.service_period || item.servicePeriod || new Date().toISOString().slice(0, 7),
      visible_to_customer: item.visible_to_customer ?? false,
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

  return { ...item, ...base };
}

async function upsertItems(key: keyof typeof tables, items: any[] = []) {
  if (!items.length || key === "users") return [];
  const table = tables[key];
  const records = items.map((item) => normalizeRecord(key, item)).filter((item: any) => {
    if (["campaigns", "campaignMetrics", "customerUpdates", "customerVisibilitySettings", "customerFiles", "customerBranding", "monthlyReports", "customerDocuments", "paymentRecords", "competitorAnalyses", "socialMediaPlans"].includes(key)) {
      return Boolean(item.company_id);
    }
    return true;
  });
  if (!records.length) return [];

  const conflictTarget = key === "customerVisibilitySettings" ? "company_id" : "id";
  const stripOptionalColumns = (record: any) => {
    const copy = { ...record };
    if (key === "companies") delete copy.notes;
    if (key === "campaigns") delete copy.visible_to_customer;
    if (key === "campaignMetrics") {
      delete copy.messages;
      delete copy.visible_to_customer;
      delete copy.period;
      delete copy.source;
    }
    if (key === "customerUpdates") {
      delete copy.why_it_matters;
      delete copy.next_step;
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
    if (["customerBranding", "monthlyReports", "agencyTasks", "customerDocuments", "paymentRecords", "competitorAnalyses", "socialMediaPlans", "agencyExpenses", "sectorConfigs"].includes(key) && (message.includes("schema cache") || message.includes("relation") || message.includes("table"))) {
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

  const [companies, users, leads, campaigns, campaignMetrics, customerUpdates, customerVisibilitySettings, customerFiles, media, customerBranding, monthlyReports, agencyTasks, customerDocuments, paymentRecords, competitorAnalyses, socialMediaPlans, agencyExpenses, sectorConfigs] =
    await Promise.all([
      supabaseRest("companies?select=*&order=created_at.desc"),
      supabaseRest("users?deleted_at=is.null&select=*&order=created_at.desc"),
      supabaseRest("leads?select=*&order=created_at.desc"),
      supabaseRest("campaigns?select=*&order=created_at.desc"),
      supabaseRest("campaign_metrics?select=*&order=date.desc"),
      supabaseRest("customer_updates?select=*&order=created_at.desc"),
      supabaseRest("customer_visibility_settings?select=*&order=updated_at.desc"),
      supabaseRest("customer_files?select=*&order=uploaded_at.desc"),
      supabaseRest("media_files?select=*&order=uploaded_at.desc"),
      supabaseRest("customer_branding?select=*&order=updated_at.desc").catch(() => []),
      supabaseRest("monthly_reports?select=*&order=updated_at.desc").catch(() => []),
      supabaseRest("agency_tasks?select=*&order=due_date.asc").catch(() => []),
      supabaseRest("customer_documents?select=*&order=document_date.desc").catch(() => []),
      supabaseRest("payment_records?select=*&order=due_date.desc").catch(() => []),
      supabaseRest("competitor_analyses?select=*&order=updated_at.desc").catch(() => []),
      supabaseRest("social_media_plans?select=*&order=updated_at.desc").catch(() => []),
      supabaseRest("agency_expenses?select=*&order=expense_date.desc").catch(() => []),
      supabaseRest("sector_configs?select=*&order=sector_name.asc").catch(() => [])
    ]);

  return NextResponse.json({
    companies,
    users,
    leads,
    campaigns,
    campaignMetrics,
    customerUpdates,
    customerVisibilitySettings,
    customerFiles,
    media,
    customerBranding,
    monthlyReports,
    agencyTasks,
    customerDocuments,
    paymentRecords,
    competitorAnalyses,
    socialMediaPlans,
    agencyExpenses,
    sectorConfigs
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
      upsertItems("customerUpdates", payload.customerUpdates),
      upsertItems("customerVisibilitySettings", payload.customerVisibilitySettings),
      upsertItems("customerFiles", payload.customerFiles),
      upsertItems("customerBranding", payload.customerBranding),
      upsertItems("monthlyReports", payload.monthlyReports),
      upsertItems("agencyTasks", payload.agencyTasks),
      upsertItems("customerDocuments", payload.customerDocuments),
      upsertItems("paymentRecords", payload.paymentRecords),
      upsertItems("competitorAnalyses", payload.competitorAnalyses),
      upsertItems("socialMediaPlans", payload.socialMediaPlans),
      upsertItems("agencyExpenses", payload.agencyExpenses),
      upsertItems("sectorConfigs", payload.sectorConfigs)
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
