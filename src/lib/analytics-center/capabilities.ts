// Provider capability registry — the UI must never silently show 0 for a
// metric a platform simply doesn't expose (or no longer exposes); it must
// say so. This is the single place that distinguishes "supported" from
// "unsupported"/"permission_missing"/"not_applicable" per provider.
//
// Metric names verified against each platform's current documentation as of
// this build (2026-09). APIs — especially Meta's — change faster than any
// hardcoded list can stay perfectly accurate, so every provider adapter
// (see providers/*.ts) fetches metrics one-by-one on any batch failure and
// drops only the specific metric that failed, rather than the whole sync —
// the same resilience pattern already used by
// src/lib/social-autopilot/analytics-sync.ts. If a metric below starts
// failing in production, that resilience — not an edit here — is what keeps
// the rest of the dashboard working; update this file only to correct the
// capability label shown to the user.
import type { AnalyticsProvider, MetricCapability, ProviderMetricDefinition } from "./types";

const supported = (key: string, label: string, unit: ProviderMetricDefinition["unit"], kpiGroup: ProviderMetricDefinition["kpiGroup"], note?: string): ProviderMetricDefinition => ({ key, label, unit, kpiGroup, capability: "supported", note });
const unsupported = (key: string, label: string, unit: ProviderMetricDefinition["unit"], kpiGroup: ProviderMetricDefinition["kpiGroup"], note: string): ProviderMetricDefinition => ({ key, label, unit, kpiGroup, capability: "unsupported", note });

// Instagram — account-level metrics use src/lib/social-autopilot/
// analytics-sync.ts's ACCOUNT_METRICS/CONTENT_METRICS_BY_TYPE as the
// verified-current baseline (already production-tested against real Meta
// responses). profile_views/website_clicks/phone_call_clicks/
// text_message_clicks/email_contacts and non-Reels video_views were
// deprecated by Meta effective 2025-01-08 (Graph API v21+) — never
// requested here.
const INSTAGRAM_METRICS: ProviderMetricDefinition[] = [
  supported("followers", "Takipçi", "count", "audience"),
  supported("reach", "Erişim", "count", "awareness"),
  supported("accounts_engaged", "Etkileşimde Bulunan Hesaplar", "count", "engagement"),
  supported("likes", "Beğeni", "count", "engagement"),
  supported("comments", "Yorum", "count", "engagement"),
  supported("shares", "Paylaşım", "count", "engagement"),
  supported("saves", "Kaydetme", "count", "engagement"),
  supported("plays", "Oynatma (Reels)", "count", "awareness", "Yalnızca Reels içerikleri için."),
  unsupported("impressions", "Gösterim", "count", "awareness", "Meta bu metriği hesap düzeyinde kademeli olarak kaldırdı; erişim (reach) kullanılır."),
  unsupported("profile_views", "Profil Görüntülenmesi", "count", "traffic", "Meta tarafından 08.01.2025 itibarıyla kaldırıldı."),
  unsupported("website_clicks", "Web Sitesi Tıklaması", "count", "traffic", "Meta tarafından 08.01.2025 itibarıyla kaldırıldı.")
];

// Facebook Page insights — Meta also renames/retires Page Insights metrics
// periodically; this list favors the longest-standing, still-documented
// names. Resilient per-metric fallback covers drift the same way as
// Instagram above.
const FACEBOOK_METRICS: ProviderMetricDefinition[] = [
  supported("page_fans", "Sayfa Takipçisi", "count", "audience"),
  supported("page_impressions", "Gösterim", "count", "awareness"),
  supported("page_impressions_unique", "Erişim", "count", "awareness"),
  supported("page_engaged_users", "Etkileşimde Bulunan Kullanıcı", "count", "engagement"),
  supported("page_post_engagements", "Gönderi Etkileşimi", "count", "engagement"),
  supported("page_video_views", "Video Görüntülenmesi", "count", "engagement")
];

// YouTube Analytics API v2 (youtubeanalytics.googleapis.com) — requires the
// yt-analytics.readonly scope specifically (distinct from the youtube.
// readonly Data API scope already requested for channel discovery). No
// monetary/revenue scope requested or used, per product requirement.
const YOUTUBE_METRICS: ProviderMetricDefinition[] = [
  supported("subscribersGained", "Kazanılan Abone", "count", "audience"),
  supported("subscribersLost", "Kaybedilen Abone", "count", "audience"),
  supported("views", "Görüntülenme", "count", "awareness"),
  supported("estimatedMinutesWatched", "Tahmini İzlenme Süresi (dk)", "count", "engagement"),
  supported("averageViewDuration", "Ortalama İzlenme Süresi", "seconds", "engagement"),
  supported("likes", "Beğeni", "count", "engagement"),
  supported("comments", "Yorum", "count", "engagement"),
  supported("shares", "Paylaşım", "count", "engagement")
];

