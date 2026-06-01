import { NextResponse } from "next/server";
import {
  createSupabaseAuthUser,
  findSupabaseAuthUserByEmail,
  getSession,
  isStaffRole,
  updateSupabaseAuthUser
} from "@/lib/auth";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { recordActivity } from "@/lib/activity-log";

const demoEmail = "demo@hkdijital.com.tr";
const logPrefix = "[demo-customer]";

const requiredSchema = [
  ["companies", "id,name,sector,city,website,instagram,phone,email,status"],
  ["customers", "id,company_id,user_id,full_name,email,phone,status"],
  ["users", "id,auth_user_id,email,full_name,role,company_id,is_active"],
  ["reports", "id,company_id,campaign_id,report_type,metrics,time_series,raw_extracted_data,customer_note,visible_to_customer"],
  ["report_updates", "id,report_id,company_id,update_date,title,customer_note,next_action,is_visible_to_customer,is_pinned,created_by"],
  ["report_interpretations", "id,report_id,company_id,generated_by_user_id,interpretation_text,provider"],
  ["customer_visibility_settings", "id,company_id,show_campaigns,show_metrics,show_budget,show_spent,show_leads,show_strategy_notes,show_work_updates,show_files,show_contact_person"],
  ["campaigns", "id,company_id,name,platform,objective,status,start_date,budget,spent,notes"],
  ["campaign_metrics", "id,campaign_id,company_id,date,impressions,reach,clicks,leads,conversions,spent,ctr,cpc,cpm,cost_per_lead,notes"],
  ["customer_updates", "id,company_id,title,description,update_type,visible_to_customer"],
  ["customer_files", "id,company_id,title,description,file_url,file_type,visible_to_customer"]
] as const;

function diagnosticLog(stage: string, detail?: Record<string, unknown>) {
  console.info(`${logPrefix} ${stage}`, detail || {});
}

async function verifyRequiredSchema() {
  for (const [table, columns] of requiredSchema) {
    try {
      await supabaseRest(`${table}?select=${columns}&limit=0`);
      diagnosticLog("Şema doğrulandı", { table });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${logPrefix} Şema doğrulama başarısız`, { table, columns, message });
      throw new Error(`Supabase şema kontrolü başarısız (${table}): ${message}`);
    }
  }
}

function createTemporaryPassword() {
  return `HkDemo-${crypto.randomUUID().slice(0, 8)}!`;
}

async function upsertCompany() {
  diagnosticLog("Firma kontrol ediliyor");
  const existing = await supabaseRest<any[]>("companies?name=eq.Demo%20Müşteri&select=*&limit=1");
  if (existing[0]) {
    diagnosticLog("Mevcut firma kullanılacak", { companyId: existing[0].id });
    return existing[0];
  }

  diagnosticLog("Firma oluşturuluyor");
  const rows = await supabaseRest<any[]>("companies", {
    method: "POST",
    body: JSON.stringify({
      name: "Demo Müşteri",
      sector: "Kafe",
      city: "Manisa",
      website: "https://www.hkdijital.com.tr",
      instagram: "@hkdijital",
      phone: "+90 555 000 00 00",
      email: demoEmail,
      status: "Aktif"
    })
  });
  diagnosticLog("Firma oluşturuldu", { companyId: rows[0]?.id });
  return rows[0];
}

async function upsertCustomerUser(companyId: string, demoPassword: string) {
  diagnosticLog("Auth kullanıcısı kontrol ediliyor", { email: demoEmail });
  let authUser = await findSupabaseAuthUserByEmail(demoEmail);
  if (authUser) {
    diagnosticLog("Mevcut auth kullanıcısı güncelleniyor", { authUserId: authUser.id });
    authUser = await updateSupabaseAuthUser(authUser.id, {
      email: demoEmail,
      password: demoPassword,
      fullName: "Demo Müşteri"
    });
  } else {
    diagnosticLog("Auth kullanıcısı oluşturuluyor", { email: demoEmail });
    authUser = await createSupabaseAuthUser({
      email: demoEmail,
      password: demoPassword,
      fullName: "Demo Müşteri"
    });
  }
  diagnosticLog("Auth kullanıcısı hazır", { authUserId: authUser.id });

  diagnosticLog("Public kullanıcı profili kontrol ediliyor");
  const byEmail = await supabaseRest<any[]>(`users?email=eq.${encodeURIComponent(demoEmail)}&select=*&limit=1`);
  const payload = {
    auth_user_id: authUser.id,
    email: demoEmail,
    full_name: "Demo Müşteri",
    role: "customer",
    company_id: companyId,
    is_active: true,
    updated_at: new Date().toISOString()
  };

  if (byEmail[0]) {
    const rows = await supabaseRest<any[]>(`users?id=eq.${byEmail[0].id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    diagnosticLog("Public kullanıcı profili güncellendi", { userId: rows[0]?.id });
    return rows[0];
  }

  const rows = await supabaseRest<any[]>("users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  diagnosticLog("Public kullanıcı profili oluşturuldu", { userId: rows[0]?.id });
  return rows[0];
}

async function ensureVisibility(companyId: string) {
  const rows = await supabaseRest<any[]>("customer_visibility_settings?on_conflict=company_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      company_id: companyId,
      show_campaigns: true,
      show_metrics: true,
      show_budget: true,
      show_spent: true,
      show_leads: true,
      show_strategy_notes: true,
      show_work_updates: true,
      show_files: true,
      show_contact_person: true,
      updated_at: new Date().toISOString()
    })
  });
  return rows[0];
}

