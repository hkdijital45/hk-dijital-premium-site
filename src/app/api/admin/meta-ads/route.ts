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
  if (preset === "all_time") {
    start.setDate(today.getDate() - 365);
    return { since: start.toISOString().slice(0, 10), until: end, label: "Tüm Tarihler", datePreset: "maximum", isAllTime: true };
  }
  if (preset === "last_7d") start.setDate(today.getDate() - 7);
  else if (preset === "this_month") start.setDate(1);
  else if (preset === "last_month") {
    start.setMonth(today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);
    return { since: start.toISOString().slice(0, 10), until: lastMonthEnd, label: "Geçen Ay" };
  } else start.setDate(today.getDate() - 30);
  return { since: start.toISOString().slice(0, 10), until: end, label: preset === "last_7d" ? "Son 7 Gün" : preset === "this_month" ? "Bu Ay" : "Son 30 Gün" };
}

function metaRangeParams(range: any) {
  if (range?.datePreset) return { date_preset: String(range.datePreset) };
  return { time_range: JSON.stringify({ since: range.since, until: range.until }) };
}

function withMetricPeriod(row: any, range: any) {
  return {
    ...row,
    period_start: row.period_start || range?.since || row.date_start || row.date || null,
    period_end: row.period_end || range?.until || row.date_stop || row.date || null,
    date_range_label: row.date_range_label || range?.label || ""
  };
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

function actionValues(actions: any[] = [], names: string[]) {
  const normalized = names.map((name) => name.toLocaleLowerCase("tr"));
  return actions
    .filter((item) => normalized.includes(String(item.action_type || item.type || "").toLocaleLowerCase("tr")))
    .reduce((sum, item) => sum + Number(item.value || 0), 0);
}

function normalizeActions(row: any) {
  const actions = row.actions || [];
  const values = row.action_values || [];
  const spend = Number(row.spend || 0);
  const leads = actionValues(actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
  const messages = actionValues(actions, ["onsite_conversion.messaging_conversation_started_7d", "messaging_conversation_started_7d", "messaging_conversation_started"]);
  const purchases = actionValues(actions, ["purchase", "offsite_conversion.fb_pixel_purchase"]);
  const addToCart = actionValues(actions, ["add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"]);
  const checkout = actionValues(actions, ["initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout"]);
  const purchaseValue = actionValues(values, ["purchase", "offsite_conversion.fb_pixel_purchase"]);
  const videoViews = actionValues(actions, ["video_view"]);
  const video3s = actionValues(actions, ["video_view_3s", "video_3_sec_watched_actions"]);
  const thruplay = actionValues(actions, ["video_thruplay_watched_actions", "thruplay"]);
  const videoP25 = actionValues(actions, ["video_p25_watched_actions"]);
  const videoP50 = actionValues(actions, ["video_p50_watched_actions"]);
  const videoP75 = actionValues(actions, ["video_p75_watched_actions"]);
  const videoP95 = actionValues(actions, ["video_p95_watched_actions"]);
  return {
    leads,
    messages,
    purchases,
    add_to_cart: addToCart,
    checkout,
    purchase_value: purchaseValue,
    roas: spend ? purchaseValue / spend : 0,
    cost_per_lead: leads ? spend / leads : 0,
    cost_per_purchase: purchases ? spend / purchases : 0,
    video_views: videoViews,
    video_3s_views: video3s,
    video_thruplay: thruplay,
    video_p25: videoP25,
    video_p50: videoP50,
    video_p75: videoP75,
    video_p95: videoP95,
    thumb_stop_rate: Number(row.impressions || 0) && video3s ? (video3s / Number(row.impressions || 0)) * 100 : 0
  };
}

function normalizeInsight(row: any) {
  const spend = Number(row.spend || 0);
  const impressions = Number(row.impressions || 0);
  const clicks = Number(row.inline_link_clicks || row.clicks || 0);
  const advanced = normalizeActions(row);
  const leads = advanced.leads;
  const messages = advanced.messages;
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
    messages,
    ...advanced
  };
}

function lifecycleStats(start?: string, stop?: string, spend = 0, budget = 0) {
  const today = new Date();
  const startDate = start ? new Date(start) : null;
  const stopDate = stop ? new Date(stop) : null;
  const daysRunning = startDate ? Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / 86400000)) : null;
  const daysRemaining = stopDate ? Math.ceil((stopDate.getTime() - today.getTime()) / 86400000) : null;
  return {
    days_running: daysRunning,
    days_remaining: daysRemaining,
    budget_consumption_percentage: budget ? Math.min(999, (spend / budget) * 100) : 0,
    estimated_finish_date: stopDate ? stopDate.toISOString().slice(0, 10) : null
  };
}

