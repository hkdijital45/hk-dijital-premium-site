import "server-only";
import { writeDailyMetrics } from "../metrics-store";
import { providerMetrics } from "../capabilities";
import type { ConnectionAsset, DailyMetricRow, DateRange, SyncOutcome } from "../types";

// Business Profile Performance API (businessprofileperformance.googleapis.com/v1)
// is the current API for GBP metrics — the older My Business Business
// Information API's own insights endpoint is retired. Scope:
// business.manage (already requested). Verified against
// developers.google.com/my-business/reference/performance at build time.
const PERFORMANCE_BASE = "https://businessprofileperformance.googleapis.com/v1";
// Reviews (mybusiness.googleapis.com v4) is a separately-versioned, older
// surface; kept best-effort (never fails the whole sync) since this repo
// has not yet verified its current retirement status against live docs —
// see docs/analytics-center/setup.md's known-limitations note.
const REVIEWS_BASE = "https://mybusiness.googleapis.com/v4";

function dateParts(prefix: string, isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${prefix}.year=${year}&${prefix}.month=${Number(month)}&${prefix}.day=${Number(day)}`;
}

async function googleGet(url: string, accessToken: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Google Business Profile API isteği başarısız oldu (HTTP ${response.status}).`;
    if (response.status === 403 || response.status === 401) throw new Error(`Business Profile erişim izni eksik: ${message} Müşteri panelinden Google ile yeniden bağlanmak gerekebilir.`);
    throw new Error(message);
  }
  return payload;
}

async function fetchDailyPerformanceMetrics(accessToken: string, locationName: string, range: DateRange) {
  const metricKeys = providerMetrics("google_business_profile").filter((m) => m.capability === "supported" && !["review_count", "average_rating"].includes(m.key)).map((m) => m.key);
  const metricParams = metricKeys.map((key) => `dailyMetrics=${key}`).join("&");
  const url = `${PERFORMANCE_BASE}/${locationName}:fetchMultiDailyMetricsTimeSeries?${metricParams}&${dateParts("dailyRange.start_date", range.startDate)}&${dateParts("dailyRange.end_date", range.endDate)}`;
  const payload = await googleGet(url, accessToken);
  const rows: Array<{ date: string; metric: string; value: number }> = [];
  for (const series of payload.multiDailyMetricTimeSeries || []) {
    for (const entry of series.dailyMetricTimeSeries || []) {
      const metric = entry.dailyMetric;
      for (const point of entry.timeSeries?.datedValues || []) {
        const date = point.date ? `${point.date.year}-${String(point.date.month).padStart(2, "0")}-${String(point.date.day).padStart(2, "0")}` : null;
        if (!date) continue;
        rows.push({ date, metric, value: Number(point.value || 0) });
      }
    }
  }
  return rows;
}

async function fetchReviewSummary(accessToken: string, asset: ConnectionAsset): Promise<{ count: number; average: number } | null> {
  const accountResourceName = (asset.metadata as any)?.parentAccount || (asset.metadata as any)?.accountName;
  if (!accountResourceName) return null; // no parent account reference discovered — skip gracefully, not fatal
  try {
    const payload = await googleGet(`${REVIEWS_BASE}/${accountResourceName}/${asset.provider_account_id}/reviews?pageSize=1`, accessToken);
    const count = Number(payload.totalReviewCount || 0);
    const average = Number(payload.averageRating || 0);
    return { count, average };
  } catch {
    return null;
  }
}

export async function syncGoogleBusinessAnalytics(companyId: string, accessToken: string, asset: ConnectionAsset, range: DateRange): Promise<SyncOutcome> {
  const warnings: string[] = [];
  const locationName = asset.provider_account_id; // e.g. "locations/12345678901234567890"
  if (!locationName) return { provider: "google_business_profile", ok: false, message: "Google Business Profile lokasyon kimliği bulunamadı.", dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };

  let performanceRows: Array<{ date: string; metric: string; value: number }> = [];
  try {
    performanceRows = await fetchDailyPerformanceMetrics(accessToken, locationName, range);
  } catch (error) {
    return { provider: "google_business_profile", ok: false, message: error instanceof Error ? error.message : "Business Profile performans verisi alınamadı.", dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };
  }

  const rows: DailyMetricRow[] = performanceRows.map((row) => ({ companyId, provider: "google_business_profile", assetId: locationName, metricDate: row.date, metricKey: row.metric, metricValue: row.value }));

  const reviewSummary = await fetchReviewSummary(accessToken, asset);
  if (reviewSummary) {
    const today = new Date().toISOString().slice(0, 10);
    rows.push({ companyId, provider: "google_business_profile", assetId: locationName, metricDate: today, metricKey: "review_count", metricValue: reviewSummary.count });
    rows.push({ companyId, provider: "google_business_profile", assetId: locationName, metricDate: today, metricKey: "average_rating", metricValue: reviewSummary.average });
  } else {
    warnings.push("Yorum sayısı/puanı alınamadı (bağlı hesap referansı bulunamadı veya API erişimi kısıtlı) — performans metrikleri etkilenmedi.");
  }

  const dailyMetricsWritten = await writeDailyMetrics(rows);
  return {
    provider: "google_business_profile",
    ok: true,
    message: `Google Business Profile senkronize edildi: ${dailyMetricsWritten} metrik satırı.`,
    dailyMetricsWritten,
    contentMetricsWritten: 0,
    warnings
  };
}
