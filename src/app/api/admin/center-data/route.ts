import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

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
  media: "media_files"
} as const;
const allowedUpdateTypes = ["Yapılan Çalışma", "Reklam Güncellemesi", "Rapor Notu", "Strateji Notu", "Uyarı", "Başarı", "Diğer"];

async function requireStaff() {
  const session = await getSession();
  if (!isStaffRole(session?.role)) {
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
      digital_maturity_score: Number(item.digital_maturity_score || 0),
      lead_heat_score: Number(item.lead_heat_score || 0),
      ai_analysis: item.ai_analysis || {},
      proposal_history: item.proposal_history || [],
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

  return { ...item, ...base };
}

async function upsertItems(key: keyof typeof tables, items: any[] = []) {
  if (!items.length || key === "users") return [];
  const table = tables[key];
  const records = items.map((item) => normalizeRecord(key, item)).filter((item: any) => {
    if (["campaigns", "campaignMetrics", "customerUpdates", "customerVisibilitySettings", "customerFiles"].includes(key)) {
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

  const [companies, users, leads, campaigns, campaignMetrics, customerUpdates, customerVisibilitySettings, customerFiles, media] =
    await Promise.all([
      supabaseRest("companies?select=*&order=created_at.desc"),
      supabaseRest("users?select=*&order=created_at.desc"),
      supabaseRest("leads?select=*&order=created_at.desc"),
      supabaseRest("campaigns?select=*&order=created_at.desc"),
      supabaseRest("campaign_metrics?select=*&order=date.desc"),
      supabaseRest("customer_updates?select=*&order=created_at.desc"),
      supabaseRest("customer_visibility_settings?select=*&order=updated_at.desc"),
      supabaseRest("customer_files?select=*&order=uploaded_at.desc"),
      supabaseRest("media_files?select=*&order=uploaded_at.desc")
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
    media
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
      upsertItems("customerFiles", payload.customerFiles)
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
