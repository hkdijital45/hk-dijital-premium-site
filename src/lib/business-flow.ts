/* eslint-disable @typescript-eslint/no-explicit-any */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { createSupabaseAuthUser, findSupabaseAuthUserByEmail, updateSupabaseAuthUser } from "./auth";
import { generateAiText } from "./ai-provider";
import { hasSupabaseConfig, supabaseRest } from "./supabase";
import { calculateHealthScore, normalizeReportType, parseTurkishNumber } from "./reports/report-insights";

export type IntegrationProvider = "meta" | "google";

function encryptionKey() {
  return createHash("sha256").update(process.env.INTEGRATION_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-integration-secret").digest();
}

export function encryptSecret(value: string) {
  if (!value) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value?: string | null) {
  if (!value) return "";
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) return "";
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}

export async function getIntegrations(provider?: IntegrationProvider) {
  if (!hasSupabaseConfig()) return [];
  const query = provider ? `ad_integrations?provider=eq.${provider}&select=*&order=updated_at.desc` : "ad_integrations?select=*&order=updated_at.desc";
  return supabaseRest<any[]>(query).catch(() => []);
}

export function safeIntegrationForClient(item: any) {
  const safe = { ...(item || {}) };
  delete safe.access_token_encrypted;
  delete safe.refresh_token_encrypted;
  return {
    ...safe,
    hasAccessToken: Boolean(item?.access_token_encrypted),
    hasRefreshToken: Boolean(item?.refresh_token_encrypted)
  };
}

export async function upsertIntegration(input: {
  provider: IntegrationProvider;
  companyId?: string;
  businessAccountId?: string;
  adAccountId?: string;
  pageId?: string;
  instagramAccountId?: string;
  customerAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
  autoSync?: boolean;
}) {
  const record = {
    provider: input.provider,
    company_id: input.companyId || null,
    business_account_id: input.businessAccountId || null,
    ad_account_id: input.adAccountId || input.customerAccountId || null,
    page_id: input.pageId || null,
    instagram_account_id: input.instagramAccountId || null,
    access_token_encrypted: input.accessToken ? encryptSecret(input.accessToken) : null,
    refresh_token_encrypted: input.refreshToken ? encryptSecret(input.refreshToken) : null,
    auto_sync: input.autoSync ?? false,
    status: input.accessToken || input.adAccountId || input.customerAccountId ? "Bağlantı bilgisi kaydedildi" : "Eksik bilgi",
    updated_at: new Date().toISOString()
  };
  return supabaseRest<any[]>("ad_integrations?on_conflict=provider,company_id,ad_account_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([record])
  });
}

function metaActionValue(actions: any[] = [], names: string[]) {
  const normalizedNames = names.map((name) => name.toLocaleLowerCase("tr-TR"));
  const match = actions.find((action) => normalizedNames.includes(String(action.action_type || action.type || "").toLocaleLowerCase("tr-TR")));
  return parseTurkishNumber(match?.value);
}

