import "server-only";
import { providerMetrics } from "../capabilities";
import { youtubeGet, youtubeMetricValue } from "../youtube-response";
import { writeContentMetrics, writeDailyMetrics } from "../metrics-store";
import type { ConnectionAsset, ContentMetricRow, DateRange, SyncOutcome } from "../types";

// Both readonly scopes are requested by Google OAuth. Diagnose actual API
// errors: a disabled service is not missing consent. See the current reports
// reference: https://developers.google.com/youtube/analytics/reference/reports/query
const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/reports";
const DATA_BASE = "https://www.googleapis.com/youtube/v3";

const googleGet = youtubeGet;

async function fetchDailyChannelReport(accessToken: string, channelId: string, range: DateRange) {
  const metrics = providerMetrics("youtube").filter((metric) => metric.capability === "supported" && metric.key !== "subscribers").map((metric) => metric.key);
  const url = `${ANALYTICS_BASE}?ids=channel==${encodeURIComponent(channelId)}&startDate=${range.startDate}&endDate=${range.endDate}&metrics=${metrics.join(",")}&dimensions=day&sort=day`;
  const payload = await googleGet(url, accessToken);
  const headers: string[] = (payload.columnHeaders || []).map((h: any) => h.name);
  const dayIndex = headers.indexOf("day");
  const rows: Array<{ date: string; metric: string; value: number }> = [];
  for (const row of payload.rows || []) {
    const date = row[dayIndex];
    headers.forEach((name, index) => {
      if (index === dayIndex || !metrics.includes(name) || typeof date !== "string") return;
      const value = youtubeMetricValue(row[index]);
      if (value !== null) rows.push({ date, metric: name, value });
    });
  }
  return rows;
}

async function fetchCurrentSubscriberCount(accessToken: string, channelId: string): Promise<number | null> {
  const payload = await googleGet(`${DATA_BASE}/channels?part=statistics&id=${encodeURIComponent(channelId)}`, accessToken);
  const count = payload.items?.[0]?.statistics?.subscriberCount;
  return payload.items?.[0]?.statistics?.hiddenSubscriberCount ? null : youtubeMetricValue(count);
}

async function fetchTopVideosInRange(accessToken: string, channelId: string, range: DateRange, limit = 25) {
  const metrics = ["views", "estimatedMinutesWatched", "averageViewDuration", "likes", "comments", "shares"].filter((key) => providerMetrics("youtube").some((metric) => metric.key === key && metric.capability === "supported"));
  const url = `${ANALYTICS_BASE}?ids=channel==${encodeURIComponent(channelId)}&startDate=${range.startDate}&endDate=${range.endDate}&metrics=${metrics.join(",")}&dimensions=video&sort=-views&maxResults=${limit}`;
  const payload = await googleGet(url, accessToken);
  const headers: string[] = (payload.columnHeaders || []).map((h: any) => h.name);
  const videoIndex = headers.indexOf("video");
  return (payload.rows || []).map((row: any) => {
    const entry: Record<string, number | string | null> = {};
    headers.forEach((name, index) => { entry[name] = index === videoIndex ? row[index] : youtubeMetricValue(row[index]); });
    return entry;
  });
}

async function fetchVideoDetails(accessToken: string, videoIds: string[]) {
  if (!videoIds.length) return new Map<string, any>();
  const payload = await googleGet(`${DATA_BASE}/videos?part=snippet&id=${videoIds.map(encodeURIComponent).join(",")}`, accessToken);
  const map = new Map<string, any>();
  for (const item of payload.items || []) map.set(item.id, item.snippet);
  return map;
}

export async function syncYoutubeAnalytics(companyId: string, accessToken: string, asset: ConnectionAsset, range: DateRange): Promise<SyncOutcome> {
  const warnings: string[] = [];
  const channelId = asset.provider_account_id;
  if (!channelId) return { provider: "youtube", ok: false, message: "YouTube kanal kimliği bulunamadı.", dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };

  let dailyRows: Array<{ date: string; metric: string; value: number }> = [];
  try {
    dailyRows = await fetchDailyChannelReport(accessToken, channelId, range);
  } catch (error) {
    return { provider: "youtube", ok: false, message: error instanceof Error ? error.message : "YouTube Analytics verisi alınamadı.", dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };
  }

  let subscriberCount: number | null = null;
  try {
    subscriberCount = await fetchCurrentSubscriberCount(accessToken, channelId);
  } catch (error) {
    warnings.push(`Abone sayısı alınamadı: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
  }
  const today = new Date().toISOString().slice(0, 10);
  const dailyMetricRows = dailyRows.map((row) => ({ companyId, provider: "youtube" as const, assetId: channelId, metricDate: row.date, metricKey: row.metric, metricValue: row.value }));
  if (subscriberCount !== null) {
    dailyMetricRows.push({ companyId, provider: "youtube", assetId: channelId, metricDate: today, metricKey: "subscribers", metricValue: subscriberCount });
  }
  const dailyMetricsWritten = await writeDailyMetrics(dailyMetricRows);

  let contentMetricsWritten = 0;
  try {
    const topVideos = await fetchTopVideosInRange(accessToken, channelId, range);
    const videoIds = topVideos.map((v: any) => String(v.video)).filter(Boolean);
    const details = await fetchVideoDetails(accessToken, videoIds);
    const contentRows: ContentMetricRow[] = topVideos.map((video: any) => {
      const snippet = details.get(String(video.video));
      return {
        companyId,
        provider: "youtube" as const,
        assetId: channelId,
        contentId: String(video.video),
        contentType: "video",
        title: snippet?.title || null,
        caption: snippet?.description ? String(snippet.description).slice(0, 500) : null,
        permalink: `https://www.youtube.com/watch?v=${video.video}`,
        thumbnailUrl: snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url || null,
        publishedAt: snippet?.publishedAt || null,
        metrics: { views: video.views ?? null, estimatedMinutesWatched: video.estimatedMinutesWatched ?? null, averageViewDuration: video.averageViewDuration ?? null, likes: video.likes ?? null, comments: video.comments ?? null, shares: video.shares ?? null }
      };
    });
    contentMetricsWritten = await writeContentMetrics(contentRows);
  } catch (error) {
    warnings.push(`Video listesi alınamadı: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
  }

  return {
    provider: "youtube",
    ok: true,
    message: `YouTube senkronize edildi: ${dailyMetricsWritten} günlük metrik, ${contentMetricsWritten} video.`,
    dailyMetricsWritten,
    contentMetricsWritten,
    warnings
  };
}
