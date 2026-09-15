import "server-only";
import { writeContentMetrics, writeDailyMetrics } from "../metrics-store";
import type { ConnectionAsset, ContentMetricRow, DateRange, SyncOutcome } from "../types";

// YouTube Analytics API v2 — requires the yt-analytics.readonly scope
// (distinct from the youtube.readonly Data API v3 scope already requested
// for channel discovery in customer-integration-oauth.ts). A company that
// connected Google before this scope was added will need to reconnect via
// /musteri-paneli#hesap-bagla before this succeeds — the resulting 403 is
// surfaced as a scope/permission message, not a crash.
const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/reports";
const DATA_BASE = "https://www.googleapis.com/youtube/v3";

async function googleGet(url: string, accessToken: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `YouTube API isteği başarısız oldu (HTTP ${response.status}).`;
    if (response.status === 403) throw new Error(`YouTube Analytics izni eksik: ${message} Müşteri panelinden Google ile yeniden bağlanmak gerekebilir.`);
    throw new Error(message);
  }
  return payload;
}

async function fetchDailyChannelReport(accessToken: string, channelId: string, range: DateRange) {
  const metrics = ["views", "estimatedMinutesWatched", "likes", "comments", "shares", "subscribersGained", "subscribersLost"];
  const url = `${ANALYTICS_BASE}?ids=channel==${encodeURIComponent(channelId)}&startDate=${range.startDate}&endDate=${range.endDate}&metrics=${metrics.join(",")}&dimensions=day&sort=day`;
  const payload = await googleGet(url, accessToken);
  const headers: string[] = (payload.columnHeaders || []).map((h: any) => h.name);
  const dayIndex = headers.indexOf("day");
  const rows: Array<{ date: string; metric: string; value: number }> = [];
  for (const row of payload.rows || []) {
    const date = row[dayIndex];
    headers.forEach((name, index) => {
      if (index === dayIndex) return;
      rows.push({ date, metric: name, value: Number(row[index]) || 0 });
    });
  }
  return rows;
}

async function fetchCurrentSubscriberCount(accessToken: string, channelId: string): Promise<number | null> {
  try {
    const payload = await googleGet(`${DATA_BASE}/channels?part=statistics&id=${encodeURIComponent(channelId)}`, accessToken);
    const count = payload.items?.[0]?.statistics?.subscriberCount;
    return count !== undefined ? Number(count) : null;
  } catch {
    return null;
  }
}

async function fetchTopVideosInRange(accessToken: string, channelId: string, range: DateRange, limit = 25) {
  const metrics = ["views", "estimatedMinutesWatched", "likes", "comments", "shares"];
  const url = `${ANALYTICS_BASE}?ids=channel==${encodeURIComponent(channelId)}&startDate=${range.startDate}&endDate=${range.endDate}&metrics=${metrics.join(",")}&dimensions=video&sort=-views&maxResults=${limit}`;
  const payload = await googleGet(url, accessToken);
  const headers: string[] = (payload.columnHeaders || []).map((h: any) => h.name);
  const videoIndex = headers.indexOf("video");
  return (payload.rows || []).map((row: any) => {
    const entry: Record<string, number | string> = {};
    headers.forEach((name, index) => { entry[name] = index === videoIndex ? row[index] : Number(row[index]) || 0; });
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

  const subscriberCount = await fetchCurrentSubscriberCount(accessToken, channelId);
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
        metrics: { views: video.views ?? null, estimatedMinutesWatched: video.estimatedMinutesWatched ?? null, likes: video.likes ?? null, comments: video.comments ?? null, shares: video.shares ?? null }
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
