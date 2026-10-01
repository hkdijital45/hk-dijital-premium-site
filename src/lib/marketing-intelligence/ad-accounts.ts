// Real (never fabricated) Meta Ads / Google Ads account-mapping status per
// customer, reusing customer_integrations directly — the same table
// src/lib/customer-integration-oauth.ts and /api/admin/meta-ads already
// write to and read from. Deliberately does NOT fetch live campaign
// performance: the existing /api/admin/meta-ads route (760+ lines) and
// Google Ads sync pipeline are real, working, and not safely
// extractable into a shared read function within this task's scope
// without risking a regression in that already-deployed route. Exposing
// this smaller, genuinely real "is an account mapped, and is the
// platform-level credential configured" check is honest; claiming full
// spend/CTR/CPC/ROAS reads here would not be.
import { supabaseRest } from "@/lib/supabase";
import { decryptSecret } from "@/lib/business-flow";

export type AdAccountStatus = {
  companyId: string;
  accountId: string | null;
  mapped: boolean;
  platformConfigured: boolean;
  status: "CONNECTED" | "ACCOUNT_NOT_MAPPED" | "PLATFORM_NOT_CONFIGURED";
  note: string;
};

/** Real production bug (HK Connect "Hesap eşleşmemiş" for a Meta Ads
 * account that was actually selected/confirmed through the OAuth/HK
 * Connect flow): the dedicated `meta_ad_account_id` column is only ever
 * written by the LEGACY manual-entry path (CustomerAccountConnectCenter's
 * "Meta Ad Account ID" field / an admin editing it directly in
 * AdminDashboard). The OAuth/connect-link asset-selection flow
 * (connectLinkSelectAccount → customer-integration-oauth.ts) never writes
 * that column — it persists the selected ad account into
 * `integration_assets` instead (asset_type "meta_ad_account", exactly the
 * key ASSET_TYPE_TO_CAPABILITY already maps to the "meta_ads" capability
 * everywhere else in HK Connect). This checked ONLY the legacy column, so
 * an ad account connected the current, real way showed as "Hesap
 * eşleşmemiş" even though it was correctly selected, confirmed, and
 * persisted. Now checks both — the legacy column first (unchanged
 * behavior for any customer who used manual entry), falling back to a
 * connected `meta_ad_account` entry in integration_assets. */
export function connectedMetaAdAccountAsset(assets: unknown): { account_id?: string; asset_id?: string } | null {
  if (!Array.isArray(assets)) return null;
  return assets.find((item: any) =>
    (item?.asset_type === "meta_ad_account" || item?.account_type === "meta_ad_account") &&
    String(item?.status || item?.oauth_status || "").startsWith("connected")
  ) || null;
}

export async function getMetaAdsAccount(companyId: string): Promise<AdAccountStatus> {
  const rows = await supabaseRest<Array<{ meta_ad_account_id: string | null; meta_business_id: string | null; integration_assets: unknown }>>(
    `customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=meta_ad_account_id,meta_business_id,integration_assets&limit=1`
  );
  const row = rows[0];
  const oauthAsset = connectedMetaAdAccountAsset(row?.integration_assets);
  const accountId = row?.meta_ad_account_id || oauthAsset?.account_id || oauthAsset?.asset_id || null;
  const platformConfigured = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  return {
    companyId,
    accountId,
    mapped: Boolean(accountId),
    platformConfigured,
    status: !platformConfigured ? "PLATFORM_NOT_CONFIGURED" : accountId ? "CONNECTED" : "ACCOUNT_NOT_MAPPED",
    note: "Yalnızca hesap eşleşme durumu — gerçek zamanlı kampanya/harcama verisi bu araçla okunmuyor; mevcut Reklam Operasyon Merkezi (/hk-admin) kullanılmalı."
  };
}