function normalizeCreative(creative: any = {}) {
  const story = creative.object_story_spec || {};
  const link = story.link_data || {};
  const video = story.video_data || {};
  const photo = story.photo_data || {};
  const cta = link.call_to_action || video.call_to_action || {};
  return {
    creative_id: creative.id || "",
    creative_thumbnail_url: creative.thumbnail_url || video.image_url || link.picture || photo.url || null,
    creative_media_url: creative.image_url || video.video_id || link.picture || null,
    ad_text: creative.body || link.message || video.message || "",
    headline: creative.title || link.name || video.title || "",
    description: creative.description || link.description || "",
    cta: cta.type || "",
    destination_url: cta.value?.link || link.link || video.call_to_action?.value?.link || ""
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
  let range = dateRangeForPreset(input.rangePreset || "last_30d", input.dateFrom, input.dateTo);
  const warnings: string[] = [];
  const fields = "campaign_id,campaign_name,impressions,reach,clicks,inline_link_clicks,spend,ctr,cpc,cpm,actions,action_values,date_start,date_stop";
  let insights = await graphGet(`act_${adAccount}/insights`, token, { fields, level: "campaign", time_increment: "1", ...metaRangeParams(range), limit: "200" });
  if (!insights.ok && range.isAllTime) {
    range = { ...dateRangeForPreset("last_30d"), since: range.since, until: range.until, label: "Tüm Tarihler", fallbackUsed: true };
    warnings.push("Meta tüm tarih aralığını desteklemediği için son 365 gün çekildi.");
    insights = await graphGet(`act_${adAccount}/insights`, token, { fields, level: "campaign", time_increment: "1", ...metaRangeParams(range), limit: "200" });
  }
  if (!insights.ok) return { ok: false, errorMessage: insights.error?.errorMessage || "Meta verisi alınamadı.", error: insights.error, rows: [], campaigns: [] };
  const rows = (insights.data?.data || []).map((row: any) => withMetricPeriod(normalizeInsight(row), range));
  const campaignStatus = await graphGet(`act_${adAccount}/campaigns`, token, { fields: "id,name,status,effective_status,objective,start_time,stop_time,created_time,updated_time,daily_budget,lifetime_budget", limit: "100" });
  const campaigns = campaignStatus.ok ? (campaignStatus.data?.data || []) : [];
  return { ok: true, rows, campaigns, metrics: sumInsights(rows), range, warnings, responseTimeMs: insights.responseTimeMs };
}

async function safeGraph(path: string, token: string, params: Record<string, string>, warnings: string[], label: string) {
  const result = await graphGet(path, token, params);
  if (!result.ok) {
    warnings.push(`${label}: ${result.error?.errorMessage || "alınamadı"}`);
    return [];
  }
  return result.data?.data || [];
}

async function pullAdvancedMetaData(input: any, token: string, base: any) {
  const adAccount = String(input.adAccountId || "").replace(/^act_/, "");
  const warnings: string[] = [];
  const range = base.range || dateRangeForPreset(input.rangePreset || "last_30d", input.dateFrom, input.dateTo);
  const rangeParams = metaRangeParams(range);
  const insightFields = "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,reach,clicks,inline_link_clicks,spend,ctr,cpc,cpm,actions,action_values,date_start,date_stop";
  const [adsetInsights, adInsights] = await Promise.all([
    safeGraph(`act_${adAccount}/insights`, token, { fields: insightFields, level: "adset", ...rangeParams, limit: "200" }, warnings, "Reklam seti verileri"),
    safeGraph(`act_${adAccount}/insights`, token, { fields: insightFields, level: "ad", ...rangeParams, limit: "100" }, warnings, "Reklam verileri")
  ]);
  const [adsets, ads] = await Promise.all([
    safeGraph(`act_${adAccount}/adsets`, token, { fields: "id,name,campaign_id,status,effective_status,start_time,end_time,daily_budget,lifetime_budget,optimization_goal,targeting,updated_time,created_time", limit: "200" }, warnings, "Reklam seti yaşam döngüsü"),
    safeGraph(`act_${adAccount}/ads`, token, { fields: "id,name,campaign_id,adset_id,status,effective_status,created_time,updated_time,creative{id,thumbnail_url,image_url,object_story_spec,body,title,description}", limit: "100" }, warnings, "Kreatif verileri")
  ]);
  const [ageBreakdown, genderBreakdown, placementBreakdown, locationBreakdown] = await Promise.all([
    safeGraph(`act_${adAccount}/insights`, token, { fields: insightFields, level: "adset", breakdowns: "age", ...rangeParams, limit: "200" }, warnings, "Yaş kırılımı"),
    safeGraph(`act_${adAccount}/insights`, token, { fields: insightFields, level: "adset", breakdowns: "gender", ...rangeParams, limit: "200" }, warnings, "Cinsiyet kırılımı"),
    safeGraph(`act_${adAccount}/insights`, token, { fields: insightFields, level: "adset", breakdowns: "publisher_platform,platform_position", ...rangeParams, limit: "200" }, warnings, "Placement kırılımı"),
    safeGraph(`act_${adAccount}/insights`, token, { fields: insightFields, level: "adset", breakdowns: "region", ...rangeParams, limit: "200" }, warnings, "Şehir/bölge kırılımı")
  ]);
  const adsetMap = new Map(adsets.map((item: any) => [item.id, item]));
  const adMap = new Map(ads.map((item: any) => [item.id, item]));
  const byAdset = (rows: any[], id: string) => rows.filter((row) => row.adset_id === id || row.adsetId === id);
  const adsetRows = adsetInsights.map((row: any) => {
    const lifecycle = adsetMap.get(row.adset_id) || {};
    const actions = normalizeActions(row);
    const budget = Number(lifecycle.lifetime_budget || lifecycle.daily_budget || 0) / 100;
    return {
      company_id: input.companyId,
      meta_campaign_id: row.campaign_id,
      meta_adset_id: row.adset_id,
      adset_name: row.adset_name || lifecycle.name,
      date: row.date_start || range.until,
      period_start: range.since,
      period_end: range.until,
      date_range_label: range.label,
      spend: Number(row.spend || 0),
      impressions: Number(row.impressions || 0),
      reach: Number(row.reach || 0),
      clicks: Number(row.inline_link_clicks || row.clicks || 0),
      ctr: Number(row.ctr || 0),
      cpc: Number(row.cpc || 0),
      cpm: Number(row.cpm || 0),
      results: actions.leads || actions.messages || actions.purchases,
      leads: actions.leads,
      purchases: actions.purchases,
      messages: actions.messages,
      targeting_summary: lifecycle.targeting || {},
      age_breakdown: byAdset(ageBreakdown, row.adset_id),
      gender_breakdown: byAdset(genderBreakdown, row.adset_id),
      location_breakdown: byAdset(locationBreakdown, row.adset_id),
      placement_breakdown: byAdset(placementBreakdown, row.adset_id),
      start_time: lifecycle.start_time || null,
      stop_time: lifecycle.end_time || lifecycle.stop_time || null,
      daily_budget: Number(lifecycle.daily_budget || 0) / 100,
      lifetime_budget: Number(lifecycle.lifetime_budget || 0) / 100,
      optimization_goal: lifecycle.optimization_goal || "",
      status: lifecycle.effective_status || lifecycle.status || row.status || "",
      ...lifecycleStats(lifecycle.start_time, lifecycle.end_time || lifecycle.stop_time, Number(row.spend || 0), budget),
      raw_data: { insight: row, lifecycle }
    };
  });
  const adRows = adInsights.map((row: any) => {
    const lifecycle = adMap.get(row.ad_id) || {};
    const creative = normalizeCreative(lifecycle.creative || {});
    const actions = normalizeActions(row);
    return {
      company_id: input.companyId,
      meta_campaign_id: row.campaign_id,
      meta_adset_id: row.adset_id,
      meta_ad_id: row.ad_id,
      ad_name: row.ad_name || lifecycle.name,
      ...creative,
      date: row.date_start || range.until,
      period_start: range.since,
      period_end: range.until,
      date_range_label: range.label,
      spend: Number(row.spend || 0),
      impressions: Number(row.impressions || 0),
      reach: Number(row.reach || 0),
      clicks: Number(row.inline_link_clicks || row.clicks || 0),
      ctr: Number(row.ctr || 0),
      cpc: Number(row.cpc || 0),
      cpm: Number(row.cpm || 0),
      results: actions.leads || actions.messages || actions.purchases,
      leads: actions.leads,
      purchases: actions.purchases,
      add_to_cart: actions.add_to_cart,
      checkout: actions.checkout,
      messages: actions.messages,
      purchase_value: actions.purchase_value,
      roas: actions.roas,
      cost_per_lead: actions.cost_per_lead,
      cost_per_purchase: actions.cost_per_purchase,
      video_views: actions.video_views,
      video_3s_views: actions.video_3s_views,
      video_thruplay: actions.video_thruplay,
      video_p25: actions.video_p25,
      video_p50: actions.video_p50,
      video_p75: actions.video_p75,
      video_p95: actions.video_p95,
      thumb_stop_rate: actions.thumb_stop_rate,
      created_time: lifecycle.created_time || null,
      updated_time: lifecycle.updated_time || null,
      status: lifecycle.effective_status || lifecycle.status || "",
      ...lifecycleStats(lifecycle.created_time, null, Number(row.spend || 0), 0),
      raw_data: { insight: row, lifecycle }
    };
  });
  const conversionRows = adRows.flatMap((ad: any) => [
    ["lead", ad.leads, ad.cost_per_lead],
    ["message", ad.messages, ad.messages ? ad.spend / ad.messages : 0],
    ["purchase", ad.purchases, ad.cost_per_purchase],
    ["add_to_cart", ad.add_to_cart, ad.add_to_cart ? ad.spend / ad.add_to_cart : 0],
    ["initiate_checkout", ad.checkout, ad.checkout ? ad.spend / ad.checkout : 0]
  ].filter(([, count]) => Number(count || 0) > 0).map(([eventName, count, cost]) => ({
    company_id: input.companyId,
    meta_campaign_id: ad.meta_campaign_id,
    meta_adset_id: ad.meta_adset_id,
    meta_ad_id: ad.meta_ad_id,
    event_name: eventName,
    event_count: Number(count || 0),
    event_value: eventName === "purchase" ? Number(ad.purchase_value || 0) : 0,
    cost_per_event: Number(cost || 0),
    date: ad.date,
    raw_data: ad.raw_data || {}
  })));
  const bestCreative = [...adRows].sort((a: any, b: any) => Number(b.roas || b.ctr || 0) - Number(a.roas || a.ctr || 0))[0] || {};
  const weakestCreative = [...adRows].filter((item: any) => Number(item.impressions || 0) > 0).sort((a: any, b: any) => Number(a.ctr || 0) - Number(b.ctr || 0))[0] || {};
  const bestCampaign = [...(base.rows || [])].sort((a: any, b: any) => Number(b.results || b.leads || 0) - Number(a.results || a.leads || 0))[0] || {};
  const weakestCampaign = [...(base.rows || [])].filter((item: any) => Number(item.spend || 0) > 0).sort((a: any, b: any) => Number(a.results || a.leads || 0) - Number(b.results || b.leads || 0))[0] || {};
  const analysis = {
    company_id: input.companyId,
    period_start: range.since,
    period_end: range.until,
    best_creative: bestCreative,
    weakest_creative: weakestCreative,
    best_campaign: bestCampaign,
    weakest_campaign: weakestCampaign,
    budget_recommendation: "Bütçeyi yüksek CTR/ROAS üreten reklam ve kampanyalara kontrollü şekilde kaydırın.",
    pause_recommendations: adRows.filter((ad: any) => Number(ad.spend || 0) > 0 && Number(ad.ctr || 0) < 0.7).slice(0, 5),
    scale_recommendations: adRows.filter((ad: any) => Number(ad.ctr || 0) >= 1.5 || Number(ad.roas || 0) > 1).slice(0, 5),
    audience_recommendation: "Yaş, cinsiyet, placement ve bölge kırılımlarında düşük maliyetli dönüşüm getiren segmentlere ayrı test bütçesi açın.",
    creative_recommendation: "En iyi kreatifin mesaj açısını yeni varyasyonlarla test edin; zayıf kreatiflerde ilk 3 saniye dikkat unsurunu güçlendirin.",
    funnel_diagnosis: "Üst huni görünürlük, orta huni etkileşim ve alt huni dönüşüm verileri ayrı izlenmeli; eksik pixel olayları ayrıca kontrol edilmelidir.",
    ai_summary: "HK Intelligence analizi yerel kurallarla oluşturuldu. AI sağlayıcı aktifse bu özet daha sonra genişletilebilir."
  };
  return { adsetRows, adRows, conversionRows, analysis, warnings };
}

async function saveReportFromMeta(input: any, pulled: any) {
  if (!hasSupabaseConfig() || !input.companyId) return null;
  const period = pulled.range?.label || "Meta Sync";
  const fallback = [
    `Rapor veri aralığı: ${period}.`,
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
      raw_extracted_data: { source: "Meta Graph API", adAccountId: input.adAccountId, campaigns: pulled.campaigns || [], range: pulled.range || null, ai },
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
      source: String(details.source || "Meta Verilerini Çek"),
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
      period_start: row.period_start || pulled.range?.since || row.date || null,
      period_end: row.period_end || pulled.range?.until || row.date || null,
      date_range_label: row.date_range_label || pulled.range?.label || "Meta Sync",
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
    purchases: Number(row.purchases || 0),
    add_to_cart: Number(row.add_to_cart || 0),
    checkout: Number(row.checkout || 0),
    purchase_value: Number(row.purchase_value || 0),
    roas: Number(row.roas || 0),
    cost_per_lead: Number(row.cost_per_lead || 0),
    cost_per_purchase: Number(row.cost_per_purchase || 0),
    visible_to_customer: Boolean(input.visibleToCustomer),
      raw_data: { ...row, date_range: pulled.range || null }
  }));
  return supabaseRest<any[]>("campaign_metrics", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(records)
  });
}

