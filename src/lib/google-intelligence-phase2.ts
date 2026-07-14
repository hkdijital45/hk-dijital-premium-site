/* eslint-disable @typescript-eslint/no-explicit-any */
import { decryptSecret, encryptSecret } from "@/lib/business-flow";
import { buildHKIntelligenceReport, diagnoseAdPerformance } from "@/lib/hk-intelligence-mvp";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export type GoogleDataStatus = "connected" | "waiting_connection" | "permission_required" | "api_not_enabled" | "error";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function metricValue(row: any, name: string) {
  const metric = (row?.metricValues || [])[name] || (row?.metricValues || [])[Number(name)];
  return numberValue(metric?.value);
}

function dimensionValue(row: any, index: number) {
  return clean((row?.dimensionValues || [])[index]?.value);
}

function googleErrorMessage(payload: any, fallback: string) {
  const raw = clean(payload?.error?.message || payload?.error_description || payload?.message || payload?.error || fallback);
  const lower = raw.toLocaleLowerCase("tr-TR");
  if (lower.includes("api has not been used") || lower.includes("disabled") || lower.includes("not enabled")) return "Google Cloud’da ilgili API etkinleştirilmelidir.";
  if (lower.includes("permission") || lower.includes("insufficient") || lower.includes("forbidden") || lower.includes("unauthorized")) return "Bu Google varlığını okumak için yetki gerekiyor.";
  if (lower.includes("developer token")) return "Google Ads için GOOGLE_ADS_DEVELOPER_TOKEN gerekir.";
  return raw || fallback;
}

async function googleJson(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {})
    },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(googleErrorMessage(payload, "Google API isteği başarısız oldu."));
  return payload;
}