async function upsertCampaign(companyId: string) {
  const existing = await supabaseRest<any[]>(
    `campaigns?company_id=eq.${companyId}&name=eq.Demo%20Meta%20Mesaj%20Kampanyası&select=*&limit=1`
  );
  if (existing[0]) return existing[0];

  const rows = await supabaseRest<any[]>("campaigns", {
    method: "POST",
    body: JSON.stringify({
      company_id: companyId,
      name: "Demo Meta Mesaj Kampanyası",
      platform: "Meta",
      objective: "Mesaj",
      status: "Aktif",
      start_date: new Date().toISOString().slice(0, 10),
      budget: 15000,
      spent: 4320,
      notes: "Müşteri paneli testi için hazırlanmış mesaj odaklı örnek kampanya."
    })
  });
  return rows[0];
}

async function createMetric(companyId: string, campaignId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await supabaseRest<any[]>(`campaign_metrics?company_id=eq.${companyId}&campaign_id=eq.${campaignId}&date=eq.${today}&select=*&limit=1`);
  if (existing[0]) {
    diagnosticLog("Mevcut demo metriği kullanılacak", { metricId: existing[0].id });
    return existing[0];
  }
  const rows = await supabaseRest<any[]>("campaign_metrics", {
    method: "POST",
    body: JSON.stringify({
      campaign_id: campaignId,
      company_id: companyId,
      date: today,
      impressions: 18450,
      reach: 11230,
      clicks: 386,
      leads: 31,
      conversions: 8,
      spent: 4320,
      ctr: 2.09,
      cpc: 11.19,
      cpm: 234.15,
      cost_per_lead: 139.35,
      notes: "Demo metrik: lead performansı müşteri panelinde gösterilir."
    })
  });
  return rows[0];
}

async function createUpdates(companyId: string) {
  const existing = await supabaseRest<any[]>(`customer_updates?company_id=eq.${companyId}&select=*&limit=10`);
  const samples = [
    {
      company_id: companyId,
      title: "Kampanya hedef kitlesi düzenlendi",
      description: "Manisa merkez ve yakın ilçelerde özel gün pastası arayan kullanıcılar için hedef kitle güncellendi. Neden önemli: Reklamın daha ilgili kişilere ulaşmasına yardımcı olur. Sıradaki adım: En iyi dönüşüm getiren kreatifler 3 gün daha izlenecek.",
      update_type: "Reklam Güncellemesi",
      visible_to_customer: true
    },
    {
      company_id: companyId,
      title: "Mesaj karşılama metni önerildi",
      description: "Instagram DM üzerinden gelen talepler için kısa ve net cevap akışı hazırlandı. Neden önemli: Gelen potansiyel müşterilerin daha hızlı siparişe yönlenmesini sağlar. Sıradaki adım: Sık sorulan sorulara göre cevap şablonu genişletilecek.",
      update_type: "Strateji Notu",
      visible_to_customer: true
    }
  ].filter((sample) => !existing.some((item) => item.title === sample.title));
  if (!samples.length) return existing;
  const created = await supabaseRest<any[]>("customer_updates", {
    method: "POST",
    body: JSON.stringify(samples)
  });
  return [...created, ...existing];
}

