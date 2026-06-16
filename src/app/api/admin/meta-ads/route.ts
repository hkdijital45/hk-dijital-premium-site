/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { generateAiText } from "@/lib/ai-provider";
import { decryptSecret, getIntegrations, safeIntegrationForClient, upsertIntegration } from "@/lib/business-flow";
import { classifyMetaError, metaToken, recordMetaError, recordMetaSuccess } from "@/lib/meta-api";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const GRAPH_VERSION = "v20.0";

function maskToken(value = "") {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function dateRangeForPreset(preset = "last_30d", from = "", to = "") {
  if (preset === "custom" && from && to) return { since: from, until: to, label: `${from} - ${to}` };
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const start = new Date(today);
  if (preset === "last_7d") start.setDate(today.getDate() - 7);
  else if (preset === "this_month") start.setDate(1);
  else if (preset === "last_month") {
    start.setMonth(today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);
    return { since: start.toISOString().slice(0, 10), until: lastMonthEnd, label: "Geçen Ay" };
  } else start.setDate(today.getDate() - 30);
  return { since: start.toISOString().slice(0, 10), until: end, label: preset === "last_7d" ? "Son 7 Gün" : preset === "this_month" ? "Bu Ay" : "Son 30 Gün" };
}

async function staff() {
  return (await requireModuleAccess("api-ayarlari")) || (await requireModuleAccess("meta-analiz")) || (await requireModuleAccess("kampanyalar"));
}

async function tokenForIntegration(integrationId?: string) {
  const integrations = hasSupabaseConfig() ? await getIntegrations("meta") : [];
  if (integrationId && hasSupabaseConfig()) {
    const found = integrations.find((item) => item.id === integrationId);
    const token = decryptSecret(found?.access_token_encrypted);
    if (token) return { token, integration: found };
  }
  const savedGlobal = integrations.find((item) => !item.company_id && item.access_token_encrypted)
    || integrations.find((item) => String(item.ad_account_id || "") === "__global_meta" && item.access_token_encrypted);
  const savedToken = decryptSecret(savedGlobal?.access_token_encrypted);
  if (savedToken) return { token: savedToken, integration: savedGlobal || null };
  const envToken = metaToken();
  return { token: envToken, integration: null };
}

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => value && url.searchParams.set(key, value));
  url.searchParams.set("access_token", token);
  const started = Date.now();
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  const responseTimeMs = Date.now() - started;
  if (!response.ok) {
    const error = classifyMetaError(data);
    recordMetaError(error, responseTimeMs);
    return { ok: false, data, error, responseTimeMs };
  }
  recordMetaSuccess(responseTimeMs);
  return { ok: true, data, responseTimeMs };
}

function actionValue(actions: any[] = [], names: string[]) {
  const normalized = names.map((name) => name.toLocaleLowerCase("tr"));
  const match = actions.find((item) => normalized.includes(String(item.action_type || item.type || "").toLocaleLowerCase("tr")));
  return Number(match?.value || 0);
}

function normalizeInsight(row: any) {
  const spend = Number(row.spend || 0);
  const impressions = Number(row.impressions || 0);
  const clicks = Number(row.inline_link_clicks || row.clicks || 0);
  const leads = actionValue(row.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
  const messages = actionValue(row.actions, ["onsite_conversion.messaging_conversation_started_7d", "messaging_conversation_started_7d"]);
  return {
    date: row.date_start || row.date_stop || new Date().toISOString().slice(0, 10),
    campaignId: row.campaign_id || "",
    campaignName: row.campaign_name || "Meta Kampanya",
    impressions,
    reach: Number(row.reach || 0),
    clicks,
    spend,
    spent: spend,
    ctr: Number(row.ctr || 0),
    cpc: Number(row.cpc || 0) || (clicks ? spend / clicks : 0),
    cpm: Number(row.cpm || 0) || (impressions ? (spend / impressions) * 1000 : 0),
    leads,
    results: leads || messages,
    messages
  };
}

function safeMappingForClient(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    companyId: row.company_id,
    accountName: row.account_name,
    accountId: row.account_id || row.ad_account_id,
    adAccountId: row.ad_account_id || row.account_id,
    businessId: row.business_id || row.business_account_id,
    pageId: row.page_id,
    instagramAccountId: row.instagram_account_id,
    status: row.status,
    syncStatus: row.sync_status,
    syncMessage: row.sync_message,
    lastSyncAt: row.last_sync_at,
    updatedAt: row.updated_at
  };
}

