/* eslint-disable @typescript-eslint/no-explicit-any */
import { decryptSecret } from "@/lib/business-flow";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const GRAPH_VERSION = "v20.0";

export const META_BUSINESS_REQUIRED_SCOPES = ["business_management", "ads_read", "pages_show_list", "instagram_basic"];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metaApiMessage(payload: any, fallback: string) {
  const message = clean(payload?.error?.message || payload?.message);
  const code = clean(payload?.error?.code || payload?.code);
  const type = clean(payload?.error?.type);
  if (message.toLocaleLowerCase("tr-TR").includes("permission")) return "Meta izni yetersiz. App Review izinlerini ve müşteri onayını kontrol edin.";
  if (message.toLocaleLowerCase("tr-TR").includes("expired")) return "Meta oturumu süresi dolmuş. Lütfen Meta ile yeniden giriş yapın.";
  if (message.toLocaleLowerCase("tr-TR").includes("rate") || code === "4" || code === "17") return "Meta API limitine takıldı. Bir süre sonra tekrar deneyin.";
  return message || type || fallback;
}

async function graphGet(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(metaApiMessage(payload, "Meta API isteği başarısız oldu."));
  return payload;
}

function normalizeAsset(input: {
  type: string;
  category: string;
  platform: string;
  item: any;
  parent?: Record<string, unknown>;
}) {
  const item = input.item || {};
  const id = clean(item.id || item.account_id);
  const name = clean(item.name || item.account_name || item.username || id);
  const now = new Date().toISOString();
  return {
    id: `meta-${input.type}-${id}`,
    provider: "meta",
    platform: input.platform,
    category: input.category,
    account_type: input.type,
    asset_type: input.type,
    provider_account_id: id,
    provider_account_name: name,
    account_id: id,
    asset_id: id,
    asset_name: name,
    status: item.account_status ? `Durum: ${item.account_status}` : "Seçilebilir",
    last_synced_at: now,
    connection_method: "oauth",
    connection_mode: "oauth",
    oauth_status: "connected",
    scopes: META_BUSINESS_REQUIRED_SCOPES,
    oauth_scopes: META_BUSINESS_REQUIRED_SCOPES,
    metadata: { ...item, parent: input.parent || null }
  };
}

export async function listMetaBusinessAssets(accessToken: string) {
  if (!accessToken) throw new Error("Önce Meta ile giriş yapın.");
  const warnings: string[] = [];
  const [businessesResult, adAccountsResult, pagesResult] = await Promise.allSettled([
    graphGet("me/businesses", accessToken, { fields: "id,name,verification_status,created_time", limit: "100" }),
    graphGet("me/adaccounts", accessToken, { fields: "id,name,account_id,account_status,currency,business{name,id}", limit: "100" }),
    graphGet("me/accounts", accessToken, { fields: "id,name,category,access_token,instagram_business_account{id,username,name,profile_picture_url}", limit: "100" })
  ]);

  function resultData(result: PromiseSettledResult<any>, label: string) {
    if (result.status === "fulfilled") return Array.isArray(result.value?.data) ? result.value.data : [];
    warnings.push(`${label}: ${result.reason instanceof Error ? result.reason.message : "Veri alınamadı."}`);
    return [];
  }

  const businesses = resultData(businessesResult, "Business Manager");
  const adAccounts = resultData(adAccountsResult, "Reklam hesapları");
  const pages = resultData(pagesResult, "Facebook Sayfaları");
  const instagramAccounts = pages.flatMap((page: any) => page.instagram_business_account ? [{ ...page.instagram_business_account, page_id: page.id, page_name: page.name }] : []);
  const accounts = [
    ...businesses.map((item: any) => normalizeAsset({ type: "meta_business", category: "Business Manager", platform: "meta", item })),
    ...adAccounts.map((item: any) => normalizeAsset({ type: "meta_ad_account", category: "Reklam Hesapları", platform: "meta", item })),
    ...pages.map((item: any) => normalizeAsset({ type: "facebook_page", category: "Facebook Sayfaları", platform: "facebook", item })),
    ...instagramAccounts.map((item: any) => normalizeAsset({ type: "instagram_business", category: "Instagram Business", platform: "instagram", item, parent: { page_id: item.page_id, page_name: item.page_name } }))
  ];
  return {
    accounts,
    groups: {
      "Business Manager": businesses.length,
      "Reklam Hesapları": adAccounts.length,
      "Facebook Sayfaları": pages.length,
      "Instagram Business": instagramAccounts.length
    },
    warnings,
    message: accounts.length ? "Meta Business varlıkları listelendi." : "Meta bağlantısı başarılı; listelenebilir business varlığı bulunamadı."
  };
}

function actionValue(actions: any[] = [], names: string[]) {
  const normalized = names.map((name) => name.toLocaleLowerCase("tr-TR"));
  return actions
    .filter((item) => normalized.includes(clean(item.action_type || item.type).toLocaleLowerCase("tr-TR")))
    .reduce((sum, item) => sum + numberValue(item.value), 0);
}

