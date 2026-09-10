// Official Instagram API client — "Instagram API with Instagram Login"
// (Business Login for Instagram), Meta's current no-Facebook-Page-required
// flow. Verified against the live Meta for Developers documentation:
//   - Authorize:            https://www.instagram.com/oauth/authorize
//   - Short-lived token:    https://api.instagram.com/oauth/access_token
//   - Long-lived token:     https://graph.instagram.com/access_token (grant_type=ig_exchange_token)
//   - Refresh:              https://graph.instagram.com/refresh_access_token (grant_type=ig_refresh_token; valid 60 days, refreshable after 24h)
//   - Content publishing:   https://graph.instagram.com/<version>/<IG_ID>/media, /media_publish
//   - Rate limit:           100 API-published posts / rolling 24h (content_publishing_limit endpoint)
// No password/session-cookie automation, no scraping, no reverse-engineered
// endpoints — only these documented, official OAuth + Graph API calls.
//
// IMPORTANT — user_id vs id (Instagram Login vs Facebook Login products):
// the short-lived token response from api.instagram.com/oauth/access_token
// includes a "user_id" that is NOT a queryable graph.instagram.com node ID —
// using it directly against graph.instagram.com/<that id> fails with
// "Unsupported get request. Object with ID '...' does not exist..." (a
// leftover-from-Facebook-Login assumption; that older product's Instagram
// Business Account node really is addressable by a plain id). The correct,
// current "Instagram API with Instagram Login" flow is to call
// graph.instagram.com/<version>/me right after obtaining a real access
// token; that response's "user_id" field IS the usable Instagram
// professional account ID for every other endpoint below (media, insights,
// publish). See https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started
// (verified live: curl -i -X GET "https://graph.instagram.com/v25.0/me?fields=user_id,username&access_token=...").
import { classifyProviderError, type ProviderErrorCategory } from "@/lib/discovery-report-schema";

export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
  "instagram_business_manage_comments"
] as const;

export const INSTAGRAM_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const SHORT_LIVED_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH_HOST = "https://graph.instagram.com";

function apiVersion() {
  return process.env.INSTAGRAM_GRAPH_API_VERSION || "v25.0";
}

