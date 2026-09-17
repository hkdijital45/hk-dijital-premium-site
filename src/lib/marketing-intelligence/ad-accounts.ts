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

export async function getMetaAdsAccount(companyId: string): Promise<AdAccountStatus> {
  const rows = await supabaseRest<Array<{ meta_ad_account_id: string | null; meta_business_id: string | null }>>(
    `customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=meta_ad_account_id,meta_business_id&limit=1`
  );
  const accountId = rows[0]?.meta_ad_account_id || null;
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
