// Regression coverage for a real production bug: HK Connect showed
// "Hesap eşleşmemiş" (ACCOUNT_NOT_MAPPED) for MY CAKE 45's Meta Ads
// account even though the ad account was genuinely selected, confirmed,
// and persisted through the real OAuth/HK Connect asset-selection flow.
// Root cause: getMetaAdsAccount()/getCustomerIntegrations() only ever
// checked the LEGACY customer_integrations.meta_ad_account_id column
// (written solely by manual entry), never the integration_assets array
// the OAuth flow actually persists into. Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/marketing-intelligence/ad-accounts.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { connectedMetaAdAccountAsset, getMetaAdsAccount } from "../../../src/lib/marketing-intelligence/ad-accounts.ts";
import { getCustomerIntegrations } from "../../../src/lib/marketing-intelligence/customers.ts";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live regression check skipped rather than faked.";
// Real, existing production company used to confirm this exact bug —
// read-only checks only, no data is created/modified/deleted.
const MY_CAKE_45_COMPANY_ID = "fc51d411-ea37-45e4-9c93-df0cd43a4a42";

test("connectedMetaAdAccountAsset: finds a connected meta_ad_account entry by asset_type", () => {
  const asset = connectedMetaAdAccountAsset([
    { asset_type: "meta_business", status: "connected_oauth", account_id: "111" },
    { asset_type: "meta_ad_account", status: "connected_oauth", account_id: "act_222", asset_id: "act_222" }
  ]);
  assert.ok(asset);
  assert.equal(asset!.account_id, "act_222");
});

test("connectedMetaAdAccountAsset: finds it via account_type when asset_type is absent", () => {
  const asset = connectedMetaAdAccountAsset([{ account_type: "meta_ad_account", status: "connected_oauth", asset_id: "act_333" }]);
  assert.ok(asset);
  assert.equal(asset!.asset_id, "act_333");
});

test("connectedMetaAdAccountAsset REGRESSION — an ad account asset with a non-connected status is never treated as mapped", () => {
  const asset = connectedMetaAdAccountAsset([{ asset_type: "meta_ad_account", status: "pending_review", account_id: "act_444" }]);
  assert.equal(asset, null);
});

test("connectedMetaAdAccountAsset: ignores unrelated asset types (facebook_page, instagram_business, meta_business, meta_user)", () => {
  const asset = connectedMetaAdAccountAsset([
    { asset_type: "facebook_page", status: "connected_oauth", account_id: "1" },
    { asset_type: "instagram_business", status: "connected_oauth", account_id: "2" },
    { asset_type: "meta_business", status: "connected_oauth", account_id: "3" },
    { asset_type: "meta_user", status: "connected_oauth", account_id: "4" }
  ]);
  assert.equal(asset, null);
});

test("connectedMetaAdAccountAsset: null/undefined/non-array input never throws, returns null", () => {
  assert.equal(connectedMetaAdAccountAsset(null), null);
  assert.equal(connectedMetaAdAccountAsset(undefined), null);
  assert.equal(connectedMetaAdAccountAsset("not-an-array"), null);
  assert.equal(connectedMetaAdAccountAsset([]), null);
});

test("getMetaAdsAccount REGRESSION — MY CAKE 45's real, OAuth-connected ad account is resolved as mapped, not ACCOUNT_NOT_MAPPED", { skip: hasSupabase ? false : skipReason }, async () => {
  const result = await getMetaAdsAccount(MY_CAKE_45_COMPANY_ID);
  // `status` also folds in platformConfigured (Boolean(META_APP_ID &&
  // META_APP_SECRET)), which this local sandbox's .env.local does not
  // define (only production Vercel does) — asserting on `mapped`/
  // `accountId` directly proves the actual fix (integration_assets
  // fallback) without depending on unrelated local env setup.
  assert.equal(result.mapped, true, `expected the ad account to resolve as mapped (root cause: legacy meta_ad_account_id column vs. integration_assets), got status=${result.status}`);
  assert.equal(result.accountId, "act_1880913352876322");
  assert.notEqual(result.status, "ACCOUNT_NOT_MAPPED");
});

test("getCustomerIntegrations REGRESSION — the MCP-facing status for MY CAKE 45 never contradicts HK Connect's own status (both now read integration_assets)", { skip: hasSupabase ? false : skipReason }, async () => {
  const result = await getCustomerIntegrations(MY_CAKE_45_COMPANY_ID);
  assert.equal(result.metaAds, "CONNECTED");
  assert.equal(result.metaAdAccountId, "act_1880913352876322");
});