async function createCustomerFile(companyId: string) {
  const existing = await supabaseRest<any[]>(`customer_files?company_id=eq.${companyId}&title=eq.Demo%20Müşteri%20Raporu&select=*&limit=1`);
  if (existing[0]) return existing[0];
  const rows = await supabaseRest<any[]>("customer_files", {
    method: "POST",
    body: JSON.stringify({
      company_id: companyId,
      title: "Demo Müşteri Raporu",
      description: "Müşteri paneli dosya görünürlüğünü test etmek için demo rapor kaydı.",
      file_url: "https://www.hkdijital.com.tr",
      file_type: "link",
      visible_to_customer: true
    })
  });
  return rows[0];
}

async function ensureCustomer(companyId: string, userId: string) {
  diagnosticLog("Müşteri kaydı kontrol ediliyor", { companyId, userId });
  const existing = await supabaseRest<any[]>(`customers?company_id=eq.${companyId}&select=*&limit=1`);
  const payload = { company_id: companyId, user_id: userId, full_name: "Demo Müşteri", email: demoEmail, phone: "+90 555 000 00 00", status: "Aktif", updated_at: new Date().toISOString() };
  if (existing[0]) {
    const customer = (await supabaseRest<any[]>(`customers?id=eq.${existing[0].id}`, { method: "PATCH", body: JSON.stringify(payload) }))[0];
    diagnosticLog("Müşteri kaydı güncellendi", { customerId: customer?.id });
    return customer;
  }
  const customer = (await supabaseRest<any[]>("customers", { method: "POST", body: JSON.stringify(payload) }))[0];
  diagnosticLog("Müşteri kaydı oluşturuldu", { customerId: customer?.id });
  return customer;
}

