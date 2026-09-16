import "server-only";
import { writeContentMetrics, writeDailyMetrics } from "../metrics-store";
import type { ConnectionAsset, ContentMetricRow, DailyMetricRow, DateRange, SyncOutcome } from "../types";

// TikTok Login Kit / Display API (open.tiktokapis.com) — read-only scopes
// only (user.info.basic/profile/stats, video.list). No historical-
// analytics endpoint exists for these scopes, unlike YouTube Analytics or
// Meta Insights — this adapter snapshots the current user-info counters as
// "today's" value every sync (same pattern already used for Instagram's
// followers/Facebook's page_fans/YouTube's subscribers), so real growth
// accumulates over real syncs. Never backfills or fabricates history.
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/";
const USER_INFO_FIELDS = "open_id,display_name,follower_count,following_count,likes_count,video_count";
const VIDEO_FIELDS = "id,create_time,cover_image_url,share_url,video_description,title,duration,like_count,comment_count,share_count,view_count";

function tikTokErrorMessage(payload: any, fallback: string): string {
  const message = payload?.error?.message || fallback;
  const lower = String(message).toLocaleLowerCase("tr-TR");
  if (lower.includes("access_token_invalid") || lower.includes("access_token_expired") || lower.includes("scope_not_authorized") || lower.includes("unauthorized")) {
    return "TikTok erişim izni eksik veya süresi dolmuş. TikTok ile yeniden bağlanmak gerekebilir.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) return "TikTok API isteği limitine ulaşıldı. Bir süre sonra tekrar deneyin.";
  return String(message) || fallback;
}

async function fetchUserSnapshot(accessToken: string) {
  const response = await fetch(`${USER_INFO_URL}?fields=${USER_INFO_FIELDS}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  const user = payload?.data?.user;
  if (!response.ok || !user) throw new Error(tikTokErrorMessage(payload, "TikTok profil bilgisi alınamadı."));
  return user as { open_id: string; display_name?: string; follower_count?: number; following_count?: number; likes_count?: number; video_count?: number };
}

async function fetchRecentVideos(accessToken: string, sinceIso: string) {
  const response = await fetch(`${VIDEO_LIST_URL}?fields=${VIDEO_FIELDS}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ max_count: 20 }),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(tikTokErrorMessage(payload, "TikTok video listesi alınamadı."));
  const videos: any[] = Array.isArray(payload?.data?.videos) ? payload.data.videos : [];
  const sinceSeconds = Math.floor(new Date(sinceIso).getTime() / 1000);
  return videos.filter((video) => Number(video.create_time || 0) >= sinceSeconds);
}

export async function syncTiktokAnalytics(companyId: string, accessToken: string, asset: ConnectionAsset, range: DateRange): Promise<SyncOutcome> {
  const warnings: string[] = [];
  const accountId = asset.provider_account_id;
  if (!accountId) return { provider: "tiktok", ok: false, message: "TikTok hesap kimliği bulunamadı.", dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };

  let user: { open_id: string; follower_count?: number; following_count?: number; likes_count?: number; video_count?: number };
  try {
    user = await fetchUserSnapshot(accessToken);
  } catch (error) {
    return { provider: "tiktok", ok: false, message: error instanceof Error ? error.message : "TikTok verisi alınamadı.", dailyMetricsWritten: 0, contentMetricsWritten: 0, warnings: [] };
  }

  const today = new Date().toISOString().slice(0, 10);
  const dailyRows: DailyMetricRow[] = [];
  if (typeof user.follower_count === "number") dailyRows.push({ companyId, provider: "tiktok", assetId: accountId, metricDate: today, metricKey: "followers", metricValue: user.follower_count });
  if (typeof user.following_count === "number") dailyRows.push({ companyId, provider: "tiktok", assetId: accountId, metricDate: today, metricKey: "following", metricValue: user.following_count });
  if (typeof user.likes_count === "number") dailyRows.push({ companyId, provider: "tiktok", assetId: accountId, metricDate: today, metricKey: "likes_total", metricValue: user.likes_count });
  if (typeof user.video_count === "number") dailyRows.push({ companyId, provider: "tiktok", assetId: accountId, metricDate: today, metricKey: "video_count", metricValue: user.video_count });
  const dailyMetricsWritten = await writeDailyMetrics(dailyRows);

  let contentMetricsWritten = 0;
  try {
    const videos = await fetchRecentVideos(accessToken, `${range.startDate}T00:00:00Z`);
    const contentRows: ContentMetricRow[] = videos.map((video) => ({
      companyId,
      provider: "tiktok",
      assetId: accountId,
      contentId: String(video.id),
      contentType: "video",
      title: video.title || null,
      caption: video.video_description ? String(video.video_description).slice(0, 500) : null,
      permalink: video.share_url || null,
      thumbnailUrl: video.cover_image_url || null,
      publishedAt: video.create_time ? new Date(Number(video.create_time) * 1000).toISOString() : null,
      metrics: {
        views: video.view_count ?? null,
        likes: video.like_count ?? null,
        comments: video.comment_count ?? null,
        shares: video.share_count ?? null
      }
    }));
    contentMetricsWritten = await writeContentMetrics(contentRows);
  } catch (error) {
    warnings.push(`Video listesi alınamadı: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
  }

  return {
    provider: "tiktok",
    ok: true,
    message: `TikTok senkronize edildi: ${dailyMetricsWritten} günlük metrik, ${contentMetricsWritten} video.`,
    dailyMetricsWritten,
    contentMetricsWritten,
    warnings
  };
}
