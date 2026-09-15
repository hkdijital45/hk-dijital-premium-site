import "server-only";
import { writeContentMetrics, writeDailyMetrics } from "../metrics-store";
import { providerMetrics } from "../capabilities";
import type { ConnectionAsset, ContentMetricRow, DateRange, SyncOutcome } from "../types";
import { metaGraphGet } from "./meta-graph";

const PAGE_DAILY_METRICS = ["page_impressions", "page_impressions_unique", "page_engaged_users", "page_post_engagements", "page_video_views"];

async function fetchDailyPageInsights(accessToken: string, pageId: string, since: string, until: string) {
  const rows: Array<{ date: string; metric: string; value: number }> = [];
  const warnings: string[] = [];
  for (const metric of PAGE_DAILY_METRICS) {
    try {
      const payload = await metaGraphGet(`${pageId}/insights`, accessToken, { metric, period: "day", since, until });
      for (const entry of payload.data || []) {
        for (const point of entry.values || []) {
          if (point.value === undefined || point.value === null) continue;
          const value = typeof point.value === "object" ? Object.values(point.value).reduce((sum: number, v) => sum + Number(v || 0), 0) : Number(point.value) || 0;
          rows.push({ date: String(point.end_time).slice(0, 10), metric: entry.name, value });
        }
      }
    } catch (error) {
      warnings.push(`${metric}: ${error instanceof Error ? error.message : "alınamadı"}`);
    }
  }
  return { rows, warnings };
}

async function fetchPageFanCount(accessToken: string, pageId: string): Promise<number | null> {
  try {
    const payload = await metaGraphGet(pageId, accessToken, { fields: "fan_count" });
    return typeof payload.fan_count === "number" ? payload.fan_count : null;
  } catch {
    return null;
  }
}

async function fetchRecentPosts(accessToken: string, pageId: string, sinceIso: string) {
  const payload = await metaGraphGet(`${pageId}/posts`, accessToken, {
    fields: "id,message,permalink_url,full_picture,created_time",
    limit: "50"
  });
  const items: any[] = Array.isArray(payload.data) ? payload.data : [];
  return items.filter((item) => item.created_time && item.created_time >= sinceIso);
}

const POST_METRICS = ["post_impressions", "post_impressions_unique", "post_engaged_users", "post_reactions_by_type_total"];

export async function syncFacebookAnalytics(companyId: string, accessToken: string, asset: ConnectionAsset, range: DateRange): Promise<SyncOutcome> {
  const warnings: string[] = [];
  const pageId = asset.provider_account_id;
  if (!pageId) return { provider: "facebook", ok: false, message: "Facebook Sayfa kimliği bulunamadı.", dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };

  const { rows: dailyRows, warnings: dailyWarnings } = await fetchDailyPageInsights(accessToken, pageId, range.startDate, range.endDate);
  warnings.push(...dailyWarnings);

  const fanCount = await fetchPageFanCount(accessToken, pageId);
  const today = new Date().toISOString().slice(0, 10);

  const supportedKeys = new Set(providerMetrics("facebook").filter((m) => m.capability === "supported").map((m) => m.key));
  const dailyMetricRows = dailyRows
    .filter((row) => supportedKeys.has(row.metric))
    .map((row) => ({ companyId, provider: "facebook" as const, assetId: pageId, metricDate: row.date, metricKey: row.metric, metricValue: row.value }));
  if (fanCount !== null) {
    dailyMetricRows.push({ companyId, provider: "facebook", assetId: pageId, metricDate: today, metricKey: "page_fans", metricValue: fanCount });
  }
  const dailyMetricsWritten = await writeDailyMetrics(dailyMetricRows);

  let contentMetricsWritten = 0;
  try {
    const posts = await fetchRecentPosts(accessToken, pageId, `${range.startDate}T00:00:00+0000`);
    const contentRows: ContentMetricRow[] = [];
    for (const post of posts) {
      const metricsValues: Record<string, number | null> = {};
      try {
        const insightsPayload = await metaGraphGet(`${post.id}/insights`, accessToken, { metric: POST_METRICS.join(",") });
        for (const entry of insightsPayload.data || []) {
          const value = entry.values?.[0]?.value;
          metricsValues[entry.name] = typeof value === "object" ? Object.values(value).reduce((sum: number, v) => sum + Number(v || 0), 0) : value ?? null;
        }
      } catch (error) {
        warnings.push(`Gönderi ${post.id}: metrikler alınamadı (${error instanceof Error ? error.message : "bilinmeyen hata"}).`);
      }
      contentRows.push({
        companyId,
        provider: "facebook",
        assetId: pageId,
        contentId: post.id,
        contentType: "post",
        caption: post.message ? String(post.message).slice(0, 500) : null,
        permalink: post.permalink_url || null,
        thumbnailUrl: post.full_picture || null,
        publishedAt: post.created_time || null,
        metrics: metricsValues
      });
    }
    contentMetricsWritten = await writeContentMetrics(contentRows);
  } catch (error) {
    warnings.push(`Gönderi listesi alınamadı: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
  }

  return {
    provider: "facebook",
    ok: true,
    message: `Facebook senkronize edildi: ${dailyMetricsWritten} günlük metrik, ${contentMetricsWritten} gönderi.`,
    dailyMetricsWritten,
    contentMetricsWritten,
    warnings
  };
}
