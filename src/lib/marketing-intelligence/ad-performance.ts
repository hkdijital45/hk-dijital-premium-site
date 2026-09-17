// Real, company-scoped Meta/Google Ads performance reads for the
// Marketing Intelligence MCP tools. Reuses the EXISTING, working
// /api/admin/meta-ads route's internal functions directly (exported for
// this purpose, logic untouched) rather than duplicating or rewriting
// that 760+ line route. Read-only: only the fetch/read path is called,
// never the save/sync-to-DB side of that route.
import { findCustomerMetaMapping, tokenForIntegration, pullMetaData } from "@/app/api/admin/meta-ads/route";
import { syncCompanyAnalytics, defaultSyncRange } from "@/lib/analytics-center/sync";
import { queryDailyMetrics, analyticsTablesReady } from "@/lib/analytics-center/metrics-store";
import type { DateRange } from "@/lib/analytics-center/types";

export type AdPerformanceResult =
  | { connected: false; reason: "ACCOUNT_NOT_MAPPED" | "AUTH_EXPIRED" }
  | { connected: true; ok: false; reason: "UPSTREAM_API_ERROR"; message: string }
  | { connected: true; ok: true; range: unknown; metrics: unknown; campaigns: unknown; rows: unknown; warnings: string[] };

export async function getMetaAdsPerformance(companyId: string, rangePreset = "last_30d", dateFrom?: string, dateTo?: string): Promise<AdPerformanceResult> {
  const mapping = await findCustomerMetaMapping(companyId);
  const adAccountId = mapping?.ad_account_id || mapping?.account_id;
  if (!adAccountId) return { connected: false, reason: "ACCOUNT_NOT_MAPPED" };

  const { token } = await tokenForIntegration(mapping.id);
  if (!token) return { connected: false, reason: "AUTH_EXPIRED" };

  const pulled = await pullMetaData({
    companyId,
    adAccountId,
    businessId: mapping.business_id || mapping.business_account_id,
    pageId: mapping.page_id,
    instagramAccountId: mapping.instagram_account_id,
    integrationId: mapping.id,
    rangePreset,
    dateFrom,
    dateTo
  }, token);

  if (!pulled.ok) return { connected: true, ok: false, reason: "UPSTREAM_API_ERROR", message: pulled.errorMessage || "Meta API hatası." };
  return { connected: true, ok: true, range: pulled.range, metrics: pulled.metrics, campaigns: pulled.campaigns, rows: pulled.rows, warnings: pulled.warnings || [] };
}

export type GoogleAdsPerformanceResult =
  | { connected: false; reason: "TABLES_NOT_READY" | "NOT_CONNECTED" | "ACCOUNT_NOT_MAPPED" }
  | { connected: true; ok: false; reason: "UPSTREAM_API_ERROR"; message: string; warnings: string[] }
  | { connected: true; ok: true; message: string; range: DateRange; rows: unknown[]; warnings: string[] };

/** Reuses Analiz & Raporlama Merkezi's real sync pipeline end to end
 * (token resolution, the actual Google Ads API call, storage) and then
 * reads the real numbers back — no separate Google Ads client, no
 * duplicated query logic. */
export async function getGoogleAdsPerformance(companyId: string, range: DateRange = defaultSyncRange()): Promise<GoogleAdsPerformanceResult> {
  if (!(await analyticsTablesReady())) return { connected: false, reason: "TABLES_NOT_READY" };

  const [outcome] = await syncCompanyAnalytics(companyId, ["google_ads"], range);
  if (!outcome.ok) {
    const reason = /bağlı değil/i.test(outcome.message) ? "NOT_CONNECTED" : /hesap|customer/i.test(outcome.message) ? "ACCOUNT_NOT_MAPPED" : null;
    if (reason) return { connected: false, reason: reason as "NOT_CONNECTED" | "ACCOUNT_NOT_MAPPED" };
    return { connected: true, ok: false, reason: "UPSTREAM_API_ERROR", message: outcome.message, warnings: outcome.warnings };
  }

  const rows = await queryDailyMetrics(companyId, ["google_ads"], range);
  return { connected: true, ok: true, message: outcome.message, range, rows, warnings: outcome.warnings };
}
