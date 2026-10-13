// Regression coverage for a real production bug: Claude's connected
// tool (meta_ads_performance, backed by getMetaAdsPerformance) returned
// ACCOUNT_NOT_MAPPED for MY CAKE 45 even though the SAME account was
// already resolved correctly by meta_ads_account (ad-accounts.ts) and
// the HK Admin dashboard. Root cause: getMetaAdsPerformance only ever
// checked the legacy ad_integrations table (findCustomerMetaMapping) —
// a customer connected the current way (HK Connect OAuth ->
// customer_integrations/integration_assets) has no row there at all.
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/marketing-intelligence/ad-performance.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { getMetaAdsPerformance } from "../../../src/lib/marketing-intelligence/ad-performance.ts";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live regression check skipped rather than faked.";
// Real, existing production company used to confirm this exact bug —
// read-only checks only, no data is created/modified/deleted.
const MY_CAKE_45_COMPANY_ID = "fc51d411-ea37-45e4-9c93-df0cd43a4a42";

test(
  "getMetaAdsPerformance REGRESSION — MY CAKE 45's HK-Connect-only account (no legacy ad_integrations row) never returns ACCOUNT_NOT_MAPPED",
  { skip: hasSupabase ? false : skipReason },
  async () => {
    const result = await getMetaAdsPerformance(MY_CAKE_45_COMPANY_ID, "last_30d");
    // The fix is proven by ruling out ACCOUNT_NOT_MAPPED specifically —
    // AUTH_EXPIRED is a separate, legitimate, pre-existing outcome in any
    // environment whose INTEGRATION_TOKEN_SECRET/SUPABASE_SERVICE_ROLE_KEY
    // doesn't match whichever secret encrypted the real token (documented
    // in ad-accounts.test.ts's resolveMetaAdAccount regression test too),
    // never silently mapped to success.
    assert.notEqual(
      (result as { reason?: string }).reason,
      "ACCOUNT_NOT_MAPPED",
      `expected the account to resolve via the canonical resolveMetaAdAccount fallback, got ${JSON.stringify(result)}`
    );
  }
);

test(
  "getMetaAdsPerformance: an unknown/unconnected company still returns ACCOUNT_NOT_MAPPED (the fallback never fabricates a mapping)",
  { skip: hasSupabase ? false : skipReason },
  async () => {
    const result = await getMetaAdsPerformance("00000000-0000-0000-0000-000000000000", "last_30d");
    assert.deepEqual(result, { connected: false, reason: "ACCOUNT_NOT_MAPPED" });
  }
);

test("getMetaAdsPerformance: empty companyId never throws", async () => {
  const result = await getMetaAdsPerformance("", "last_30d");
  assert.equal((result as { reason?: string }).reason, "ACCOUNT_NOT_MAPPED");
});