export type ResolvedMetaAdAccount = {
  companyId: string;
  /** Normalized without the "act_" prefix, ready to interpolate into
   * `act_${accountId}` for any Graph API ad-account-scoped call. */
  accountId: string | null;
  /** The real, decrypted, customer-specific access token obtained through
   * HK Connect's OAuth flow (customer_integrations.access_token_encrypted)
   * — never a shared/global token when a customer-specific one exists. */
  accessToken: string | null;
  source: "hk_connect" | "legacy_column" | "none";
};

/** THE canonical Meta ad-account+token resolver for real campaign/insight
 * synchronization (not just the "is something mapped" status check above).
 * Real production bug: the Meta sync engine (/api/admin/meta-ads POST)
 * resolved its ad account and access token from the separate legacy
 * `ad_integrations` table only — populated exclusively by the old manual
 * "Meta Ad Account ID" form in AdminDashboard. A customer connected the
 * current, real way (HK Connect OAuth → customer_integrations,
 * integration_assets) was never found by that lookup, so every sync
 * attempt silently had no account/token to use at all — exactly the "0
 * kampanya · Veri alınamadı" symptom for a customer who is, in HK
 * Connect's own eyes, fully connected. This resolves from
 * customer_integrations FIRST (HK Connect's selected asset, then the
 * legacy meta_ad_account_id column on that same row, both paired with
 * that row's own real OAuth access_token_encrypted) and returns null only
 * if genuinely nothing is connected there — callers keep falling back to
 * `ad_integrations` themselves for true legacy customers. */
export async function resolveMetaAdAccount(companyId: string): Promise<ResolvedMetaAdAccount> {
  if (!companyId) return { companyId, accountId: null, accessToken: null, source: "none" };
  const rows = await supabaseRest<Array<{ meta_ad_account_id: string | null; integration_assets: unknown; access_token_encrypted: string | null }>>(
    `customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=meta_ad_account_id,integration_assets,access_token_encrypted&limit=1`
  );
  const row = rows[0];
  const oauthAsset = connectedMetaAdAccountAsset(row?.integration_assets);
  const rawAccountId = oauthAsset?.account_id || oauthAsset?.asset_id || row?.meta_ad_account_id || null;
  if (!rawAccountId) return { companyId, accountId: null, accessToken: null, source: "none" };
  // decryptSecret throws (AES-GCM auth-tag mismatch) if the row was ever
  // encrypted under a different INTEGRATION_TOKEN_SECRET/SUPABASE_SERVICE_ROLE_KEY
  // than this process currently has (e.g. a rotated secret, or a stale row
  // from before one was rotated) — never let that crash account
  // resolution; callers already fall back to a legacy/global token when
  // accessToken is null here.
  let accessToken: string | null = null;
  if (row?.access_token_encrypted) {
    try {
      accessToken = decryptSecret(row.access_token_encrypted) || null;
    } catch {
      accessToken = null;
    }
  }
  return {
    companyId,
    accountId: String(rawAccountId).replace(/^act_/, ""),
    accessToken,
    source: oauthAsset ? "hk_connect" : "legacy_column"
  };
}

export type HkConnectMetaIdentity = {
  companyId: string;
  connected: boolean;
  businessId: string | null;
  adAccountId: string | null;
  pageId: string | null;
  instagramBusinessId: string | null;
  // Meta never exposes a "pixel"/"dataset" asset through HK Connect's own
  // discovery (/me/businesses, /me/adaccounts, /me/accounts + derived IG)
  // — these remain manual-entry-only fields with no canonical source to
  // resolve them from, so they are always null here (never a guess).
  pixelAvailable: false;
  datasetAvailable: false;
  tokenStatus: "not_connected" | "connected" | "expired";
  lastSyncedAt: string | null;
  multipleAdAccounts: boolean;
  multiplePages: boolean;
  multipleInstagramAccounts: boolean;
};

