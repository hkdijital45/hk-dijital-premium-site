import "server-only";
import { googleTokenNeedsReconnect } from "./google-connection-state";
import { supabaseRest } from "@/lib/supabase";
import { PROVIDER_ASSET_TYPE, PROVIDER_LABELS, PROVIDER_OAUTH_PARENT } from "./capabilities";
import { getOAuthProviderStatus } from "@/lib/customer-integration-oauth";
import { ANALYTICS_PROVIDERS } from "./types";
import type { AnalyticsProvider, ConnectionAsset, ProviderConnectionStatus } from "./types";

// OAuth connection is customer-initiated by design (oauthConnect() requires
// requireCustomerSession() — an agency admin cannot authorize a customer's
// Instagram/Google on their behalf, which is correct: only the account
// owner can grant that consent). The actual "connect" UI already exists at
// /musteri-paneli#hesap-bagla (CustomerAccountConnectCenter). This module
// only reads the resulting connection state from customer_integrations —
// the same table and integration_assets shape that screen writes to — so
// Analiz Merkezi and the existing Entegrasyonlar/Müşteri Entegrasyonları
// screens never disagree about what's connected.

async function getCustomerIntegrationRow(companyId: string) {
  const rows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`).catch(() => []);
  return rows[0] || null;
}

function assetsForProvider(row: any, provider: AnalyticsProvider): ConnectionAsset | null {
  const assets: any[] = Array.isArray(row?.integration_assets) ? row.integration_assets : [];
  const assetType = PROVIDER_ASSET_TYPE[provider];
  const match = assets.find((item) => item?.asset_type === assetType || item?.account_type === assetType || item?.platform === provider);
  return match || null;
}

// The shared parent OAuth login row (account_type "meta_user"/"google_profile")
// — distinct from any specific child asset (a Page, a channel, an Ads
// account...). Matches the rows saveMetaPhase1Integration/
// saveGoogleOAuthIntegration write in customer-integration-oauth.ts.
// TikTok has no separate parent/child tier — saveTikTokIntegration writes
// "tiktok_account" as both the parent marker and the one real child asset,
// since TikTok Login Kit exposes exactly one account per connection.
function parentAssetForOAuthParent(row: any, oauthParent: "meta" | "google" | "tiktok"): any {
  const assets: any[] = Array.isArray(row?.integration_assets) ? row.integration_assets : [];
  const parentAccountType = oauthParent === "meta" ? "meta_user" : oauthParent === "google" ? "google_profile" : "tiktok_account";
  return assets.find((item) => item?.provider === oauthParent && item?.account_type === parentAccountType) || null;
}

async function lastSyncLogForProvider(companyId: string, provider: AnalyticsProvider) {
  const oauthParent = PROVIDER_OAUTH_PARENT[provider];
  const rows = await supabaseRest<any[]>(
    `integration_sync_logs?company_id=eq.${encodeURIComponent(companyId)}&provider=eq.${oauthParent}&order=created_at.desc&limit=20&select=result,message,details,created_at`
  ).catch(() => []);
  return rows.find((row) => row?.details?.platform === provider) || null;
}

// Direct OAuth connect URL — HK Admin (with ?company=) and the customer
// panel both hit this same endpoint; oauthConnect() itself derives origin
// ("hk_admin" vs "customer_panel") from the live session server-side, never
// from a client-supplied param. returnTo is the ONLY thing that differs
// between the two callers, and it's re-validated by safeReturnTo() /
// re-signed into the OAuth state server-side — never trusted as-is.
function directConnectHref(provider: AnalyticsProvider, companyId: string): string {
  const oauthParent = PROVIDER_OAUTH_PARENT[provider];
  const assetType = PROVIDER_ASSET_TYPE[provider];
  // requestedChild round-trips through oauthConnect's signed state and back
  // out via oauthCallback's returnTo-based redirect (safeReturnTo preserves
  // the full query string, never just the path) — it's how
  // AnalyticsReportingCenter knows which of the 5 provider cards (e.g.
  // "instagram" specifically, not just "meta") to reopen the connection
  // drawer on after the browser comes back from Meta/Google. Purely a UX
  // hint, like the existing company param — never trusted for
  // authorization.
  const returnTo = `/hk-admin/analiz-raporlama?company=${encodeURIComponent(companyId)}&requestedChild=${provider}#hesaplar`;
  const params = new URLSearchParams({ company: companyId, platform: provider, assetType, returnTo });
  return `/api/integrations/${oauthParent}/connect?${params.toString()}`;
}