function normalizeMetaInsightsRows(rows: any[] = []) {
  return rows.map((row) => {
    const leads = metaActionValue(row.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
    const messages = metaActionValue(row.actions, ["onsite_conversion.messaging_conversation_started_7d", "messaging_conversation_started_7d"]);
    const clicks = parseTurkishNumber(row.inline_link_clicks || row.clicks);
    const spend = parseTurkishNumber(row.spend);
    const impressions = parseTurkishNumber(row.impressions);
    return {
      date: row.date_start || row.date_stop || new Date().toISOString().slice(0, 10),
      campaignName: row.campaign_name || row.campaign_id || "Meta Kampanya",
      impressions,
      reach: parseTurkishNumber(row.reach),
      clicks,
      spend,
      spent: spend,
      ctr: parseTurkishNumber(row.ctr),
      cpc: parseTurkishNumber(row.cpc) || (clicks ? spend / clicks : 0),
      cpm: parseTurkishNumber(row.cpm) || (impressions ? (spend / impressions) * 1000 : 0),
      leads,
      results: leads || messages,
      messages
    };
  });
}

function sumRows(rows: any[]) {
  return rows.reduce((total, row) => ({
    impressions: total.impressions + parseTurkishNumber(row.impressions),
    reach: total.reach + parseTurkishNumber(row.reach),
    clicks: total.clicks + parseTurkishNumber(row.clicks),
    spend: total.spend + parseTurkishNumber(row.spend),
    spent: total.spent + parseTurkishNumber(row.spend),
    leads: total.leads + parseTurkishNumber(row.leads),
    results: total.results + parseTurkishNumber(row.results),
    messages: total.messages + parseTurkishNumber(row.messages)
  }), { impressions: 0, reach: 0, clicks: 0, spend: 0, spent: 0, leads: 0, results: 0, messages: 0 });
}

async function syncMetaIntegration(integration: any, token: string) {
  const adAccount = String(integration.ad_account_id || "").replace(/^act_/, "");
  if (!adAccount) return { ok: false, message: "Meta Ad Account ID eksik.", inserted: 0 };

  const fields = [
    "campaign_id",
    "campaign_name",
    "impressions",
    "reach",
    "clicks",
    "inline_link_clicks",
    "spend",
    "ctr",
    "cpc",
    "cpm",
    "actions",
    "date_start",
    "date_stop"
  ].join(",");
  const url = new URL(`https://graph.facebook.com/v20.0/act_${adAccount}/insights`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("date_preset", "last_30d");
  url.searchParams.set("access_token", token);

  const started = Date.now();
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || "Meta API senkronizasyonu başarısız oldu.";
    await supabaseRest(`ad_integrations?id=eq.${integration.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: `Meta hata: ${message}`, updated_at: new Date().toISOString() })
    }).catch(() => null);
    return { ok: false, message, inserted: 0, responseTimeMs: Date.now() - started };
  }

  const rows = normalizeMetaInsightsRows(payload.data || []);
  if (!rows.length) {
    await supabaseRest(`ad_integrations?id=eq.${integration.id}`, {
      method: "PATCH",
      body: JSON.stringify({ last_sync_at: new Date().toISOString(), status: "Meta API yanıt verdi, raporlanacak kampanya verisi yok.", updated_at: new Date().toISOString() })
    }).catch(() => null);
    return { ok: true, message: "Meta API yanıt verdi, raporlanacak kampanya verisi bulunamadı.", inserted: 0, responseTimeMs: Date.now() - started };
  }

  const metrics = sumRows(rows);
  metrics.ctr = metrics.impressions ? (metrics.clicks / metrics.impressions) * 100 : 0;
  metrics.cpc = metrics.clicks ? metrics.spend / metrics.clicks : 0;
  metrics.cpm = metrics.impressions ? (metrics.spend / metrics.impressions) * 1000 : 0;
  const startDate = rows.map((row) => row.date).sort()[0];
  const endDate = rows.map((row) => row.date).sort().at(-1);
  const reportRows = await supabaseRest<any[]>("reports", {
    method: "POST",
    body: JSON.stringify({
      company_id: integration.company_id,
      report_type: "Meta Reklam Raporu",
      platform: "Meta Reklamları",
      period: "Otomatik Sync",
      start_date: startDate,
      end_date: endDate,
      metrics,
      time_series: rows,
      raw_extracted_data: { source: "Meta Graph API", adAccountId: adAccount, rows: payload.data || [] },
      customer_note: "Meta reklam verileri otomatik senkronizasyon ile oluşturuldu.",
      visible_to_customer: true
    })
  });
  await supabaseRest(`ad_integrations?id=eq.${integration.id}`, {
    method: "PATCH",
    body: JSON.stringify({ last_sync_at: new Date().toISOString(), status: "Senkronize edildi", updated_at: new Date().toISOString() })
  }).catch(() => null);
  return { ok: true, message: "Meta kampanya metrikleri senkronize edildi ve rapor oluşturuldu.", inserted: reportRows.length, reportId: reportRows[0]?.id, responseTimeMs: Date.now() - started };
}

export async function syncIntegration(provider: IntegrationProvider, integrationId?: string) {
  const integrations = await getIntegrations(provider);
  const integration = integrationId ? integrations.find((item) => item.id === integrationId) : integrations[0];
  if (!integration) return { ok: false, message: "Bağlantı kaydı bulunamadı.", inserted: 0 };
  const token = decryptSecret(integration.access_token_encrypted) || (provider === "meta" ? process.env.META_ACCESS_TOKEN : process.env.GOOGLE_ADS_ACCESS_TOKEN) || "";
  if (!token) return { ok: false, message: "Token bulunamadı. Bağlantı merkezinden token ekleyin veya sunucu ortam değişkenlerini yapılandırın.", inserted: 0 };
  if (!integration.company_id) return { ok: false, message: "Bu bağlantı bir müşteri/firma ile eşleşmemiş.", inserted: 0 };

  if (provider === "meta") return syncMetaIntegration(integration, token);

  const googleReady = Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET);
  await supabaseRest(`ad_integrations?id=eq.${integration.id}`, {
    method: "PATCH",
    body: JSON.stringify({ last_sync_at: new Date().toISOString(), status: googleReady ? "Google Ads OAuth müşteri seçimi bekleniyor" : "Google Ads developer token/OAuth eksik", updated_at: new Date().toISOString() })
  }).catch(() => null);
  return { ok: false, message: googleReady ? "Google Ads bağlantısı kayıtlı. Resmi OAuth müşteri seçimi tamamlandığında bu uçtan rapor üretilecek." : "Google Ads senkronizasyonu için developer token ve OAuth bilgileri sunucuda tanımlanmalı.", inserted: 0 };
}

export function calculateDigitalMaturityScore(lead: any) {
  let score = 20;
  if (lead.website) score += 15;
  if (lead.instagram) score += 12;
  if (lead.phone) score += 8;
  if (lead.email) score += 8;
  if (lead.google_rating) score += Math.min(12, Number(lead.google_rating) * 2);
  if (lead.google_review_count) score += Math.min(15, Math.log10(Number(lead.google_review_count) + 1) * 10);
  if (lead.goal) score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateLeadHeatScore(lead: any) {
  let score = 15;
  const text = `${lead.goal || ""} ${lead.message || ""} ${lead.notes || ""}`.toLocaleLowerCase("tr-TR");
  if (lead.phone) score += 15;
  if (lead.email) score += 10;
  if (lead.budget) score += 15;
  if (text.includes("acil") || text.includes("hemen")) score += 15;
  if (text.includes("reklam") || text.includes("lead") || text.includes("whatsapp")) score += 15;
  if (["Teklif Gönderildi", "Takipte"].includes(lead.status)) score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function recommendPackage(input: any) {
  const budget = parseTurkishNumber(input.budget);
  if (budget >= 30000) return "Premium";
  if (budget >= 12000) return "Professional";
  return "Starter";
}

export function forecastKpis(input: any) {
  const budget = parseTurkishNumber(input.budget);
  const platform = String(input.platform || "Meta").toLocaleLowerCase("tr-TR");
  const cpm = platform.includes("google") ? 55 : 35;
  const cpc = platform.includes("google") ? 12 : 8;
  const reach = budget ? Math.round((budget / cpm) * 1000 * 0.72) : 0;
  const clicks = budget ? Math.round(budget / cpc) : 0;
  const leads = clicks ? Math.max(1, Math.round(clicks * 0.035)) : 0;
  const messages = clicks ? Math.max(1, Math.round(clicks * 0.05)) : 0;
  return {
    reach,
    clicks,
    leads,
    messages,
    costPerLead: leads ? budget / leads : 0
  };
}

export async function generateProposal(input: any) {
  const packageName = recommendPackage(input);
  const forecast = forecastKpis(input);
  const fallback = [
    `${input.businessName || "İşletme"} için ${packageName} paket önerilir.`,
    `Hedef: ${input.goal || "Lead generation"}. Önerilen akış: Trafik -> Remarketing -> Conversion.`,
    `Tahmini erişim ${forecast.reach.toLocaleString("tr-TR")}, tıklama ${forecast.clicks.toLocaleString("tr-TR")}, lead ${forecast.leads.toLocaleString("tr-TR")} seviyesindedir.`,
    "Bu tahminler garanti satış değil, bütçe ve sektör koşullarına göre planlama öngörüsüdür."
  ].join("\n");
  const ai = await generateAiText(`Türkçe profesyonel teklif metni hazırla. Veri: ${JSON.stringify({ input, packageName, forecast })}`, fallback).catch(() => ({ text: fallback, provider: "Yerel Mod", model: "local-rules", mode: "Yerel" }));
  return {
    packageName,
    funnel: ["Traffic", "Remarketing", "Conversion"],
    forecast,
    explanation: ai.text,
    ai
  };
}

export async function createCustomerFromLead(lead: any, options: { approve?: boolean } = {}) {
  if (!hasSupabaseConfig()) throw new Error("Supabase bağlantısı yapılandırılmadı.");
  const companyRows = await supabaseRest<any[]>("companies", {
    method: "POST",
    body: JSON.stringify({
      name: lead.company || lead.name || "Yeni Müşteri",
      sector: lead.business_type || lead.sector || "",
      city: lead.city || "",
      website: lead.website || "",
      instagram: lead.instagram || "",
      phone: lead.phone || "",
      email: lead.email || "",
      status: options.approve ? "Aktif" : "Onay Bekliyor",
      notes: `CRM lead kaynağı: ${lead.source || "-"}`
    })
  });
  const company = companyRows[0];
  const email = lead.email || `musteri-${Date.now()}@hkdijital.local`;
  const password = `HK-${Math.random().toString(36).slice(2, 8)}-${new Date().getFullYear()}`;
  let authUser = await findSupabaseAuthUserByEmail(email).catch(() => null);
  if (authUser) await updateSupabaseAuthUser(authUser.id, { password, fullName: lead.name || company.name }).catch(() => null);
  if (!authUser) authUser = await createSupabaseAuthUser({ email, password, fullName: lead.name || company.name });
  const userRows = await supabaseRest<any[]>("users", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      auth_user_id: authUser.id,
      email,
      full_name: lead.name || company.name,
      role: "customer",
      company_id: company.id,
      is_active: true
    })
  });
  if (lead.id) {
    await supabaseRest(`leads?id=eq.${encodeURIComponent(lead.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ company_id: company.id, status: "Kazandı", updated_at: new Date().toISOString() })
    }).catch(() => null);
  }
  return { company, user: userRows[0], temporaryPassword: password };
}