export function normalizeMetaInsightRows(rows: any[] = []) {
  return rows.map((row) => {
    const spend = numberValue(row.spend);
    const impressions = numberValue(row.impressions);
    const reach = numberValue(row.reach);
    const clicks = numberValue(row.inline_link_clicks || row.clicks);
    const leads = actionValue(row.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
    const messages = actionValue(row.actions, ["onsite_conversion.messaging_conversation_started_7d", "messaging_conversation_started_7d", "messaging_conversation_started"]);
    return {
      date: row.date_start || row.date_stop || new Date().toISOString().slice(0, 10),
      campaignId: clean(row.campaign_id),
      campaignName: clean(row.campaign_name || "Meta Kampanya"),
      spend,
      impressions,
      reach,
      clicks,
      ctr: numberValue(row.ctr) || (impressions ? (clicks / impressions) * 100 : 0),
      cpc: numberValue(row.cpc) || (clicks ? spend / clicks : 0),
      cpm: numberValue(row.cpm) || (impressions ? (spend / impressions) * 1000 : 0),
      leads,
      messages,
      results: leads || messages,
      raw: row
    };
  });
}

function sumMetrics(rows: any[]) {
  const total = rows.reduce((acc, row) => ({
    spend: acc.spend + numberValue(row.spend),
    impressions: acc.impressions + numberValue(row.impressions),
    reach: acc.reach + numberValue(row.reach),
    clicks: acc.clicks + numberValue(row.clicks),
    leads: acc.leads + numberValue(row.leads),
    messages: acc.messages + numberValue(row.messages),
    results: acc.results + numberValue(row.results)
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, messages: 0, results: 0 });
  return {
    ...total,
    ctr: total.impressions ? (total.clicks / total.impressions) * 100 : 0,
    cpc: total.clicks ? total.spend / total.clicks : 0,
    cpm: total.impressions ? (total.spend / total.impressions) * 1000 : 0
  };
}

export function buildMetaInsightAdapter(input: { accountId: string; rows: any[]; warnings?: string[]; dateRange?: string }) {
  const normalizedRows = normalizeMetaInsightRows(input.rows);
  const metrics = sumMetrics(normalizedRows);
  const warnings = [...(input.warnings || [])];
  const opportunities: string[] = [];
  const nextActions: string[] = [];
  if (!normalizedRows.length) warnings.push("Seçili tarih aralığında Meta reklam verisi bulunamadı.");
  if (metrics.impressions && metrics.ctr < 1) {
    warnings.push("Tıklama oranı düşük görünüyor.");
    nextActions.push("Kreatif hook ve teklif dilini yenile.");
  }
  if (metrics.spend && !metrics.results) {
    warnings.push("Harcama var ancak sonuç/lead sinyali yok.");
    nextActions.push("Dönüşüm ölçümünü, WhatsApp/Form olaylarını ve kampanya hedefini kontrol et.");
  }
  if (metrics.results && metrics.cpc > 0) opportunities.push("Sonuç sinyali var; iyi çalışan kampanya/kreatif varyasyonları ölçeklenebilir.");
  if (!nextActions.length) nextActions.push("Son 30 gün verisini Reklam Yorum Merkezi'nde yorumlayıp rapor aksiyonuna dönüştür.");
  return {
    platform: "meta",
    accountId: input.accountId,
    dateRange: input.dateRange || "last_30d",
    metrics,
    rows: normalizedRows,
    warnings,
    opportunities,
    nextActions
  };
}

export async function fetchMetaInsightsForAccount(accessToken: string, accountId: string, datePreset = "last_30d") {
  const safeAccountId = clean(accountId).replace(/^act_/, "");
  if (!accessToken) throw new Error("Meta access token bulunamadı. Önce Meta ile giriş yapın.");
  if (!safeAccountId) throw new Error("Meta reklam hesabı seçilmedi.");
  const fields = ["campaign_id", "campaign_name", "impressions", "reach", "clicks", "inline_link_clicks", "spend", "ctr", "cpc", "cpm", "actions", "date_start", "date_stop"].join(",");
  const payload = await graphGet(`act_${safeAccountId}/insights`, accessToken, { fields, level: "campaign", time_increment: "1", date_preset: datePreset, limit: "200" });
  return buildMetaInsightAdapter({ accountId: safeAccountId, rows: Array.isArray(payload.data) ? payload.data : [], dateRange: datePreset });
}

export async function tokenForCustomerMetaIntegration(companyId: string) {
  if (!hasSupabaseConfig()) return { token: "", integration: null, message: "Supabase bağlantısı yapılandırılmadı." };
  const rows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`).catch(() => []);
  const integration = rows[0] || null;
  let token = "";
  try {
    token = decryptSecret(integration?.access_token_encrypted);
  } catch {
    token = "";
  }
  return {
    token,
    integration,
    message: token ? "Token hazır." : "Önce Meta ile giriş yapın."
  };
}
