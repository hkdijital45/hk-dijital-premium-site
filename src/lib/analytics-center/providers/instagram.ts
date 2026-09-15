import "server-only";
import { writeContentMetrics, writeDailyMetrics } from "../metrics-store";
import { providerMetrics } from "../capabilities";
import type { ConnectionAsset, ContentMetricRow, DateRange, SyncOutcome } from "../types";
import { metaGraphGet } from "./meta-graph";

const ACCOUNT_DAILY_METRICS = ["reach", "accounts_engaged"];
// follower_count is a point-in-time gauge, not additive per day — fetched
// separately as "today's value" rather than folded into the day-range call.
const CONTENT_METRICS_BY_TYPE: Record<string, string[]> = {
  REEL: ["reach", "saved", "likes", "comments", "shares", "plays"],
  CAROUSEL_ALBUM: ["reach", "saved", "likes", "comments", "shares"],
  IMAGE: ["reach", "saved", "likes", "comments", "shares"],
  VIDEO: ["reach", "saved", "likes", "comments", "shares"]
};

async function fetchDailyAccountInsights(accessToken: string, igUserId: string, since: string, until: string) {
  const rows: Array<{ date: string; metric: string; value: number }> = [];
  const warnings: string[] = [];
  for (const metric of ACCOUNT_DAILY_METRICS) {
    try {
      const payload = await metaGraphGet(`${igUserId}/insights`, accessToken, { metric, period: "day", since, until });
      for (const entry of payload.data || []) {
        for (const point of entry.values || []) {
          if (point.value === undefined || point.value === null) continue;
          rows.push({ date: String(point.end_time).slice(0, 10), metric: entry.name, value: Number(point.value) || 0 });
        }
      }
    } catch (error) {
      warnings.push(`${metric}: ${error instanceof Error ? error.message : "alınamadı"}`);
    }
  }
  return { rows, warnings };
}

async function fetchCurrentFollowerCount(accessToken: string, igUserId: string): Promise<number | null> {
  try {
    const payload = await metaGraphGet(igUserId, accessToken, { fields: "followers_count" });
    return typeof payload.followers_count === "number" ? payload.followers_count : null;
  } catch {
    return null;
  }
}

async function fetchRecentMedia(accessToken: string, igUserId: string, sinceIso: string) {
  const payload = await metaGraphGet(`${igUserId}/media`, accessToken, {
    fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp",
    limit: "50"
  });
  const items: any[] = Array.isArray(payload.data) ? payload.data : [];
  return items.filter((item) => item.timestamp && item.timestamp >= sinceIso);
}

export async function syncInstagramAnalytics(companyId: string, accessToken: string, asset: ConnectionAsset, range: DateRange): Promise<SyncOutcome> {
  const warnings: string[] = [];
  const igUserId = asset.provider_account_id;
  if (!igUserId) return { provider: "instagram", ok: false, message: "Instagram hesap kimliği bulunamadı.", dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };

  const { rows: dailyRows, warnings: dailyWarnings } = await fetchDailyAccountInsights(accessToken, igUserId, range.startDate, range.endDate);
  warnings.push(...dailyWarnings);

  const followerCount = await fetchCurrentFollowerCount(accessToken, igUserId);
  const today = new Date().toISOString().slice(0, 10);

  const supportedKeys = new Set(providerMetrics("instagram").filter((m) => m.capability === "supported").map((m) => m.key));
  const dailyMetricRows = dailyRows
    .filter((row) => supportedKeys.has(row.metric))
    .map((row) => ({ companyId, provider: "instagram" as const, assetId: igUserId, metricDate: row.date, metricKey: row.metric, metricValue: row.value }));
  if (followerCount !== null) {
    dailyMetricRows.push({ companyId, provider: "instagram", assetId: igUserId, metricDate: today, metricKey: "followers", metricValue: followerCount });
  }
  const dailyMetricsWritten = await writeDailyMetrics(dailyMetricRows);

  let contentMetricsWritten = 0;
  try {
    const media = await fetchRecentMedia(accessToken, igUserId, `${range.startDate}T00:00:00+0000`);
    const contentRows: ContentMetricRow[] = [];
    for (const item of media) {
      const mediaType = item.media_product_type === "REELS" ? "REEL" : item.media_type;
      const metricsToRequest = CONTENT_METRICS_BY_TYPE[mediaType] || CONTENT_METRICS_BY_TYPE.IMAGE;
      const metricsValues: Record<string, number | null> = {};
      try {
        const insightsPayload = await metaGraphGet(`${item.id}/insights`, accessToken, { metric: metricsToRequest.join(",") });
        for (const entry of insightsPayload.data || []) {
          metricsValues[entry.name] = entry.values?.[0]?.value ?? null;
        }
      } catch (error) {
        // Fall back one metric at a time rather than losing this content
        // item's row entirely — matches the resilience convention used
        // elsewhere in this codebase for the exact same API surface.
        for (const metric of metricsToRequest) {
          try {
            const single = await metaGraphGet(`${item.id}/insights`, accessToken, { metric });
            metricsValues[metric] = single.data?.[0]?.values?.[0]?.value ?? null;
          } catch {
            metricsValues[metric] = null;
          }
        }
        warnings.push(`İçerik ${item.id}: bazı metrikler alınamadı (${error instanceof Error ? error.message : "bilinmeyen hata"}).`);
      }
      contentRows.push({
        companyId,
        provider: "instagram",
        assetId: igUserId,
        contentId: item.id,
        contentType: mediaType?.toLocaleLowerCase("tr-TR") || null,
        caption: item.caption ? String(item.caption).slice(0, 500) : null,
        permalink: item.permalink || null,
        thumbnailUrl: item.thumbnail_url || item.media_url || null,
        publishedAt: item.timestamp || null,
        metrics: metricsValues
      });
    }
    contentMetricsWritten = await writeContentMetrics(contentRows);
  } catch (error) {
    warnings.push(`İçerik listesi alınamadı: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
  }

  return {
    provider: "instagram",
    ok: true,
    message: `Instagram senkronize edildi: ${dailyMetricsWritten} günlük metrik, ${contentMetricsWritten} içerik.`,
    dailyMetricsWritten,
    contentMetricsWritten,
    warnings
  };
}