async function localCampaignMap(companyId: string) {
  if (!hasSupabaseConfig() || !companyId) return new Map<string, any>();
  const campaigns = await supabaseRest<any[]>(`campaigns?company_id=eq.${encodeURIComponent(companyId)}&select=id,name,meta_campaign_id,external_id,settings`).catch(() => []);
  const map = new Map<string, any>();
  campaigns.forEach((campaign) => {
    [campaign.meta_campaign_id, campaign.external_id, campaign.name].filter(Boolean).forEach((key) => map.set(String(key), campaign));
  });
  return map;
}

async function saveCampaignLifecycle(input: any, pulled: any) {
  if (!hasSupabaseConfig() || !input.companyId || !pulled.campaigns?.length) return [];
  const campaigns = await supabaseRest<any[]>(`campaigns?company_id=eq.${encodeURIComponent(input.companyId)}&select=id,name,meta_campaign_id,external_id,settings`).catch(() => []);
  const updates = pulled.campaigns.map((meta: any) => {
    const local = campaigns.find((campaign) => campaign.meta_campaign_id === meta.id || campaign.external_id === meta.id || campaign.name === meta.name);
    if (!local?.id) return null;
    const budget = Number(meta.lifetime_budget || meta.daily_budget || 0) / 100;
    const spent = Number((pulled.rows || []).filter((row: any) => row.campaignId === meta.id).reduce((sum: number, row: any) => sum + Number(row.spend || 0), 0));
    const lifecycle = lifecycleStats(meta.start_time, meta.stop_time, spent, budget);
    return supabaseRest(`campaigns?id=eq.${local.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        meta_campaign_id: meta.id,
        external_id: meta.id,
        source: "Meta",
        status: meta.effective_status || meta.status || undefined,
        meta_start_time: meta.start_time || null,
        meta_stop_time: meta.stop_time || null,
        meta_created_time: meta.created_time || null,
        meta_updated_time: meta.updated_time || null,
        days_running: lifecycle.days_running,
        days_remaining: lifecycle.days_remaining,
        budget_consumption_percentage: lifecycle.budget_consumption_percentage,
        estimated_finish_date: lifecycle.estimated_finish_date,
        settings: { ...(local.settings || {}), meta_lifecycle: meta },
        updated_at: new Date().toISOString()
      })
    }).catch(() => null);
  }).filter(Boolean);
  return Promise.all(updates);
}

async function saveAdvancedMetaData(input: any, advanced: any) {
  const warnings = [...(advanced?.warnings || [])];
  if (!hasSupabaseConfig() || !input.companyId) return { adsets: [], ads: [], conversions: [], analysis: null, warnings };
  const campaigns = await localCampaignMap(input.companyId);
  const campaignFor = (row: any) => campaigns.get(String(row.meta_campaign_id || "")) || campaigns.get(String(row.campaign_name || row.adset_name || row.ad_name || ""));
  const withCampaign = (row: any) => ({ ...row, campaign_id: row.campaign_id || campaignFor(row)?.id || null });
  const postRows = async (table: string, rows: any[], label: string) => {
    if (!rows.length) return [];
    try {
      return await supabaseRest<any[]>(table, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(rows.map(withCampaign))
      });
    } catch (error) {
      const safe = getSafeSupabaseError(error);
      warnings.push(`${label}: ${safe.title}`);
      return [];
    }
  };
  const adsets = await postRows("meta_adset_metrics", advanced.adsetRows || [], "Reklam seti kayıtları");
  const ads = await postRows("meta_ad_metrics", advanced.adRows || [], "Reklam/kreatif kayıtları");
  const conversions = await postRows("meta_conversion_events", advanced.conversionRows || [], "Dönüşüm kayıtları");
  let analysis: any = null;
  if (advanced.analysis) {
    try {
      const rows = await supabaseRest<any[]>("meta_analysis_snapshots", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(advanced.analysis)
      });
      analysis = rows[0] || null;
    } catch (error) {
      const safe = getSafeSupabaseError(error);
      warnings.push(`HK Intelligence analizi: ${safe.title}`);
    }
  }
  return { adsets, ads, conversions, analysis, warnings };
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
    let advancedSaved: any = { adsets: [], ads: [], conversions: [], analysis: null, warnings: [] };
    try {
      savedRows = await saveMetaMetrics(input, pulled);
      await saveCampaignLifecycle(input, pulled);
      const advanced = await pullAdvancedMetaData(input, token, pulled);
      advancedSaved = await saveAdvancedMetaData(input, advanced);
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
    const allWarnings = [...(pulled.warnings || []), ...(advancedSaved.warnings || [])];
    const hasAdvancedWarnings = Boolean(allWarnings.length);
    const successMessage = action === "report" ? "Meta verilerinden rapor oluşturuldu." : hasAdvancedWarnings ? "Meta verileri çekildi; bazı ileri seviye veri gruplarında uyarı var." : "Meta verileri başarıyla çekildi.";
    const mappingRow = await updateMappingSyncState(input, hasAdvancedWarnings ? "Uyarı" : "Başarılı", successMessage);
    await writeSyncLog(input, hasAdvancedWarnings ? "Uyarı" : "Başarılı", successMessage, {
      source: "advanced_sync",
      rows: savedRows.length,
      adsets: advancedSaved.adsets?.length || 0,
      ads: advancedSaved.ads?.length || 0,
      conversions: advancedSaved.conversions?.length || 0,
      warnings: allWarnings,
      adAccountId: input.adAccountId
    });
    return NextResponse.json({
      ok: true,
      message: successMessage,
      metrics: pulled.metrics,
      rows: pulled.rows,
      savedRows,
      campaigns: pulled.campaigns,
      advanced: {
        adsets: advancedSaved.adsets || [],
        ads: advancedSaved.ads || [],
        conversions: advancedSaved.conversions || [],
        analysis: advancedSaved.analysis,
        warnings: allWarnings
      },
      warnings: allWarnings,
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