function sumInsights(rows: any[]) {
  const totals = rows.reduce((sum, row) => ({
    impressions: sum.impressions + Number(row.impressions || 0),
    reach: sum.reach + Number(row.reach || 0),
    clicks: sum.clicks + Number(row.clicks || 0),
    spend: sum.spend + Number(row.spend || 0),
    spent: sum.spent + Number(row.spend || 0),
    leads: sum.leads + Number(row.leads || 0),
    results: sum.results + Number(row.results || 0),
    messages: sum.messages + Number(row.messages || 0)
  }), { impressions: 0, reach: 0, clicks: 0, spend: 0, spent: 0, leads: 0, results: 0, messages: 0 });
  return {
    ...totals,
    ctr: totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks ? totals.spend / totals.clicks : 0,
    cpm: totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0
  };
}

async function pullMetaData(input: any, token: string) {
  const adAccount = String(input.adAccountId || "").replace(/^act_/, "");
  if (!adAccount) return { ok: false, errorMessage: "Hesap bulunamadı", rows: [], campaigns: [] };
  const range = dateRangeForPreset(input.rangePreset || "last_30d", input.dateFrom, input.dateTo);
  const timeRange = JSON.stringify({ since: range.since, until: range.until });
  const fields = "campaign_id,campaign_name,impressions,reach,clicks,inline_link_clicks,spend,ctr,cpc,cpm,actions,date_start,date_stop";
  const insights = await graphGet(`act_${adAccount}/insights`, token, { fields, level: "campaign", time_increment: "1", time_range: timeRange, limit: "200" });
  if (!insights.ok) return { ok: false, errorMessage: insights.error?.errorMessage || "Meta verisi alınamadı.", error: insights.error, rows: [], campaigns: [] };
  const rows = (insights.data?.data || []).map(normalizeInsight);
  const campaignStatus = await graphGet(`act_${adAccount}/campaigns`, token, { fields: "id,name,status,effective_status,objective", limit: "100" });
  const campaigns = campaignStatus.ok ? (campaignStatus.data?.data || []) : [];
  return { ok: true, rows, campaigns, metrics: sumInsights(rows), range, responseTimeMs: insights.responseTimeMs };
}

async function saveReportFromMeta(input: any, pulled: any) {
  if (!hasSupabaseConfig() || !input.companyId) return null;
  const period = pulled.range?.label || "Meta Sync";
  const fallback = [
    "Meta reklam verileri otomatik olarak incelendi.",
    `Toplam harcama ${Number(pulled.metrics?.spend || 0).toLocaleString("tr-TR")} TL, erişim ${Number(pulled.metrics?.reach || 0).toLocaleString("tr-TR")} ve tıklama ${Number(pulled.metrics?.clicks || 0).toLocaleString("tr-TR")} seviyesinde.`,
    "Güçlü kampanyalar daha fazla bütçe testiyle, zayıf kampanyalar ise kreatif ve hedef kitle revizyonuyla takip edilmelidir.",
    "Remarketing, yeni kreatif testi ve bütçe dağılımı sonraki adım olarak önerilir."
  ].join("\n");
  const ai = await generateAiText(
    `Meta reklam raporu için Türkçe müşteri dostu yorum üret. Başlıklar: Güçlü yönler, Zayıf yönler, Bütçe önerisi, Yeni kampanya önerisi, Remarketing önerisi, Kreatif önerisi. Veri: ${JSON.stringify({ metrics: pulled.metrics, campaigns: pulled.campaigns, period })}`,
    fallback
  ).catch(() => ({ text: fallback, provider: "Yerel Mod", model: "local-rules", mode: "Yerel" }));
  const rows = await supabaseRest<any[]>("reports", {
    method: "POST",
    body: JSON.stringify({
      company_id: input.companyId,
      report_type: "Meta Reklam Raporu",
      platform: "Meta Reklamları",
      period,
      start_date: pulled.range?.since,
      end_date: pulled.range?.until,
      metrics: pulled.metrics || {},
      time_series: pulled.rows || [],
      raw_extracted_data: { source: "Meta Graph API", adAccountId: input.adAccountId, campaigns: pulled.campaigns || [], ai },
      customer_note: ai.text,
      visible_to_customer: Boolean(input.visibleToCustomer)
    })
  });
  return rows[0] || null;
}

async function findCustomerMetaMapping(companyId?: string) {
  if (!hasSupabaseConfig() || !companyId) return null;
  const rows = await supabaseRest<any[]>(`ad_integrations?provider=eq.meta&company_id=eq.${encodeURIComponent(companyId)}&select=*&order=updated_at.desc&limit=1`).catch(() => []);
  return rows[0] || null;
}

