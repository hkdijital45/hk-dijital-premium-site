import { NextResponse } from "next/server";
import {
  createSupabaseAuthUser,
  findSupabaseAuthUserByEmail,
  getSession,
  isStaffRole,
  updateSupabaseAuthUser
} from "@/lib/auth";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const demoEmail = "mycake45@hkdijital.com.tr";

function createTemporaryPassword() {
  return `MyCake45-${crypto.randomUUID().slice(0, 8)}!`;
}

async function upsertCompany() {
  const existing = await supabaseRest<any[]>("companies?name=eq.My%20Cake%2045&select=*&limit=1");
  if (existing[0]) return existing[0];

  const rows = await supabaseRest<any[]>("companies", {
    method: "POST",
    body: JSON.stringify({
      name: "My Cake 45",
      sector: "Pastane ve butik pasta",
      city: "Manisa",
      website: "https://www.mycake45.com",
      instagram: "@mycake45",
      phone: "+90 555 045 45 45",
      email: demoEmail,
      status: "Aktif"
    })
  });
  return rows[0];
}

async function upsertCustomerUser(companyId: string, demoPassword: string) {
  let authUser = await findSupabaseAuthUserByEmail(demoEmail);
  if (authUser) {
    authUser = await updateSupabaseAuthUser(authUser.id, {
      email: demoEmail,
      password: demoPassword,
      fullName: "My Cake 45 Müşteri"
    });
  } else {
    authUser = await createSupabaseAuthUser({
      email: demoEmail,
      password: demoPassword,
      fullName: "My Cake 45 Müşteri"
    });
  }

  const byEmail = await supabaseRest<any[]>(`users?email=eq.${encodeURIComponent(demoEmail)}&select=*&limit=1`);
  const payload = {
    auth_user_id: authUser.id,
    email: demoEmail,
    full_name: "My Cake 45 Müşteri",
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
    return rows[0];
  }

  const rows = await supabaseRest<any[]>("users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
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
    `campaigns?company_id=eq.${companyId}&name=eq.My%20Cake%2045%20Meta%20Lead%20Kampanyası&select=*&limit=1`
  );
  if (existing[0]) return existing[0];

  const rows = await supabaseRest<any[]>("campaigns", {
    method: "POST",
    body: JSON.stringify({
      company_id: companyId,
      name: "My Cake 45 Meta Lead Kampanyası",
      platform: "Meta",
      objective: "Mesaj",
      status: "Aktif",
      start_date: new Date().toISOString().slice(0, 10),
      budget: 15000,
      spent: 4320,
      notes: "Demo kampanya: doğum günü pastası ve özel gün siparişleri için mesaj odaklı reklam."
    })
  });
  return rows[0];
}

async function createMetric(companyId: string, campaignId: string) {
  const rows = await supabaseRest<any[]>("campaign_metrics", {
    method: "POST",
    body: JSON.stringify({
      campaign_id: campaignId,
      company_id: companyId,
      date: new Date().toISOString().slice(0, 10),
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
  return supabaseRest<any[]>("customer_updates", {
    method: "POST",
    body: JSON.stringify([
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
    ])
  });
}

async function createCustomerFile(companyId: string) {
  const rows = await supabaseRest<any[]>("customer_files", {
    method: "POST",
    body: JSON.stringify({
      company_id: companyId,
      title: "My Cake 45 Demo Raporu",
      description: "Müşteri paneli dosya görünürlüğünü test etmek için demo rapor kaydı.",
      file_url: "https://www.hkdijital.com.tr",
      file_type: "link",
      visible_to_customer: true
    })
  });
  return rows[0];
}

export async function POST() {
  const session = await getSession();
  if (!isStaffRole(session?.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  try {
    const company = await upsertCompany();
    const demoPassword = createTemporaryPassword();
    const user = await upsertCustomerUser(company.id, demoPassword);
    const visibility = await ensureVisibility(company.id);
    const campaign = await upsertCampaign(company.id);
    const metric = await createMetric(company.id, campaign.id);
    const updates = await createUpdates(company.id);
    const file = await createCustomerFile(company.id);

    return NextResponse.json({
      ok: true,
      message: "My Cake 45 demo müşterisi oluşturuldu ve müşteri paneli verileri hazırlandı.",
      credentials: {
        email: demoEmail,
        password: demoPassword
      },
      company,
      user,
      visibility,
      campaign,
      metric,
      updates,
      file
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Demo müşteri oluşturulamadı.";
    console.error("Demo müşteri Supabase hatası:", message);
    return NextResponse.json(
      {
        error: "Demo müşteri oluşturulamadı.",
        supabaseError: message,
        possibleCause: "Service role kullanılmasına rağmen hata alınıyorsa canlı Supabase şeması, tablo izinleri veya Storage yapılandırması kontrol edilmelidir."
      },
      { status: 500 }
    );
  }
}
