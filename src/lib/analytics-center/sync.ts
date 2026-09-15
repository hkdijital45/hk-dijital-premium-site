import "server-only";
import { supabaseRest } from "@/lib/supabase";
import { getAllProviderConnectionStatuses } from "./connections";
import { getProviderToken } from "./tokens";
import { PROVIDER_OAUTH_PARENT } from "./capabilities";
import { syncInstagramAnalytics } from "./providers/instagram";
import { syncFacebookAnalytics } from "./providers/facebook";
import { syncYoutubeAnalytics } from "./providers/youtube";
import { syncGoogleAdsAnalytics } from "./providers/google-ads";
import { syncGoogleBusinessAnalytics } from "./providers/google-business";
import type { AnalyticsProvider, DateRange, SyncOutcome } from "./types";

const SYNC_FN: Record<AnalyticsProvider, (companyId: string, token: string, asset: any, range: DateRange) => Promise<SyncOutcome>> = {
  instagram: syncInstagramAnalytics,
  facebook: syncFacebookAnalytics,
  youtube: syncYoutubeAnalytics,
  google_ads: syncGoogleAdsAnalytics,
  google_business_profile: syncGoogleBusinessAnalytics
};

async function logSyncResult(companyId: string, provider: AnalyticsProvider, outcome: SyncOutcome) {
  await supabaseRest("integration_sync_logs", {
    method: "POST",
    body: JSON.stringify({
      provider: PROVIDER_OAUTH_PARENT[provider],
      company_id: companyId,
      source: "analiz-raporlama-merkezi",
      result: outcome.ok ? (outcome.warnings.length ? "Uyarı" : "Başarılı") : "Hata",
      message: outcome.message,
      details: { platform: provider, warnings: outcome.warnings, dailyMetricsWritten: outcome.dailyMetricsWritten, contentMetricsWritten: outcome.contentMetricsWritten }
    })
  }).catch(() => null);
}

// Default sync window kept short (last 30 days) to respect provider quotas
// and avoid re-fetching a customer's entire history on every dashboard
// open — callers needing a longer backfill pass an explicit wider range.
export function defaultSyncRange(): DateRange {
  const end = new Date();
  const start = new Date(end.getTime() - 29 * 86400000);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export async function syncCompanyAnalytics(companyId: string, providers: AnalyticsProvider[], range: DateRange = defaultSyncRange()): Promise<SyncOutcome[]> {
  const statuses = await getAllProviderConnectionStatuses(companyId);
  const statusByProvider = new Map(statuses.map((s) => [s.provider, s]));

  const results = await Promise.allSettled(
    providers.map(async (provider): Promise<SyncOutcome> => {
      const status = statusByProvider.get(provider);
      if (!status?.asset) {
        return { provider, ok: false, message: `${status?.label || provider} bağlı değil. Müşteri panelinden (Hesap Bağla) bağlantı tamamlanmalı.`, dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };
      }
      if (!status.scopeReady) {
        return { provider, ok: false, message: status.scopeNote || `${status.label} için gerekli izin/ayar eksik.`, dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };
      }
      const { token, message } = await getProviderToken(companyId, provider);
      if (!token) {
        return { provider, ok: false, message, dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };
      }
      try {
        const outcome = await SYNC_FN[provider](companyId, token, status.asset, range);
        await logSyncResult(companyId, provider, outcome);
        return outcome;
      } catch (error) {
        const outcome: SyncOutcome = { provider, ok: false, message: error instanceof Error ? error.message : `${status.label} senkronizasyonu başarısız oldu.`, dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };
        await logSyncResult(companyId, provider, outcome);
        return outcome;
      }
    })
  );

  // Promise.allSettled never rejects the outer promise — a single
  // provider's unexpected throw becomes its own failed SyncOutcome instead
  // of taking the rest of the sync down with it.
  return results.map((result, index) =>
    result.status === "fulfilled" ? result.value : { provider: providers[index], ok: false, message: "Beklenmeyen bir hata oluştu.", dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] }
  );
}