async function writeSyncLog(input: any, result: "Başarılı" | "Uyarı" | "Hata", message: string, details: Record<string, unknown> = {}) {
  if (!hasSupabaseConfig()) return;
  await supabaseRest("integration_sync_logs", {
    method: "POST",
    body: JSON.stringify({
      provider: "meta",
      company_id: input.companyId || null,
      integration_id: input.integrationId || input.integration_id || null,
      source: "Meta Verilerini Çek",
      result,
      message,
      details
    })
  }).catch(() => null);
}

async function updateMappingSyncState(input: any, status: string, message: string) {
  if (!hasSupabaseConfig() || !input.companyId) return null;
  const mapping = await findCustomerMetaMapping(input.companyId);
  if (!mapping?.id) return null;
  const rows = await supabaseRest<any[]>(`ad_integrations?id=eq.${mapping.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      status,
      sync_status: status,
      sync_message: message,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  }).catch(() => []);
  return rows[0] || mapping;
}

async function saveMetaMetrics(input: any, pulled: any) {
  if (!hasSupabaseConfig() || !input.companyId || !pulled.rows?.length) return [];
  const records = pulled.rows.map((row: any) => ({
    company_id: input.companyId,
    campaign_id: input.campaignId || null,
    meta_campaign_id: row.campaignId || null,
    campaign_name: row.campaignName || null,
    source: "Meta API",
    date: row.date || new Date().toISOString().slice(0, 10),
    period: pulled.range?.label || "Meta Sync",
    impressions: Number(row.impressions || 0),
    reach: Number(row.reach || 0),
    clicks: Number(row.clicks || 0),
    spend: Number(row.spend || row.spent || 0),
    spent: Number(row.spent || row.spend || 0),
    cpc: Number(row.cpc || 0),
    cpm: Number(row.cpm || 0),
    ctr: Number(row.ctr || 0),
    leads: Number(row.leads || row.results || 0),
    results: Number(row.results || row.leads || 0),
    messages: Number(row.messages || 0),
    conversions: Number(row.conversions || row.leads || row.results || 0),
    visible_to_customer: Boolean(input.visibleToCustomer),
    raw_data: row
  }));
  return supabaseRest<any[]>("campaign_metrics", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(records)
  });
}

export async function GET(request: Request) {
  if (!(await staff())) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "status";
  const integrationId = searchParams.get("integrationId") || "";
  const { token } = await tokenForIntegration(integrationId);
  if (!token) return NextResponse.json({ ok: false, hasToken: false, maskedToken: "", message: "Token geçersiz veya bulunamadı." });

  if (action === "status") {
    const test = await graphGet("me", token, { fields: "id,name" });
    return NextResponse.json({ ok: test.ok, hasToken: true, maskedToken: maskToken(token), message: test.ok ? "Meta bağlantısı başarılı" : test.error?.errorMessage || "Token geçersiz", tokenStatus: test.ok ? "Geçerli" : "Geçersiz", responseTimeMs: test.responseTimeMs });
  }
  if (action === "adaccounts") {
    const result = await graphGet("me/adaccounts", token, { fields: "id,name,account_status,currency", limit: "100" });
    return NextResponse.json({ ok: result.ok, accounts: (result.data?.data || []).map((item: any) => ({ id: item.id, name: item.name, status: item.account_status, currency: item.currency })), message: result.ok ? "Reklam hesapları getirildi." : result.error?.errorMessage || "Hesap bulunamadı" });
  }
  if (action === "pages") {
    const result = await graphGet("me/accounts", token, { fields: "id,name,category", limit: "100" });
    return NextResponse.json({ ok: result.ok, pages: (result.data?.data || []).map((item: any) => ({ id: item.id, name: item.name, category: item.category })), message: result.ok ? "Sayfalar getirildi." : result.error?.errorMessage || "Sayfalar alınamadı" });
  }
  if (action === "instagram") {
    const businessId = searchParams.get("businessId") || process.env.META_BUSINESS_ID || "";
    const path = businessId ? `${businessId}/owned_instagram_accounts` : "me/accounts";
    const result = await graphGet(path, token, { fields: "id,username,name", limit: "100" });
    return NextResponse.json({ ok: result.ok, instagramAccounts: (result.data?.data || []).map((item: any) => ({ id: item.id, username: item.username || item.name, name: item.name || item.username })), message: result.ok ? "Instagram hesapları getirildi." : result.error?.errorMessage || "Instagram hesapları alınamadı" });
  }

  return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
}

export async function POST(request: Request) {
  if (!(await staff())) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = body.action || "sync";
  try {
    if (action === "connect") {
      if (!hasSupabaseConfig()) return NextResponse.json({ ok: false, message: "Supabase bağlantısı yapılandırılmadı; bağlantı sadece ekranda taslak olarak tutulabilir." }, { status: 200 });
      const rows = await upsertIntegration({
        provider: "meta",
        companyId: body.companyId,
        businessAccountId: body.businessId,
        adAccountId: body.adAccountId,
        pageId: body.pageId,
        instagramAccountId: body.instagramAccountId,
        accessToken: body.accessToken,
        autoSync: body.autoSync
      });
      return NextResponse.json({ ok: true, integration: safeIntegrationForClient(rows[0]), message: "Meta hesabı güvenli şekilde bağlandı." });
    }

    const { token, integration } = await tokenForIntegration(body.integrationId);
    if (!token) {
      await writeSyncLog(body, "Hata", "Meta access token kayıtlı değil.", { errorCode: "META_TOKEN_MISSING" });
      return NextResponse.json({ ok: false, message: "Meta access token kayıtlı değil.", errorCode: "META_TOKEN_MISSING" }, { status: 200 });
    }

    if (action === "test") {
      const result = await graphGet("me", token, { fields: "id,name" });
      return NextResponse.json({ ok: result.ok, maskedToken: maskToken(token), message: result.ok ? "Meta bağlantısı başarılı" : result.error?.errorMessage || "Token geçersiz" });
    }

    const mapping = await findCustomerMetaMapping(body.companyId || integration?.company_id);
    const input = {
      ...body,
      companyId: body.companyId || integration?.company_id || mapping?.company_id,
      adAccountId: body.adAccountId || mapping?.ad_account_id || mapping?.account_id || integration?.ad_account_id,
      businessId: body.businessId || mapping?.business_id || mapping?.business_account_id || integration?.business_id || integration?.business_account_id,
      pageId: body.pageId || mapping?.page_id || integration?.page_id,
      instagramAccountId: body.instagramAccountId || mapping?.instagram_account_id || integration?.instagram_account_id,
      integrationId: mapping?.id || integration?.id || body.integrationId
    };
    if (!input.adAccountId) {
      const message = "Meta Ads Account ID eksik.";
      await writeSyncLog(input, "Hata", message, { errorCode: "META_AD_ACCOUNT_MISSING" });
      await updateMappingSyncState(input, "Hata", message);
      return NextResponse.json({ ok: false, message, errorCode: "META_AD_ACCOUNT_MISSING" }, { status: 200 });
    }
    const pulled = await pullMetaData(input, token);
    if (!pulled.ok) {
      const metaMessage = pulled.error?.isTokenExpired
        ? "Token geçersiz."
        : pulled.error?.isPermissionError
          ? "Yetki eksik."
          : pulled.error?.isRateLimit
            ? "Meta API istek sınırına takıldı."
            : pulled.errorMessage || "API hatası.";
      await writeSyncLog(input, "Hata", metaMessage, { errorCode: pulled.error?.errorCode, detail: pulled.errorMessage });
      await updateMappingSyncState(input, "Hata", metaMessage);
      return NextResponse.json({ ...pulled, message: metaMessage, errorMessage: metaMessage }, { status: 200 });
    }
    let savedRows: any[] = [];
    try {
      savedRows = await saveMetaMetrics(input, pulled);
    } catch (error) {
      const safe = getSafeSupabaseError(error);
      const schemaMessage = safe.detail.includes("schema cache") || safe.detail.includes("column") || safe.detail.includes("relation")
        ? "Veritabanı şema hatası: campaign_metrics alanları eksik. Migration uygulanmalı."
        : safe.title;
      await writeSyncLog(input, "Hata", schemaMessage, { detail: safe.detail });
      await updateMappingSyncState(input, "Hata", schemaMessage);
      return NextResponse.json({ ok: false, message: schemaMessage, detail: safe.detail, errorCode: "META_SYNC_SCHEMA_ERROR" }, { status: 200 });
    }
    const report = action === "report" || body.createReport ? await saveReportFromMeta(input, pulled) : null;
    const successMessage = action === "report" ? "Meta verilerinden rapor oluşturuldu." : "Meta verileri başarıyla çekildi.";
    const mappingRow = await updateMappingSyncState(input, "Başarılı", successMessage);
    await writeSyncLog(input, "Başarılı", successMessage, { rows: savedRows.length, adAccountId: input.adAccountId });
    return NextResponse.json({
      ok: true,
      message: successMessage,
      metrics: pulled.metrics,
      rows: pulled.rows,
      savedRows,
      campaigns: pulled.campaigns,
      mapping: safeMappingForClient(mappingRow),
      report,
      range: pulled.range,
      responseTimeMs: pulled.responseTimeMs
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ ok: false, message: safe.title, detail: safe.detail }, { status: 200 });
  }
}