/** Customer Profile's "HK Connect'ten Getir" / "Bağlantıyı Doğrula" source
 * — reads the SAME customer_integrations.integration_assets HK Connect
 * already populates (no second Meta integration, no new token store).
 * This is identity resolution only (which account/business/page/IG
 * belongs to the customer) — never campaign metrics, and never returns
 * the access token itself, only a safe status. When more than one asset
 * of a given type is connected, the first (HK Connect's own existing
 * convention, same as connectedMetaAdAccountAsset) is used and the
 * ambiguity is reported via the multiple* flags rather than guessed
 * away silently. */
export async function resolveHkConnectMetaIdentity(companyId: string): Promise<HkConnectMetaIdentity> {
  const empty: HkConnectMetaIdentity = {
    companyId, connected: false, businessId: null, adAccountId: null, pageId: null, instagramBusinessId: null,
    pixelAvailable: false, datasetAvailable: false, tokenStatus: "not_connected", lastSyncedAt: null,
    multipleAdAccounts: false, multiplePages: false, multipleInstagramAccounts: false
  };
  if (!companyId) return empty;
  const rows = await supabaseRest<Array<{ integration_assets: unknown; access_token_encrypted: string | null; token_expires_at: string | null; updated_at: string | null }>>(
    `customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=integration_assets,access_token_encrypted,token_expires_at,updated_at&limit=1`
  );
  const row = rows[0];
  if (!row) return empty;
  const assets: any[] = Array.isArray(row.integration_assets) ? row.integration_assets : [];
  const isMeta = (a: any) => a?.provider === "meta" || ["meta", "facebook", "instagram"].includes(String(a?.platform || ""));
  const byType = (type: string) => assets.filter((a) => isMeta(a) && (a?.asset_type === type || a?.account_type === type));
  const connectedOnly = (list: any[]) => list.filter((a) => String(a?.status || a?.oauth_status || "").startsWith("connected"));
  const businessAssets = connectedOnly(byType("meta_business"));
  const adAccountAssets = connectedOnly(byType("meta_ad_account"));
  const pageAssets = connectedOnly(byType("facebook_page"));
  const igAssets = connectedOnly(byType("instagram_business"));
  const idOf = (a: any) => a?.provider_account_id || a?.account_id || a?.asset_id || null;

  const now = Date.now();
  const tokenStatus: HkConnectMetaIdentity["tokenStatus"] = !row.access_token_encrypted
    ? "not_connected"
    : row.token_expires_at && new Date(row.token_expires_at).getTime() < now
      ? "expired"
      : "connected";
  const lastSyncedAt = [...businessAssets, ...adAccountAssets, ...pageAssets, ...igAssets]
    .map((a) => a?.last_synced_at)
    .filter(Boolean)
    .sort()
    .slice(-1)[0] || row.updated_at || null;

  return {
    companyId,
    connected: assets.some(isMeta),
    businessId: idOf(businessAssets[0]),
    adAccountId: idOf(adAccountAssets[0]),
    pageId: idOf(pageAssets[0]),
    instagramBusinessId: idOf(igAssets[0]),
    pixelAvailable: false,
    datasetAvailable: false,
    tokenStatus,
    lastSyncedAt,
    multipleAdAccounts: adAccountAssets.length > 1,
    multiplePages: pageAssets.length > 1,
    multipleInstagramAccounts: igAssets.length > 1
  };
}

export async function getGoogleAdsAccount(companyId: string): Promise<AdAccountStatus> {
  const rows = await supabaseRest<Array<{ google_ads_customer_id: string | null }>>(
    `customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=google_ads_customer_id&limit=1`
  );
  const accountId = rows[0]?.google_ads_customer_id || null;
  const platformConfigured = Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
  return {
    companyId,
    accountId,
    mapped: Boolean(accountId),
    platformConfigured,
    status: !platformConfigured ? "PLATFORM_NOT_CONFIGURED" : accountId ? "CONNECTED" : "ACCOUNT_NOT_MAPPED",
    note: "Yalnızca hesap eşleşme durumu — gerçek zamanlı kampanya/harcama verisi bu araçla okunmuyor."
  };
}