function assetsByType(integration: any, matcher: (asset: any) => boolean) {
  return (Array.isArray(integration?.integration_assets) ? integration.integration_assets : []).filter(matcher);
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  if (!refreshToken || !clientId || !clientSecret) throw new Error("Google yetkisini yenilemek için refresh token ve OAuth ENV değerleri gerekir.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error("Google yetkisi yenilenemedi. Hesabı yeniden bağlayın.");
  return {
    accessToken: String(payload.access_token),
    expiresAt: new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString()
  };
}

export async function getCustomerGoogleIntegration(companyId: string) {
  if (!hasSupabaseConfig()) return { integration: null, accessToken: "", refreshToken: "", tokenExpiresAt: "", scopes: [] as string[], message: "Supabase bağlantısı yapılandırılmadı." };
  const rows = await supabaseRest<any[]>(`customer_integrations?or=(company_id.eq.${encodeURIComponent(companyId)},customer_id.eq.${encodeURIComponent(companyId)})&select=*&limit=1`).catch(() => []);
  const integration = rows[0] || null;
  const googleOauth = integration?.sensitive_metadata?.google_oauth || {};
  let accessToken = decryptSecret(googleOauth.access_token_encrypted) || (integration?.provider === "google" ? decryptSecret(integration?.access_token_encrypted) : "");
  const refreshToken = decryptSecret(googleOauth.refresh_token_encrypted) || (integration?.provider === "google" ? decryptSecret(integration?.refresh_token_encrypted) : "");
  let tokenExpiresAt = googleOauth.token_expires_at || integration?.token_expires_at || "";
  let message = accessToken ? "Google OAuth token hazır." : "Google bağlantısı bekleniyor.";
  const tokenExpired = tokenExpiresAt && new Date(tokenExpiresAt).getTime() <= Date.now() + 60_000;
  if (tokenExpired && refreshToken && integration?.id) {
    try {
      const refreshed = await refreshGoogleAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      tokenExpiresAt = refreshed.expiresAt;
      const sensitiveMetadata = {
        ...(integration.sensitive_metadata || {}),
        google_oauth: {
          ...googleOauth,
          access_token_encrypted: encryptSecret(refreshed.accessToken),
          token_expires_at: refreshed.expiresAt,
          updated_at: new Date().toISOString()
        }
      };
      await supabaseRest(`customer_integrations?id=eq.${encodeURIComponent(integration.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ sensitive_metadata: sensitiveMetadata, token_expires_at: refreshed.expiresAt, updated_at: new Date().toISOString() })
      });
      message = "Google OAuth yetkisi server-side yenilendi.";
    } catch {
      accessToken = "";
      message = "Google yetkisi yenilenemedi. Hesabı yeniden bağlayın.";
    }
  } else if (tokenExpired) {
    accessToken = "";
    message = "Google token süresi doldu ve refresh token bulunamadı. Hesabı yeniden bağlayın.";
  }
  return {
    integration,
    accessToken,
    refreshToken,
    tokenExpiresAt,
    scopes: Array.isArray(googleOauth.scopes) ? googleOauth.scopes : Array.isArray(integration?.scopes) ? integration.scopes : [],
    message
  };
}

export async function fetchGA4Metrics(accessToken: string, propertyId: string) {
  if (!accessToken) return { status: "waiting_connection" as GoogleDataStatus, message: "GA4 verisi için önce Google bağlantısı gerekir." };
  if (!propertyId) return { status: "waiting_connection" as GoogleDataStatus, message: "GA4 Property (Mülk) seçilmemiş." };
  try {
    const payload = await googleJson(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "engagedSessions" }, { name: "engagementRate" }, { name: "eventCount" }, { name: "conversions" }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }]
      })
    });
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const totals = rows.reduce((sum: any, row: any) => ({
      users: sum.users + metricValue(row, "0"),
      sessions: sum.sessions + metricValue(row, "1"),
      engagedSessions: sum.engagedSessions + metricValue(row, "2"),
      engagementRate: Math.max(sum.engagementRate, metricValue(row, "3")),
      events: sum.events + metricValue(row, "4"),
      conversions: sum.conversions + metricValue(row, "5")
    }), { users: 0, sessions: 0, engagedSessions: 0, engagementRate: 0, events: 0, conversions: 0 });
    return {
      status: "connected" as GoogleDataStatus,
      message: rows.length ? "GA4 verisi alındı." : "GA4 bağlantısı var, bu aralıkta veri bulunamadı.",
      metrics: { ...totals, topChannels: rows.slice(0, 6).map((row: any) => ({ channel: dimensionValue(row, 0), sessions: metricValue(row, "1") })) }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "GA4 verisi alınamadı.";
    return { status: message.includes("etkinleştirilmelidir") ? "api_not_enabled" as GoogleDataStatus : "permission_required" as GoogleDataStatus, message };
  }
}

export async function fetchSearchConsoleMetrics(accessToken: string, siteUrl: string) {
  if (!accessToken) return { status: "waiting_connection" as GoogleDataStatus, message: "Search Console verisi için önce Google bağlantısı gerekir." };
  if (!siteUrl) return { status: "waiting_connection" as GoogleDataStatus, message: "Search Console sitesi seçilmemiş." };
  try {
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    const common = { startDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), rowLimit: 10 };
    const [queries, pages] = await Promise.all([
      googleJson(endpoint, accessToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...common, dimensions: ["query"] }) }),
      googleJson(endpoint, accessToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...common, dimensions: ["page"] }) })
    ]);
    const queryRows = Array.isArray(queries.rows) ? queries.rows : [];
    const totals = queryRows.reduce((sum: any, row: any) => ({
      clicks: sum.clicks + numberValue(row.clicks),
      impressions: sum.impressions + numberValue(row.impressions),
      ctr: Math.max(sum.ctr, numberValue(row.ctr) * 100),
      averagePosition: sum.averagePosition ? Math.min(sum.averagePosition, numberValue(row.position)) : numberValue(row.position)
    }), { clicks: 0, impressions: 0, ctr: 0, averagePosition: 0 });
    return {
      status: "connected" as GoogleDataStatus,
      message: queryRows.length ? "Search Console verisi alındı." : "Search Console bağlantısı var, bu aralıkta veri bulunamadı.",
      metrics: {
        ...totals,
        topQueries: queryRows.map((row: any) => ({ query: row.keys?.[0] || "", clicks: numberValue(row.clicks), impressions: numberValue(row.impressions), position: numberValue(row.position) })),
        topPages: (Array.isArray(pages.rows) ? pages.rows : []).map((row: any) => ({ page: row.keys?.[0] || "", clicks: numberValue(row.clicks), impressions: numberValue(row.impressions), position: numberValue(row.position) }))
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search Console verisi alınamadı.";
    return { status: message.includes("etkinleştirilmelidir") ? "api_not_enabled" as GoogleDataStatus : "permission_required" as GoogleDataStatus, message };
  }
}

export async function fetchGoogleAdsMetrics(accessToken: string, customerId: string) {
  if (!accessToken) return { status: "waiting_connection" as GoogleDataStatus, message: "Google Ads verisi için önce Google bağlantısı gerekir." };
  if (!customerId) return { status: "waiting_connection" as GoogleDataStatus, message: "Google Ads Customer ID (Müşteri Kimliği) seçilmemiş." };
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return { status: "permission_required" as GoogleDataStatus, message: "Google Ads için GOOGLE_ADS_DEVELOPER_TOKEN gerekir." };
  try {
    const normalizedCustomerId = customerId.replace(/[^0-9]/g, "");
    const payload = await googleJson(`https://googleads.googleapis.com/v24/customers/${normalizedCustomerId}/googleAds:searchStream`, accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json", "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN },
      body: JSON.stringify({
        query: "SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date DURING LAST_30_DAYS LIMIT 50"
      })
    });
    const rows = (Array.isArray(payload) ? payload : []).flatMap((chunk: any) => Array.isArray(chunk.results) ? chunk.results : []);
    const totals = rows.reduce((sum: any, row: any) => {
      const metrics = row.metrics || {};
      const spend = numberValue(metrics.costMicros || metrics.cost_micros) / 1_000_000;
      const clicks = numberValue(metrics.clicks);
      const impressions = numberValue(metrics.impressions);
      return {
        spend: sum.spend + spend,
        impressions: sum.impressions + impressions,
        clicks: sum.clicks + clicks,
        conversions: sum.conversions + numberValue(metrics.conversions),
        conversionValue: sum.conversionValue + numberValue(metrics.conversionsValue || metrics.conversions_value),
        campaignCount: sum.campaignCount + 1
      };
    }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0, campaignCount: 0 });
    const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
    return {
      status: "connected" as GoogleDataStatus,
      message: rows.length ? "Google Ads verisi alındı." : "Google Ads bağlantısı var, bu aralıkta kampanya verisi bulunamadı.",
      metrics: { ...totals, ctr, cpc: totals.clicks ? totals.spend / totals.clicks : 0, cpm: totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0 }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Ads verisi alınamadı.";
    return { status: message.includes("etkinleştirilmelidir") ? "api_not_enabled" as GoogleDataStatus : "permission_required" as GoogleDataStatus, message };
  }
}

export async function fetchGoogleBusinessProfileMetrics(accessToken: string, locationId: string) {
  if (!accessToken) return { status: "waiting_connection" as GoogleDataStatus, message: "Google Business Profile için önce Google bağlantısı gerekir." };
  if (!locationId) return { status: "waiting_connection" as GoogleDataStatus, message: "Business Profile lokasyonu seçilmemiş." };
  return {
    status: "permission_required" as GoogleDataStatus,
    message: "Google Business Profile metrikleri için Business Profile Performance API erişimi gerekir. Lokasyon bağlantısı hazır olduğunda servis genişletilebilir.",
    metrics: {}
  };
}

export async function buildCustomerGoogleIntelligence(companyId: string, dateRange = "last_30d") {
  const { integration, accessToken, message, tokenExpiresAt, scopes } = await getCustomerGoogleIntegration(companyId);
  const googleAdsAsset = assetsByType(integration, (asset) => /google_ads/.test(`${asset.platform} ${asset.account_type} ${asset.asset_type}`));
  const ga4Asset = assetsByType(integration, (asset) => /ga4|analytics/.test(`${asset.platform} ${asset.account_type} ${asset.asset_type}`));
  const searchAsset = assetsByType(integration, (asset) => /search_console/.test(`${asset.platform} ${asset.account_type} ${asset.asset_type}`));
  const gbpAsset = assetsByType(integration, (asset) => /google_business|business_profile/.test(`${asset.platform} ${asset.account_type} ${asset.asset_type}`));
  const [googleAds, ga4, searchConsole, businessProfile] = await Promise.all([
    fetchGoogleAdsMetrics(accessToken, clean(googleAdsAsset[0]?.provider_account_id || googleAdsAsset[0]?.account_id || googleAdsAsset[0]?.asset_id || integration?.google_ads_customer_id)),
    fetchGA4Metrics(accessToken, clean(ga4Asset[0]?.provider_account_id || ga4Asset[0]?.asset_id || integration?.ga4_property_id)),
    fetchSearchConsoleMetrics(accessToken, clean(searchAsset[0]?.provider_account_id || searchAsset[0]?.asset_id || integration?.search_console_site_url)),
    fetchGoogleBusinessProfileMetrics(accessToken, clean(gbpAsset[0]?.provider_account_id || gbpAsset[0]?.asset_id || integration?.google_business_profile_id))
  ]);
  const enrichedIntegration = {
    ...(integration || {}),
    google_oauth_status: accessToken ? "connected" : "waiting_connection",
    google_token_expires_at: tokenExpiresAt,
    google_scopes: scopes,
    google_ads_customer_id: googleAdsAsset[0]?.provider_account_id || googleAdsAsset[0]?.account_id || integration?.google_ads_customer_id,
    ga4_property_id: ga4Asset[0]?.provider_account_id || ga4Asset[0]?.asset_id || integration?.ga4_property_id,
    search_console_site_url: searchAsset[0]?.provider_account_id || searchAsset[0]?.asset_id || integration?.search_console_site_url,
    google_business_profile_id: gbpAsset[0]?.provider_account_id || gbpAsset[0]?.asset_id || integration?.google_business_profile_id,
    googleAdsMetrics: googleAds.metrics || {},
    ga4Metrics: ga4.metrics || {},
    searchConsoleMetrics: searchConsole.metrics || {},
    googleBusinessMetrics: businessProfile.metrics || {},
    googleDataStatuses: { googleAds, ga4, searchConsole, businessProfile }
  };
  return {
    integration: enrichedIntegration,
    google: { accessReady: Boolean(accessToken), message, statuses: enrichedIntegration.googleDataStatuses },
    report: buildHKIntelligenceReport({ customerId: companyId, integration: enrichedIntegration, dateRange }),
    adDoctor: diagnoseAdPerformance({ platform: "google_ads", ...(googleAds.metrics || {}), hasTracking: Boolean(Object.keys(ga4.metrics || {}).length || Object.keys(searchConsole.metrics || {}).length), dateRange })
  };
}