async function ensureReports(companyId: string, campaignId: string) {
  diagnosticLog("Demo raporları kontrol ediliyor", { companyId, campaignId });
  const existing = await supabaseRest<any[]>(`reports?company_id=eq.${companyId}&select=id,report_type`);
  const samples = [
    { company_id: companyId, campaign_id: campaignId, report_type: "Meta Reklam Raporu", platform: "Meta", period: "Mayıs 2026", start_date: "2026-05-01", end_date: "2026-05-31", metrics: { impressions: 18450, reach: 11230, clicks: 386, messages: 31, leads: 31, spent: 4320, ctr: 2.09, cpc: 11.19, cpm: 234.15, cost_per_result: 139.35 }, time_series: [{ date: "2026-05-07", impressions: 4100, reach: 3000, clicks: 82, spent: 980, leads: 6 }, { date: "2026-05-14", impressions: 4500, reach: 3250, clicks: 94, spent: 1060, leads: 8 }, { date: "2026-05-21", impressions: 4780, reach: 3440, clicks: 101, spent: 1110, leads: 8 }, { date: "2026-05-31", impressions: 5070, reach: 3540, clicks: 109, spent: 1170, leads: 9 }], customer_note: "Mesaj odaklı reklamlar düzenli talep oluşturmaya devam ediyor.", visible_to_customer: true },
    { company_id: companyId, report_type: "Google Ads Raporu", platform: "Google", period: "Mayıs 2026", start_date: "2026-05-01", end_date: "2026-05-31", metrics: { impressions: 9280, clicks: 412, ctr: 4.44, average_cpc: 8.75, cost: 3605, spent: 3605, conversions: 24, leads: 24, conversion_rate: 5.82, cost_per_conversion: 150.21, search_terms_note: "Yerel arama terimleri daha yüksek ilgi gösterdi.", keyword_note: "Marka ve hizmet odaklı kelimeler izleniyor." }, time_series: [{ date: "2026-05-07", impressions: 2100, clicks: 88, spent: 760, conversions: 4, leads: 4 }, { date: "2026-05-14", impressions: 2240, clicks: 98, spent: 850, conversions: 6, leads: 6 }, { date: "2026-05-21", impressions: 2370, clicks: 107, spent: 930, conversions: 6, leads: 6 }, { date: "2026-05-31", impressions: 2570, clicks: 119, spent: 1065, conversions: 8, leads: 8 }], customer_note: "Google aramalarından gelen ziyaretçiler kontrollü maliyetle dönüşüm oluşturuyor.", visible_to_customer: true },
    { company_id: companyId, report_type: "Sosyal Medya Yönetimi Raporu", platform: "Instagram", period: "Mayıs 2026", start_date: "2026-05-01", end_date: "2026-05-31", metrics: { posts: 8, reels: 5, stories: 22, reach: 14600, impressions: 28750, profile_visits: 980, followers_growth: 126, engagement: 1450, likes: 1180, comments: 92, saves: 104, shares: 74, messages: 38, content_note: "Kısa video içerikleri daha fazla erişim sağladı.", best_content: "Yeni ürün tanıtım Reels videosu" }, time_series: [{ date: "2026-05-07", impressions: 6200, reach: 3300, engagement: 290, followers_growth: 22 }, { date: "2026-05-14", impressions: 6850, reach: 3500, engagement: 340, followers_growth: 31 }, { date: "2026-05-21", impressions: 7420, reach: 3790, engagement: 385, followers_growth: 35 }, { date: "2026-05-31", impressions: 8280, reach: 4010, engagement: 435, followers_growth: 38 }], customer_note: "Kısa video içerikleri görünürlük ve profil ziyaretleri açısından öne çıktı.", visible_to_customer: true },
    { company_id: companyId, report_type: "Genel Dijital Performans Raporu", platform: "Tüm Kanallar", period: "Mayıs 2026", start_date: "2026-05-01", end_date: "2026-05-31", metrics: { impressions: 56480, reach: 25830, clicks: 798, leads: 55, spent: 7925, summary: "Reklam ve sosyal medya çalışmaları birlikte değerlendirildi." }, time_series: [{ date: "2026-05-07", impressions: 12400, reach: 6300, clicks: 170, spent: 1740, leads: 10 }, { date: "2026-05-14", impressions: 13590, reach: 6750, clicks: 192, spent: 1910, leads: 14 }, { date: "2026-05-21", impressions: 14570, reach: 7230, clicks: 208, spent: 2040, leads: 14 }, { date: "2026-05-31", impressions: 15920, reach: 7550, clicks: 228, spent: 2235, leads: 17 }], customer_note: "Tüm kanallar birlikte değerlendirildiğinde düzenli görünürlük ve talep akışı görülüyor.", visible_to_customer: true }
  ].filter((sample) => !existing.some((report) => report.report_type === sample.report_type));
  if (!samples.length) return existing;
  diagnosticLog("Eksik demo raporları oluşturuluyor", { count: samples.length });
  const created = await supabaseRest<any[]>("reports", {
    method: "POST",
    body: JSON.stringify(samples)
  });
  diagnosticLog("Demo raporları oluşturuldu", { count: created.length });
  return [...created, ...existing];
}