export function executiveSummary(data: { leads?: any[]; companies?: any[]; reports?: any[]; campaigns?: any[] }) {
  const leads = data.leads || [];
  const companies = data.companies || [];
  const campaigns = data.campaigns || [];
  const won = leads.filter((lead) => lead.status === "Kazandı").length;
  const proposalValue = leads.reduce((sum, lead) => sum + parseTurkishNumber(lead.budget), 0);
  return {
    totalLeads: leads.length,
    activeCustomers: companies.filter((company) => company.status !== "Pasif").length,
    monthlyRecurringRevenue: companies.length * 7500,
    proposalValue,
    conversionRate: leads.length ? (won / leads.length) * 100 : 0,
    metaManagedBudget: campaigns.filter((item) => normalizeReportType(item.platform).includes("meta")).reduce((sum, item) => sum + parseTurkishNumber(item.budget || item.spent), 0),
    googleManagedBudget: campaigns.filter((item) => normalizeReportType(item.platform).includes("google")).reduce((sum, item) => sum + parseTurkishNumber(item.budget || item.spent), 0)
  };
}

export async function operationsAssistantQuestion(question: string, context: any) {
  const reports = context.reports || [];
  const leads = context.leads || [];
  const payments = context.payments || [];
  const tasks = context.tasks || [];
  const integrations = context.integrations || [];
  const companies = context.companies || [];
  const today = new Date().toISOString().slice(0, 10);
  const risky = reports.map((report: any) => ({ id: report.id, type: report.report_type, health: calculateHealthScore(report), company_id: report.company_id })).filter((item: any) => item.health.score < 50);
  const overduePayments = payments.filter((item: any) => !["Ödendi", "Tahsil Edildi", "İptal"].includes(item.status) && item.due_date && item.due_date < today);
  const criticalTasks = tasks.filter((item: any) => !["Tamamlandı", "İptal"].includes(item.status) && (item.priority === "Kritik" || item.due_date && item.due_date < today));
  const followUps = leads.filter((item: any) => !["Kazanıldı", "Kazandı", "Kaybedildi", "Dönüştürüldü", "Müşteri Oldu"].includes(item.status) && (item.next_action_at && item.next_action_at <= today || item.follow_up_date && item.follow_up_date <= today));
  const proposals = leads.filter((item: any) => ["Teklif Hazırlanıyor", "Teklif Gönderildi", "Teklif Görüntülendi", "Revize İstendi"].includes(item.proposal_status || item.status));
  const integrationErrors = integrations.filter((item: any) => /hata|geçersiz|başarısız|yetki eksik/i.test(`${item.status || ""} ${item.sync_status || ""} ${item.sync_message || ""} ${item.pixel_status || ""}`));
  const companyLabel = (companyId: string) => companies.find((item: any) => item.id === companyId)?.name || "Firma belirtilmedi";
  const fallback = [
    "HK Intelligence günlük operasyon özeti:",
    overduePayments.length ? `1. Tahsilat: ${overduePayments.length} gecikmiş kayıt var. Önce ${overduePayments.slice(0, 3).map((item: any) => companyLabel(item.company_id)).join(", ")} ile iletişime geçin.` : "1. Tahsilat: Gecikmiş kayıt görünmüyor.",
    criticalTasks.length ? `2. Görevler: ${criticalTasks.length} kritik veya gecikmiş görev var. İlk olarak ${criticalTasks.slice(0, 3).map((item: any) => item.title || "İsimsiz görev").join(", ")} tamamlanmalı.` : "2. Görevler: Kritik gecikme görünmüyor.",
    followUps.length ? `3. Lead takibi: ${followUps.length} lead bugün takip bekliyor. ${followUps.slice(0, 3).map((item: any) => item.company || item.name || "İsimsiz lead").join(", ")} önceliklendirilmeli.` : `3. Lead takibi: Tarihi gelen takip yok; ${proposals.length} açık teklif kontrol edilmeli.`,
    integrationErrors.length ? `4. Entegrasyonlar: ${integrationErrors.length} bağlantı veya Pixel sorunu var; veri sürekliliği için Entegrasyonlar ekranından test edin.` : "4. Entegrasyonlar: Kayıtlı bağlantılarda kritik hata sinyali yok.",
    risky.length ? `5. Raporlama: Sağlık skoru düşük ${risky.length} rapor var; müşteri iletişiminden önce yorum ve sonraki adımları güncelleyin.` : "5. Raporlama: Kritik rapor sinyali sınırlı görünüyor.",
    "Öneri sırası: gelir riski → teslim riski → sıcak lead → entegrasyon sürekliliği → raporlama."
  ].join("\n");
  return generateAiText(`HK Dijital operasyon sorusunu Türkçe yanıtla: ${question}\n\nBağlam:${JSON.stringify({ ...context, risky })}`, fallback).catch(() => ({ text: fallback, provider: "Yerel Mod", model: "local-rules", mode: "Yerel" }));
}