function graphUrl(path: string) {
  return `${GRAPH_HOST}/${apiVersion()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function instagramAppCredentials() {
  const appId = process.env.INSTAGRAM_APP_ID || "";
  const appSecret = process.env.INSTAGRAM_APP_SECRET || "";
  return { appId, appSecret, configured: Boolean(appId && appSecret) };
}

export function buildInstagramAuthorizeUrl(redirectUri: string, state: string) {
  const { appId } = instagramAppCredentials();
  const params = new URLSearchParams({
    client_id: appId, redirect_uri: redirectUri, response_type: "code", scope: INSTAGRAM_SCOPES.join(","), state
  });
  return `${INSTAGRAM_AUTHORIZE_URL}?${params.toString()}`;
}

export type InstagramApiError = Error & { category: ProviderErrorCategory; retryable: boolean; statusCode?: number };

function toApiError(message: string, statusCode: number | undefined, retryable: boolean): InstagramApiError {
  const error = new Error(message) as InstagramApiError;
  error.statusCode = statusCode;
  error.retryable = retryable;
  error.category = statusCode === 401 || statusCode === 403 ? "auth_error" : statusCode === 429 ? "rate_limit" : classifyProviderError(error);
  return error;
}

// Meta's Graph API error codes worth distinguishing for retry logic:
// 4/17/32/613 = app/user rate limiting (retryable with backoff), 190 = token
// invalid/expired (permanent — requires reconnect), 10/200-299 = permission
// missing (permanent). Everything else defaults to retryable — a transient
// Meta-side issue is far more common than a genuinely permanent unknown code.
function classifyGraphErrorCode(code?: number, subcode?: number): { retryable: boolean; reason: string } {
  if (code === 190) return { retryable: false, reason: "Erişim token'ı geçersiz veya süresi dolmuş — Instagram'ı yeniden bağlamanız gerekiyor." };
  if (code === 10 || (code !== undefined && code >= 200 && code < 300)) return { retryable: false, reason: "Gerekli izin eksik veya hesap türü uygun değil." };
  if (code === 4 || code === 17 || code === 32 || code === 613) return { retryable: true, reason: "Meta API istek limiti aşıldı — daha sonra tekrar denenecek." };
  if (subcode === 2207003) return { retryable: false, reason: "Medya işlenemedi (format/süre/oran desteklenmiyor)." };
  return { retryable: true, reason: "Geçici sağlayıcı hatası." };
}

async function graphFetch<T>(url: string, init: RequestInit = {}, timeoutMs = 25000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let json: Record<string, unknown> = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    if (!response.ok) {
      const errorObject = json.error as { message?: string; code?: number; error_subcode?: number } | undefined;
      const code = errorObject?.code;
      const subcode = errorObject?.error_subcode;
      const classification = classifyGraphErrorCode(code, subcode);
      const message = errorObject?.message || `Instagram API isteği başarısız oldu (${response.status}).`;
      throw toApiError(`${message} (${classification.reason})`, response.status, classification.retryable);
    }
    return json as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw toApiError("Instagram API isteği zaman aşımına uğradı.", undefined, true);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// --- OAuth token lifecycle -------------------------------------------------

export async function exchangeCodeForShortLivedToken(code: string, redirectUri: string) {
  const { appId, appSecret } = instagramAppCredentials();
  const body = new URLSearchParams({
    client_id: appId, client_secret: appSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code
  });
  return graphFetch<{ access_token: string; user_id: string; permissions?: string[] }>(SHORT_LIVED_TOKEN_URL, { method: "POST", body });
}

export async function exchangeForLongLivedToken(shortLivedToken: string) {
  const { appSecret } = instagramAppCredentials();
  const params = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: appSecret, access_token: shortLivedToken });
  return graphFetch<{ access_token: string; token_type: string; expires_in: number }>(`${GRAPH_HOST}/access_token?${params.toString()}`);
}

export async function refreshLongLivedToken(currentToken: string) {
  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: currentToken });
  return graphFetch<{ access_token: string; token_type: string; expires_in: number }>(`${GRAPH_HOST}/refresh_access_token?${params.toString()}`);
}

// Always /me, never /<some id> — see the header comment. /me is the only
// endpoint guaranteed to resolve correctly for the token's own account
// regardless of what (possibly wrong, possibly stale) id a caller might
// otherwise have on hand; its "user_id" field is the real, reusable
// Instagram professional account ID for every other endpoint in this file.
export async function fetchInstagramProfile(accessToken: string) {
  const params = new URLSearchParams({ fields: "user_id,username,account_type,media_count", access_token: accessToken });
  return graphFetch<{ user_id: string; username: string; account_type: string; media_count: number }>(graphUrl(`/me?${params.toString()}`));
}

/** Recent published media — read-only, used for account inspection
 * ("Instagram hesabımı incele" style MCP requests). */
export async function getRecentInstagramMedia(accessToken: string, igUserId: string, limit = 20) {
  const params = new URLSearchParams({
    fields: "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count",
    limit: String(Math.min(100, Math.max(1, limit))),
    access_token: accessToken
  });
  return graphFetch<{ data: Array<{ id: string; caption?: string; media_type: string; media_product_type?: string; permalink?: string; timestamp: string; like_count?: number; comments_count?: number }> }>(
    graphUrl(`/${igUserId}/media?${params.toString()}`)
  );
}

// --- Content publishing -----------------------------------------------------

export type MediaContainerParams = {
  mediaType: "IMAGE" | "VIDEO" | "REELS" | "STORIES" | "CAROUSEL";
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  isCarouselItem?: boolean;
  children?: string[]; // carousel parent container: child container ids
  altText?: string;
  isAiGenerated?: boolean;
};

export async function createMediaContainer(accessToken: string, igUserId: string, params: MediaContainerParams) {
  const body = new URLSearchParams({ access_token: accessToken, media_type: params.mediaType });
  if (params.imageUrl) body.set("image_url", params.imageUrl);
  if (params.videoUrl) body.set("video_url", params.videoUrl);
  if (params.caption) body.set("caption", params.caption);
  if (params.isCarouselItem) body.set("is_carousel_item", "true");
  if (params.children?.length) body.set("children", params.children.join(","));
  if (params.altText) body.set("alt_text", params.altText);
  if (typeof params.isAiGenerated === "boolean") body.set("is_ai_generated", String(params.isAiGenerated));
  return graphFetch<{ id: string }>(graphUrl(`/${igUserId}/media`), { method: "POST", body });
}

export type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

export async function getContainerStatus(accessToken: string, containerId: string) {
  const params = new URLSearchParams({ fields: "status_code,status", access_token: accessToken });
  return graphFetch<{ status_code: ContainerStatus; status?: string; id: string }>(graphUrl(`/${containerId}?${params.toString()}`));
}

/** Polls a media container until Meta finishes processing it (required
 * before publishing a VIDEO/REELS container — Meta processes async). Throws
 * a permanent (non-retryable) error on ERROR/EXPIRED, a retryable timeout
 * error if it never finishes within the budget. */
export async function pollContainerUntilFinished(accessToken: string, containerId: string, options: { timeoutMs?: number; intervalMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 5_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { status_code } = await getContainerStatus(accessToken, containerId);
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR") throw toApiError("Medya işleme sırasında hata oluştu (ERROR).", undefined, false);
    if (status_code === "EXPIRED") throw toApiError("Medya container'ı işlenmeden süresi doldu (EXPIRED).", undefined, false);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw toApiError("Medya işleme zaman aşımına uğradı — daha sonra tekrar denenecek.", undefined, true);
}

export async function publishMediaContainer(accessToken: string, igUserId: string, creationId: string) {
  const body = new URLSearchParams({ access_token: accessToken, creation_id: creationId });
  return graphFetch<{ id: string }>(graphUrl(`/${igUserId}/media_publish`), { method: "POST", body });
}

export async function getContentPublishingLimit(accessToken: string, igUserId: string) {
  const params = new URLSearchParams({ fields: "config,quota_usage", access_token: accessToken });
  return graphFetch<{ data: Array<{ config: { quota_total: number; quota_duration: number }; quota_usage: number }> }>(
    graphUrl(`/${igUserId}/content_publishing_limit?${params.toString()}`)
  );
}

export async function getMediaPermalink(accessToken: string, mediaId: string) {
  const params = new URLSearchParams({ fields: "permalink,media_type,media_product_type", access_token: accessToken });
  return graphFetch<{ id: string; permalink?: string; media_type?: string }>(graphUrl(`/${mediaId}?${params.toString()}`));
}

// --- Insights ---------------------------------------------------------------

export async function getAccountInsights(accessToken: string, igUserId: string, metrics: string[], period: "day" | "week" | "days_28" = "day") {
  const params = new URLSearchParams({ metric: metrics.join(","), period, access_token: accessToken });
  return graphFetch<{ data: Array<{ name: string; period: string; values: Array<{ value: number; end_time?: string }> }> }>(
    graphUrl(`/${igUserId}/insights?${params.toString()}`)
  );
}

export async function getMediaInsights(accessToken: string, mediaId: string, metrics: string[]) {
  const params = new URLSearchParams({ metric: metrics.join(","), access_token: accessToken });
  return graphFetch<{ data: Array<{ name: string; values: Array<{ value: number }> }> }>(graphUrl(`/${mediaId}/insights?${params.toString()}`));
}
