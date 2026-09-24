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
