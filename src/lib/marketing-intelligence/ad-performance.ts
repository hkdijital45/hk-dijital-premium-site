// Real, company-scoped Meta/Google Ads performance reads for the
// Marketing Intelligence MCP tools. Reuses the EXISTING, working
// /api/admin/meta-ads route's internal functions directly (exported for
// this purpose, logic untouched) rather than duplicating or rewriting
// that 760+ line route. Read-only: only the fetch/read path is called,
// never the save/sync-to-DB side of that route.
import { findCustomerMetaMapping, tokenForIntegration, pullMetaData, graphGet } from "@/app/api/admin/meta-ads/route";
import { syncCompanyAnalytics, defaultSyncRange } from "@/lib/analytics-center/sync";
import { queryDailyMetrics, analyticsTablesReady } from "@/lib/analytics-center/metrics-store";
import { getProviderToken } from "@/lib/analytics-center/tokens";
import { getGoogleAdsAccountInfo, type GoogleAdsAccountInfo } from "@/lib/analytics-center/providers/google-ads";
import { supabaseRest } from "@/lib/supabase";
import type { DateRange } from "@/lib/analytics-center/types";

export type MetaAdAccountInfo = { id: string; name: string | null; currency: string | null; timezone: string | null; status: string | null };

export type AdPerformanceResult =
  | { connected: false; reason: "ACCOUNT_NOT_MAPPED" | "AUTH_EXPIRED" }
  | { connected: true; ok: false; reason: "UPSTREAM_API_ERROR"; message: string }
  | { connected: true; ok: true; account: MetaAdAccountInfo | null; range: unknown; metrics: unknown; campaigns: unknown; rows: unknown; warnings: string[] };

/** Meta account_status is a numeric code (1=ACTIVE, 2=DISABLED, 3=UNSETTLED,
 * 7=PENDING_RISK_REVIEW, 9=IN_GRACE_PERIOD, 101=temporarily unavailable,
 * etc. per Meta's Marketing API) — mapped to the few states worth
 * surfacing to an analysis prompt; unmapped codes pass through as-is
 * rather than being silently hidden. */
const META_ACCOUNT_STATUS: Record<number, string> = { 1: "ACTIVE", 2: "DISABLED", 3: "UNSETTLED", 7: "PENDING_RISK_REVIEW", 9: "IN_GRACE_PERIOD", 100: "PENDING_CLOSURE", 101: "TEMPORARILY_UNAVAILABLE" };

async function fetchMetaAccountInfo(adAccountId: string, token: string): Promise<MetaAdAccountInfo | null> {
  const result = await graphGet(`act_${adAccountId.replace(/^act_/, "")}`, token, { fields: "name,currency,timezone_name,account_status" });
  if (!result.ok) return null;
  const data = result.data as { name?: string; currency?: string; timezone_name?: string; account_status?: number };
  return {
    id: adAccountId,
    name: data.name || null,
    currency: data.currency || null,
    timezone: data.timezone_name || null,
    status: data.account_status ? (META_ACCOUNT_STATUS[data.account_status] || String(data.account_status)) : null
  };
}

export async function getMetaAdsPerformance(companyId: string, rangePreset = "last_30d", dateFrom?: string, dateTo?: string): Promise<AdPerformanceResult> {
  const mapping = await findCustomerMetaMapping(companyId);
  const adAccountId = mapping?.ad_account_id || mapping?.account_id;
  if (!adAccountId) return { connected: false, reason: "ACCOUNT_NOT_MAPPED" };

  const { token } = await tokenForIntegration(mapping.id);
  if (!token) return { connected: false, reason: "AUTH_EXPIRED" };

  const [pulled, account] = await Promise.all([
    pullMetaData({
      companyId,
      adAccountId,
      businessId: mapping.business_id || mapping.business_account_id,
      pageId: mapping.page_id,
      instagramAccountId: mapping.instagram_account_id,
      integrationId: mapping.id,
      rangePreset,
      dateFrom,
      dateTo
    }, token),
    fetchMetaAccountInfo(adAccountId, token)
  ]);

  if (!pulled.ok) return { connected: true, ok: false, reason: "UPSTREAM_API_ERROR", message: pulled.errorMessage || "Meta API hatası." };
  return { connected: true, ok: true, account, range: pulled.range, metrics: pulled.metrics, campaigns: pulled.campaigns, rows: pulled.rows, warnings: pulled.warnings || [] };
}

export type GoogleAdsPerformanceResult =
  | { connected: false; reason: "TABLES_NOT_READY" | "NOT_CONNECTED" | "ACCOUNT_NOT_MAPPED" }
  | { connected: true; ok: false; reason: "UPSTREAM_API_ERROR"; message: string; warnings: string[] }
  | { connected: true; ok: true; account: GoogleAdsAccountInfo | null; message: string; range: DateRange; rows: unknown[]; warnings: string[] };

/** Account-level metadata (descriptive name, currency, timezone, manager
 * status) via the same customer_integrations mapping ad-accounts.ts
 * already reads — resolved independently of syncCompanyAnalytics's own
 * internal asset resolution so that shared sync pipeline is never
 * touched. Fails soft (null) on any error: a missing account label never
 * blocks the real performance numbers. */
async function fetchGoogleAccountInfo(companyId: string): Promise<GoogleAdsAccountInfo | null> {
  try {
    const [rows, { token }] = await Promise.all([
      supabaseRest<Array<{ google_ads_customer_id: string | null }>>(`customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=google_ads_customer_id&limit=1`),
      getProviderToken(companyId, "google_ads")
    ]);
    const customerId = rows[0]?.google_ads_customer_id;
    if (!customerId || !token) return null;
    return await getGoogleAdsAccountInfo(customerId, token);
  } catch {
    return null;
  }
}

/** Reuses Analiz & Raporlama Merkezi's real sync pipeline end to end
 * (token resolution, the actual Google Ads API call, storage) and then
 * reads the real numbers back — no separate Google Ads client, no
 * duplicated query logic. */
export async function getGoogleAdsPerformance(companyId: string, range: DateRange = defaultSyncRange()): Promise<GoogleAdsPerformanceResult> {
  if (!(await analyticsTablesReady())) return { connected: false, reason: "TABLES_NOT_READY" };

  const [outcome, account] = await Promise.all([
    syncCompanyAnalytics(companyId, ["google_ads"], range).then((r) => r[0]),
    fetchGoogleAccountInfo(companyId)
  ]);
  if (!outcome.ok) {
    const reason = /bağlı değil/i.test(outcome.message) ? "NOT_CONNECTED" : /hesap|customer/i.test(outcome.message) ? "ACCOUNT_NOT_MAPPED" : null;
    if (reason) return { connected: false, reason: reason as "NOT_CONNECTED" | "ACCOUNT_NOT_MAPPED" };
    return { connected: true, ok: false, reason: "UPSTREAM_API_ERROR", message: outcome.message, warnings: outcome.warnings };
  }

  const rows = await queryDailyMetrics(companyId, ["google_ads"], range);
  return { connected: true, ok: true, account, message: outcome.message, range, rows, warnings: outcome.warnings };
}