async function ensureReportExtras(companyId: string, reports: any[], userId: string) {
  diagnosticLog("Rapor güncellemeleri ve yorumları kontrol ediliyor", { companyId, reportCount: reports.length });
  const updates = await supabaseRest<any[]>(`report_updates?company_id=eq.${companyId}&select=id,title`);
  const interpretations = await supabaseRest<any[]>(`report_interpretations?company_id=eq.${companyId}&select=id,report_id`);
  const primary = reports.find((report) => report.report_type === "Meta Reklam Raporu") || reports[0];
  if (primary && !updates.length) {
    diagnosticLog("Demo rapor güncellemeleri oluşturuluyor", { reportId: primary.id });
    await supabaseRest("report_updates", { method: "POST", body: JSON.stringify([
      { report_id: primary.id, company_id: companyId, update_date: "2026-05-08", title: "İlk hafta kontrolü", customer_note: "Reklam gösterimleri düzenli ilerliyor.", next_action: "Mesaj getiren içerikler karşılaştırılacak.", is_visible_to_customer: true, created_by: userId },
      { report_id: primary.id, company_id: companyId, update_date: "2026-05-18", title: "Hedef kitle iyileştirmesi", customer_note: "Daha ilgili kullanıcılara ulaşmak için hedef kitle düzenlendi.", next_action: "Yeni hedef kitle üç gün izlenecek.", is_visible_to_customer: true, is_pinned: true, created_by: userId },
      { report_id: primary.id, company_id: companyId, update_date: "2026-05-28", title: "Dönem sonu değerlendirmesi", customer_note: "Talep akışı korunurken maliyetler kontrollü ilerledi.", next_action: "Bir sonraki ay en iyi çalışan içerik ölçeklenecek.", is_visible_to_customer: true, created_by: userId }
    ]) });
  }
  const missing = reports.filter((report) => !interpretations.some((item) => item.report_id === report.id)).map((report) => ({ report_id: report.id, company_id: companyId, generated_by_user_id: userId, provider: "Demo", interpretation_text: `${report.period} döneminde ${report.report_type.toLocaleLowerCase("tr-TR")} düzenli ilerlemiştir. Görünürlük ve etkileşim değerleri izlenmeye devam edilmelidir. Bir sonraki adımda en iyi çalışan içerik veya reklam grubunda kontrollü iyileştirme önerilir.` }));
  if (missing.length) {
    diagnosticLog("Demo rapor yorumları oluşturuluyor", { count: missing.length });
    await supabaseRest("report_interpretations", { method: "POST", body: JSON.stringify(missing) });
  }
}

export async function POST() {
  const session = await getSession();
  if (!isStaffRole(session?.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ success: false, error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  let stage = "şema doğrulama";
  try {
    diagnosticLog("Demo müşteri kurulumu başladı", { actor: session.email, serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) });
    await verifyRequiredSchema();
    stage = "firma oluşturma";
    const company = await upsertCompany();
    stage = "auth kullanıcısı oluşturma";
    const demoPassword = createTemporaryPassword();
    const user = await upsertCustomerUser(company.id, demoPassword);
    stage = "müşteri kaydı oluşturma";
    const customer = await ensureCustomer(company.id, user.id);
    stage = "panel görünürlüğü oluşturma";
    const visibility = await ensureVisibility(company.id);
    stage = "kampanya oluşturma";
    const campaign = await upsertCampaign(company.id);
    stage = "kampanya metriği oluşturma";
    const metric = await createMetric(company.id, campaign.id);
    stage = "müşteri güncellemeleri oluşturma";
    const updates = await createUpdates(company.id);
    stage = "müşteri dosyası oluşturma";
    const file = await createCustomerFile(company.id);
    stage = "rapor oluşturma";
    const reports = await ensureReports(company.id, campaign.id);
    stage = "rapor güncellemeleri ve yorumları oluşturma";
    await ensureReportExtras(company.id, reports, user.id);
    stage = "aktivite kaydı oluşturma";
    await recordActivity({ session, action: "Oluşturma", entity: "Demo Müşteri", entityId: company.id, companyId: company.id, details: { message: "Demo müşteri ve örnek raporlar oluşturuldu" } });
    diagnosticLog("Demo müşteri kurulumu tamamlandı", { companyId: company.id, customerId: customer.id, userId: user.id });

    return NextResponse.json({
      success: true,
      ok: true,
      message: "Demo müşteri oluşturuldu. Bu bilgilerle müşteri panelini test edebilirsiniz.",
      credentials: {
        email: demoEmail,
        password: demoPassword
      },
      company,
      customer,
      user,
      visibility,
      campaign,
      metric,
      updates,
      file,
      reports
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Demo müşteri oluşturulamadı.";
    const actualError = `Demo müşteri kurulumu başarısız (${stage}): ${message}`;
    console.error(`${logPrefix} Kurulum başarısız`, { stage, message, stack: error instanceof Error ? error.stack : undefined });
    return NextResponse.json(
      {
        success: false,
        error: actualError,
        ...(process.env.NODE_ENV === "development" ? { stack: error instanceof Error ? error.stack : undefined } : {})
      },
      { status: 500 }
    );
  }
}
