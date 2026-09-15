import "server-only";
import { supabaseRest } from "@/lib/supabase";
import { PROVIDER_ASSET_TYPE, PROVIDER_LABELS, PROVIDER_OAUTH_PARENT } from "./capabilities";
import { getOAuthProviderStatus } from "@/lib/customer-integration-oauth";
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

async function lastSyncLogForProvider(companyId: string, provider: AnalyticsProvider) {
  const oauthParent = PROVIDER_OAUTH_PARENT[provider];
  const rows = await supabaseRest<any[]>(
    `integration_sync_logs?company_id=eq.${encodeURIComponent(companyId)}&provider=eq.${oauthParent}&order=created_at.desc&limit=20&select=result,message,details,created_at`
  ).catch(() => []);
  return rows.find((row) => row?.details?.platform === provider) || null;
}

export async function getProviderConnectionStatus(companyId: string, provider: AnalyticsProvider): Promise<ProviderConnectionStatus> {
  const label = PROVIDER_LABELS[provider];
  const oauthParent = PROVIDER_OAUTH_PARENT[provider];
  const row = await getCustomerIntegrationRow(companyId);
  const asset = assetsForProvider(row, provider);
  const lastLog = await lastSyncLogForProvider(companyId, provider);
  const oauthReadiness = getOAuthProviderStatus(oauthParent);

  const manageHref = "/musteri-paneli#hesap-bagla";
  const connectHref = manageHref;

  let status: ProviderConnectionStatus["status"] = "not_connected";
  let statusLabel = "Bağlı değil";
  let lastError: string | null = null;

  if (asset) {
    const tokenExpired = row?.oauth_status === "token_expired" || row?.sensitive_metadata?.google_oauth?.token_expires_at && new Date(row.sensitive_metadata.google_oauth.token_expires_at).getTime() < Date.now();
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
    scopeNote = "Instagram/Facebook analiz izinleri (instagram_basic, pages_show_list, ads_read, business_management) şu anda istenmiyor. META_ADVANCED_SCOPES_ENABLED etkinleştirilmeli ve gerekiyorsa Meta App Review onayı alınmalıdır.";
  }
  if (provider === "google_ads" && !process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    scopeReady = false;
    scopeNote = "Google Ads API için GOOGLE_ADS_DEVELOPER_TOKEN sunucu ortam değişkeni tanımlanmalı.";
  }

  const externalHref = asset ? externalLinkForAsset(provider, asset) : null;

  return {
    provider,
    label,
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
  const providers: AnalyticsProvider[] = ["instagram", "facebook", "youtube", "google_ads", "google_business_profile"];
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
