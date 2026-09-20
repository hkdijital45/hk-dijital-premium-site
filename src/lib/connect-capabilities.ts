// Pure constants for HK Connect remote-link capabilities — deliberately no
// imports (not even "@/lib/supabase") so this stays testable directly by
// the plain `node --test` runner used for this repo's unit tests, which
// has no "@/" path-alias resolution outside the Next.js bundler.
export const CONNECT_CAPABILITIES = ["facebook", "instagram", "meta_ads", "tiktok", "google_ads", "ga4", "search_console", "youtube"] as const;
export type ConnectCapability = (typeof CONNECT_CAPABILITIES)[number];
export const META_CAPABILITIES: ConnectCapability[] = ["facebook", "instagram", "meta_ads"];
export const GOOGLE_CAPABILITIES: ConnectCapability[] = ["google_ads", "ga4", "search_console", "youtube"];
export const TIKTOK_CAPABILITIES: ConnectCapability[] = ["tiktok"];

/** Maps a discovered/selected asset's concrete account_type to the single
 * connect-link capability it actually satisfies — the fix for capabilities
 * being marked complete in bulk (e.g. selecting only a GA4 property used
 * to also silently mark google_ads and search_console "done"). One asset
 * type maps to exactly one capability; parent/profile-only rows
 * (meta_business, google_profile, tiktok_account's own parent row) map to
 * nothing and are intentionally excluded from completion. */
export const ASSET_TYPE_TO_CAPABILITY: Record<string, ConnectCapability> = {
  facebook_page: "facebook",
  instagram_business: "instagram",
  meta_ad_account: "meta_ads",
  google_ads_customer: "google_ads",
  ga4_property: "ga4",
  search_console_site: "search_console",
  youtube_channel: "youtube"
};
