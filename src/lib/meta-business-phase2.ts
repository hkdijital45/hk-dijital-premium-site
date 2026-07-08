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

function requiredPermissionForEndpoint(endpoint: string) {
  if (endpoint.includes("/adaccounts")) return "ads_read";
  if (endpoint.includes("/businesses")) return "business_management";
  if (endpoint.includes("/accounts")) return "pages_show_list";
  if (endpoint.includes("instagram_business_account")) return "instagram_basic";
  return "";
}

function userMessageForEndpoint(endpoint: string, ok: boolean, payload: any, dataCount = 0) {
  if (ok) return dataCount ? "Erişim başarılı." : "Erişim başarılı ancak kayıt bulunamadı.";
  const message = metaApiMessage(payload, "Meta API erişimi başarısız oldu.");
  const permission = requiredPermissionForEndpoint(endpoint);
  if (permission === "ads_read") return "Reklam hesabı otomatik listeleme ve insight verisi için ads_read izni ve App Review gerekir.";
  if (permission === "business_management") return "Business Manager listeleme için business_management izni ve Business Verification gerekir.";
  if (permission === "pages_show_list") return "Facebook Sayfaları listeleme için pages_show_list izni ve App Review gerekir.";
  if (permission === "instagram_basic") return "Instagram Business listeleme için instagram_basic izni ve App Review gerekir.";
  return message;
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

async function graphDiagnostic(endpoint: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${endpoint.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  const data = Array.isArray(payload?.data) ? payload.data : payload?.id ? [payload] : [];
  return {
    endpoint: `/${endpoint.replace(/^\//, "")}`,
    ok: response.ok,
    status: response.status,
    dataCount: data.length,
    errorCode: payload?.error?.code || null,
    errorSubcode: payload?.error?.error_subcode || payload?.error?.subcode || null,
    errorMessage: response.ok ? "" : metaApiMessage(payload, "Meta API erişimi başarısız oldu."),
    requiredPermission: requiredPermissionForEndpoint(endpoint),
    userMessage: userMessageForEndpoint(endpoint, response.ok, payload, data.length),
    data
  };
}

export async function diagnoseMetaBusinessAccess(accessToken: string, runBusinessChecks: boolean) {
  if (!accessToken) {
    return {
      ok: false,
      businessApiEnabled: runBusinessChecks,
      businessApiReady: false,
      userMessage: "Önce Meta ile giriş yapın.",
      checks: []
    };
  }
  const me = await graphDiagnostic("me", accessToken, { fields: "id,name,email" });
  const checks = [me];
  if (!runBusinessChecks) {
    return {
      ok: me.ok,
      businessApiEnabled: false,
      businessApiReady: false,
      manualAdAccountSupported: true,
      manualFallbackMessage: "Business doğrulaması yokken manuel reklam hesabı ID ile devam edebilirsiniz.",
      user: me.ok ? { id: clean(me.data[0]?.id), name: clean(me.data[0]?.name), email: clean(me.data[0]?.email) } : null,
      checks,
      userMessage: "Business API teşhisi kapalı. Temel Facebook Login public_profile,email ile çalışır; reklam hesabı manuel ID ile bağlanabilir."
    };
  }
  const [businesses, adAccounts, pages] = await Promise.all([
    graphDiagnostic("me/businesses", accessToken, { fields: "id,name,verification_status,created_time", limit: "100" }),
    graphDiagnostic("me/adaccounts", accessToken, { fields: "id,name,account_id,account_status,currency,business{name,id}", limit: "100" }),
    graphDiagnostic("me/accounts", accessToken, { fields: "id,name,category,instagram_business_account{id,username,name,profile_picture_url}", limit: "100" })
  ]);
  checks.push(businesses, adAccounts, pages);
  const permissionProblems = checks.filter((item) => !item.ok && item.requiredPermission);
  return {
    ok: me.ok,
    businessApiEnabled: true,
    businessApiReady: checks.slice(1).some((item) => item.ok && item.dataCount > 0),
    manualAdAccountSupported: true,
    manualFallbackMessage: "Business Verification veya App Review tamamlanana kadar reklam hesabı ID'sini manuel bağlayabilirsiniz.",
    user: me.ok ? { id: clean(me.data[0]?.id), name: clean(me.data[0]?.name), email: clean(me.data[0]?.email) } : null,
    checks,
    userMessage: permissionProblems.length
      ? "Meta temel bağlantısı tamamlandı. Otomatik reklam hesabı listeleme için ads_read, Business Manager için business_management izni gerekir; şimdilik manuel reklam hesabı ID ile devam edebilirsiniz."
      : "Meta Business API teşhisi tamamlandı."
  };
}

export function publicMetaDiagnostics(diagnostics: any) {
  return {
    ...diagnostics,
    checks: (diagnostics?.checks || []).map((item: any) => {
      const safeItem = { ...item };
      delete safeItem.data;
      return safeItem;
    })
  };
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
  const diagnostics = await diagnoseMetaBusinessAccess(accessToken, true);
  const warnings = diagnostics.checks.filter((item: any) => !item.ok).map((item: any) => `${item.endpoint}: ${item.userMessage}`);
  const businesses = diagnostics.checks.find((item: any) => item.endpoint === "/me/businesses")?.data || [];
  const adAccounts = diagnostics.checks.find((item: any) => item.endpoint === "/me/adaccounts")?.data || [];
  const pages = diagnostics.checks.find((item: any) => item.endpoint === "/me/accounts")?.data || [];
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
    diagnostics: publicMetaDiagnostics(diagnostics),
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
  try {
    const payload = await graphGet(`act_${safeAccountId}/insights`, accessToken, { fields, level: "campaign", time_increment: "1", date_preset: datePreset, limit: "200" });
    return buildMetaInsightAdapter({ accountId: safeAccountId, rows: Array.isArray(payload.data) ? payload.data : [], dateRange: datePreset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta insight verisi alınamadı.";
    if (message.toLocaleLowerCase("tr-TR").includes("izin") || message.toLocaleLowerCase("tr-TR").includes("permission")) {
      throw new Error("Reklam hesabı kaydedildi ancak Meta API verisi için ads_read izni gerekir. Manuel kayıt korunur; izin açıldığında aynı hesaptan veri çekimi tekrar denenebilir.");
    }
    throw error;
  }
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
