import "server-only";
import { writeDailyMetrics } from "../metrics-store";
import { campaignMetricKey } from "../campaign-keys";
import type { ConnectionAsset, DailyMetricRow, DateRange, SyncOutcome } from "../types";

export { campaignMetricKey, isCampaignMetricKey, parseCampaignMetricKey } from "../campaign-keys";

// Google Ads API v25 — matches the version used by
// src/lib/customer-integration-oauth.ts's customers:listAccessibleCustomers
// discovery call (bumped together from v24, both current/supported as of
// 2026-09). Google sunset developer tokens on 2026-09-09: API access is now
// tied to the Google Cloud project behind GOOGLE_CLIENT_ID/SECRET, not a
// separate token — the header is optional and ignored by Google's servers,
// so it's sent only if still configured (harmless) and never required.
// GOOGLE_ADS_LOGIN_CUSTOMER_ID is unrelated to that change and still
// required when the connected account is managed under an MCC.
const ADS_BASE = "https://googleads.googleapis.com/v25";

// Campaign-level metric_key encoding (campaignMetricKey/isCampaignMetricKey/
// parseCampaignMetricKey) now lives in ../campaign-keys.ts (pure, no
// server-only import) and is re-exported above for existing call sites.

async function googleAdsSearch(customerId: string, accessToken: string, query: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) headers["developer-token"] = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
  const response = await fetch(`${ADS_BASE}/customers/${customerId.replace(/-/g, "")}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || `Google Ads API isteği başarısız oldu (HTTP ${response.status}).`;
    if (response.status === 403 || response.status === 401) throw new Error(`Google Ads erişim izni eksik: ${detail} Müşteri panelinden Google ile yeniden bağlanmak gerekebilir.`);
    throw new Error(detail);
  }
  return Array.isArray(payload.results) ? payload.results : [];
}

export async function syncGoogleAdsAnalytics(companyId: string, accessToken: string, asset: ConnectionAsset, range: DateRange): Promise<SyncOutcome> {
  const customerId = asset.provider_account_id;
  if (!customerId) return { provider: "google_ads", ok: false, message: "Google Ads müşteri numarası bulunamadı.", dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };

  const query = `SELECT campaign.id, campaign.name, campaign.status, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
                 FROM campaign
                 WHERE segments.date BETWEEN '${range.startDate}' AND '${range.endDate}'`;

  let results: any[];
  try {
    results = await googleAdsSearch(customerId, accessToken, query);
  } catch (error) {
    return { provider: "google_ads", ok: false, message: error instanceof Error ? error.message : "Google Ads verisi alınamadı.", dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };
  }

  const accountTotalsByDate = new Map<string, { cost: number; impressions: number; clicks: number; conversions: number; conversionsValue: number }>();
  const rows: DailyMetricRow[] = [];

  for (const result of results) {
    const date: string = result.segments?.date;
    if (!date) continue;
    const costMicros = Number(result.metrics?.costMicros || 0);
    const cost = costMicros / 1_000_000;
    const impressions = Number(result.metrics?.impressions || 0);
    const clicks = Number(result.metrics?.clicks || 0);
    const conversions = Number(result.metrics?.conversions || 0);
    const conversionsValue = Number(result.metrics?.conversionsValue || 0);
    const campaignId = String(result.campaign?.id || "");
    const campaignName = String(result.campaign?.name || "");
    const campaignStatus = String(result.campaign?.status || "");

    const totals = accountTotalsByDate.get(date) || { cost: 0, impressions: 0, clicks: 0, conversions: 0, conversionsValue: 0 };
    totals.cost += cost;
    totals.impressions += impressions;
    totals.clicks += clicks;
    totals.conversions += conversions;
    totals.conversionsValue += conversionsValue;
    accountTotalsByDate.set(date, totals);

    if (campaignId) {
      const dims = { campaign_name: campaignName, campaign_status: campaignStatus };
      rows.push({ companyId, provider: "google_ads", assetId: customerId, metricDate: date, metricKey: campaignMetricKey("cost", campaignId), metricValue: cost, currency: "TRY", dimensions: dims });
      rows.push({ companyId, provider: "google_ads", assetId: customerId, metricDate: date, metricKey: campaignMetricKey("impressions", campaignId), metricValue: impressions, dimensions: dims });
      rows.push({ companyId, provider: "google_ads", assetId: customerId, metricDate: date, metricKey: campaignMetricKey("clicks", campaignId), metricValue: clicks, dimensions: dims });
      rows.push({ companyId, provider: "google_ads", assetId: customerId, metricDate: date, metricKey: campaignMetricKey("conversions", campaignId), metricValue: conversions, dimensions: dims });
      rows.push({ companyId, provider: "google_ads", assetId: customerId, metricDate: date, metricKey: campaignMetricKey("conversionsValue", campaignId), metricValue: conversionsValue, currency: "TRY", dimensions: dims });
    }
  }

  for (const [date, totals] of accountTotalsByDate) {
    rows.push({ companyId, provider: "google_ads", assetId: customerId, metricDate: date, metricKey: "cost", metricValue: totals.cost, currency: "TRY" });
    rows.push({ companyId, provider: "google_ads", assetId: customerId, metricDate: date, metricKey: "impressions", metricValue: totals.impressions });
    rows.push({ companyId, provider: "google_ads", assetId: customerId, metricDate: date, metricKey: "clicks", metricValue: totals.clicks });
    rows.push({ companyId, provider: "google_ads", assetId: customerId, metricDate: date, metricKey: "conversions", metricValue: totals.conversions });
    rows.push({ companyId, provider: "google_ads", assetId: customerId, metricDate: date, metricKey: "conversionsValue", metricValue: totals.conversionsValue, currency: "TRY" });
    rows.push({ companyId, provider: "google_ads", assetId: customerId, metricDate: date, metricKey: "ctr", metricValue: totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0 });
    rows.push({ companyId, provider: "google_ads", assetId: customerId, metricDate: date, metricKey: "averageCpc", metricValue: totals.clicks ? totals.cost / totals.clicks : 0, currency: "TRY" });
    rows.push({ companyId, provider: "google_ads", assetId: customerId, metricDate: date, metricKey: "costPerConversion", metricValue: totals.conversions ? totals.cost / totals.conversions : 0, currency: "TRY" });
  }

  const dailyMetricsWritten = await writeDailyMetrics(rows);
  return {
    provider: "google_ads",
    ok: true,
    message: `Google Ads senkronize edildi: ${dailyMetricsWritten} metrik satırı (${accountTotalsByDate.size} gün, kampanya kırılımı dahil).`,
    dailyMetricsWritten,
    contentMetricsWritten: 0,
    warnings: []
  };
}