// Google Ads API (googleads.googleapis.com, v25 — matches the version
// already used by src/lib/customer-integration-oauth.ts's account
// discovery, so this integration surface stays on one consistent version).
// Cost values arrive in micros; adapters divide by 1_000_000 before storing.
const GOOGLE_ADS_METRICS: ProviderMetricDefinition[] = [
  supported("cost", "Harcama", "currency", "ads"),
  supported("impressions", "Gösterim", "count", "ads"),
  supported("clicks", "Tıklama", "count", "ads"),
  supported("ctr", "TO (CTR)", "percent", "ads"),
  supported("averageCpc", "Ortalama TBM (CPC)", "currency", "ads"),
  supported("conversions", "Dönüşüm", "count", "ads"),
  supported("conversionsValue", "Dönüşüm Değeri", "currency", "ads"),
  supported("costPerConversion", "Dönüşüm Başına Maliyet", "currency", "ads")
];

// Google Business Profile Performance API
// (businessprofileperformance.googleapis.com/v1) — the current API;
// the older My Business Business Information API's insights endpoint is
// retired. Scope: business.manage (already requested).
const GOOGLE_BUSINESS_METRICS: ProviderMetricDefinition[] = [
  supported("BUSINESS_IMPRESSIONS_DESKTOP_MAPS", "Masaüstü Haritalar Gösterimi", "count", "local"),
  supported("BUSINESS_IMPRESSIONS_MOBILE_MAPS", "Mobil Haritalar Gösterimi", "count", "local"),
  supported("BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", "Masaüstü Arama Gösterimi", "count", "local"),
  supported("BUSINESS_IMPRESSIONS_MOBILE_SEARCH", "Mobil Arama Gösterimi", "count", "local"),
  supported("CALL_CLICKS", "Telefon Araması", "count", "local"),
  supported("WEBSITE_CLICKS", "Web Sitesi Tıklaması", "count", "local"),
  supported("BUSINESS_DIRECTION_REQUESTS", "Yol Tarifi İsteği", "count", "local"),
  supported("BUSINESS_CONVERSATIONS", "Mesajlaşma", "count", "local", "Yalnızca mesajlaşma özelliği açık lokasyonlarda."),
  // Not part of the Performance API — fetched separately from the reviews
  // endpoint (v4/accounts/*/locations/*/reviews) and stored as its own
  // daily snapshot (review_count/average_rating), not a Performance metric.
  supported("review_count", "Toplam Yorum", "count", "local"),
  supported("average_rating", "Ortalama Puan", "rating", "local")
];

const REGISTRY: Record<AnalyticsProvider, ProviderMetricDefinition[]> = {
  instagram: INSTAGRAM_METRICS,
  facebook: FACEBOOK_METRICS,
  youtube: YOUTUBE_METRICS,
  google_ads: GOOGLE_ADS_METRICS,
  google_business_profile: GOOGLE_BUSINESS_METRICS
};

export function providerMetrics(provider: AnalyticsProvider): ProviderMetricDefinition[] {
  return REGISTRY[provider] || [];
}

export function metricCapability(provider: AnalyticsProvider, metricKey: string): MetricCapability {
  return REGISTRY[provider]?.find((m) => m.key === metricKey)?.capability || "not_applicable";
}

export function metricDefinition(provider: AnalyticsProvider, metricKey: string): ProviderMetricDefinition | null {
  return REGISTRY[provider]?.find((m) => m.key === metricKey) || null;
}

export const PROVIDER_LABELS: Record<AnalyticsProvider, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  google_ads: "Google Ads",
  google_business_profile: "Google Business Profile"
};

// "meta" vs "google" — matches customer_integrations.provider /
// integration_assets[].provider, i.e. which OAuth connection this platform
// rides on.
export const PROVIDER_OAUTH_PARENT: Record<AnalyticsProvider, "meta" | "google"> = {
  instagram: "meta",
  facebook: "meta",
  youtube: "google",
  google_ads: "google",
  google_business_profile: "google"
};

// Matches the exact asset_type values written by selectOAuthAccount() /
// normalizeAsset() into integration_assets — used to find "the connected
// Instagram account" etc. among a company's selected assets.
export const PROVIDER_ASSET_TYPE: Record<AnalyticsProvider, string> = {
  instagram: "instagram_business",
  facebook: "facebook_page",
  youtube: "youtube_channel",
  google_ads: "google_ads_customer",
  google_business_profile: "google_business_location"
};