export async function getProviderConnectionStatus(companyId: string, provider: AnalyticsProvider): Promise<ProviderConnectionStatus> {
  const label = PROVIDER_LABELS[provider];
  const oauthParent = PROVIDER_OAUTH_PARENT[provider];
  const row = await getCustomerIntegrationRow(companyId);
  const asset = assetsForProvider(row, provider);
  const parentAsset = parentAssetForOAuthParent(row, oauthParent);
  const lastLog = await lastSyncLogForProvider(companyId, provider);
  const oauthReadiness = getOAuthProviderStatus(oauthParent);

  // HK Admin's own native connection panel (AdminConnectionDrawer) and the
  // customer panel's Hesap Bağla screen both navigate the browser straight
  // here — no intermediate page. See the comment on directConnectHref.
  const manageHref = directConnectHref(provider, companyId);
  const connectHref = manageHref;

  let status: ProviderConnectionStatus["status"] = "not_connected";
  let statusLabel = "Bağlı değil";
  let lastError: string | null = null;

  if (asset) {
    const tokenExpired = oauthParent === "google"
      ? googleTokenNeedsReconnect(row?.sensitive_metadata?.google_oauth)
      : row?.oauth_status === "token_expired";
    if (tokenExpired) {
      status = "token_expired";
      statusLabel = "Yetki süresi dolmuş";
    } else if (lastLog?.result && /hata|error/i.test(lastLog.result)) {
      status = "sync_error";
      statusLabel = "Senkronizasyon hatası";
      lastError = lastLog.message || row?.sync_error || null;
    } else {
      status = "connected";
      statusLabel = "Bağlı";
    }
  } else if (row?.connection_error) {
    status = "reauth_required";
    statusLabel = "Yeniden yetkilendirme gerekli";
    lastError = row.connection_error;
  }

  let scopeReady = true;
  let scopeNote: string | null = null;
  if ((provider === "instagram" || provider === "facebook") && !oauthReadiness.advancedScopesEnabled) {
    scopeReady = false;
    scopeNote = "Instagram/Facebook analiz izinleri (pages_show_list, pages_read_engagement, instagram_basic, instagram_manage_insights) şu anda istenmiyor. Ayrı, Business tipinde bir Meta App + Configuration gerekir — bkz. docs/analytics-center/setup.md.";
  }
  // GOOGLE_ADS_DEVELOPER_TOKEN is no longer a real requirement: Google
  // sunset developer tokens on 2026-09-09 and now determines Google Ads API
  // access purely by the Google Cloud project behind GOOGLE_CLIENT_ID —
  // see fetchGoogleAccounts()/googleAdsSearch(). Deliberately no scopeReady
  // gate here anymore; if the connected Cloud project genuinely lacks
  // Google Ads access, that surfaces as a real, specific per-account
  // diagnostic from googleDiscoveryGroups() instead of a blanket, always-on
  // warning that no longer reflects reality.

  const externalHref = asset ? externalLinkForAsset(provider, asset) : null;

  return {
    provider,
    label,
    oauthParent,
    parentConnected: Boolean(parentAsset),
    parentAccountName: parentAsset?.provider_account_name || null,
    status,
    statusLabel,
    asset,
    lastSyncedAt: asset?.last_synced_at || row?.last_synced_at || null,
    lastError,
    connectHref,
    manageHref,
    externalHref,
    scopeReady,
    scopeNote
  };
}

export async function getAllProviderConnectionStatuses(companyId: string): Promise<ProviderConnectionStatus[]> {
  const providers: AnalyticsProvider[] = ANALYTICS_PROVIDERS;
  return Promise.all(providers.map((provider) => getProviderConnectionStatus(companyId, provider)));
}

function externalLinkForAsset(provider: AnalyticsProvider, asset: ConnectionAsset): string | null {
  const meta = asset.metadata || {};
  switch (provider) {
    case "instagram": {
      const username = (meta as any).username;
      return username ? `https://instagram.com/${username}` : null;
    }
    case "facebook":
      return asset.provider_account_id ? `https://facebook.com/${asset.provider_account_id}` : null;
    case "youtube":
      return asset.provider_account_id ? `https://studio.youtube.com/channel/${asset.provider_account_id}` : null;
    case "google_ads":
      return asset.provider_account_id ? `https://ads.google.com/aw/overview?ocid=&__c=&euid=&__u=&uscid=&cid=${asset.provider_account_id}` : null;
    case "google_business_profile":
      return "https://business.google.com/locations";
    default:
      return null;
  }
}

// Returns the raw customer_integrations row — needed by token helpers
// (tokens.ts) which must read sensitive_metadata/access_token_encrypted
// directly rather than through the sanitized ProviderConnectionStatus.
export async function getCustomerIntegrationRecord(companyId: string) {
  return getCustomerIntegrationRow(companyId);
}
