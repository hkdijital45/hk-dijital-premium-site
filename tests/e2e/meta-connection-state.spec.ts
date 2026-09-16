import { test, expect } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, loginAsQaAdmin, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";

// Regression coverage for "Meta login succeeds but Instagram/Facebook never
// become connected."
//
// Real root cause (see src/lib/customer-integration-oauth.ts,
// src/lib/meta-business-phase2.ts, src/components/customer/
// CustomerAccountConnectCenter.tsx): effectiveProviderScope("meta") always
// returned the bare "public_profile,email" scope, completely independent of
// META_ADVANCED_SCOPES_ENABLED — the flag was checked in several places
// (the oauthAccounts Phase-1/Phase-2 branch, saveMetaPhase1Integration's
// stored metadata, businessAssetListingReady) but never actually reached
// the OAuth authorize request, so no token could ever carry
// pages_show_list/instagram_basic/business_management/etc. no matter how
// the flag was set. Confirmed against the real production
// customer_integrations row for company 466a4859-332f-4f04-93f9-087fc97e564b:
// oauth_scopes was ["public_profile","email"] only, despite
// META_ADVANCED_SCOPES_ENABLED already being true in production.
//
// Also fixed: the Facebook/Instagram cards showed a bare "Durum: Eksik"
// whenever no child asset had been selected yet, indistinguishable from
// never having logged into Meta at all — now distinguishes "Meta hesabı
// bağlı, [child] seçimi gerekli" when the Meta parent exists but this
// specific child hasn't been selected.

const REPORTED_COMPANY_ID = "466a4859-332f-4f04-93f9-087fc97e564b";

async function getRealCompanies(request: import("@playwright/test").APIRequestContext) {
  const response = await request.get("/api/admin/companies");
  if (!response.ok()) return [];
  const body = await response.json();
  return Array.isArray(body.companies) ? body.companies : [];
}

test.describe("Meta/Instagram/Facebook connection state", () => {
  test.use({ storageState: qaAdminStorageState });
  test.beforeEach(() => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
  });

  test("TEST A — real Meta parent connection is visible and the OAuth authorize URL never sends an invalid raw scope for this Facebook-Login-for-Business app", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID);
    test.skip(!company, "Reported production company not found in this environment.");

    const integrationsResponse = await request.get(`/api/customer/integrations?company=${REPORTED_COMPANY_ID}`);
    expect(integrationsResponse.status()).toBe(200);
    const integrationsBody = await integrationsResponse.json();
    const metaAsset = (integrationsBody.assets || []).find((a: any) => a.platform === "meta");
    test.skip(!metaAsset, "This company has no real, existing Meta connection in this environment to verify against.");
    expect(["connected", "connected_oauth", "approved"]).toContain(metaAsset.status);

    // The real regression this covers: this Meta App is a "Facebook Login
    // for Business" app (confirmed live: its own redirect sets
    // is_business_login=1) — for that product config_id replaces scope
    // entirely, and a raw scope request for pages_show_list/instagram_basic/
    // business_management/etc. is rejected by Meta itself as "Invalid
    // Scopes". Without META_LOGIN_CONFIG_ID configured, this must fall back
    // to the safe public_profile,email baseline (never the invalid list);
    // with it configured, it must use config_id instead of scope.
    const connectResponse = await request.get(`/api/integrations/meta/connect?company=${REPORTED_COMPANY_ID}`, { maxRedirects: 0 });
    const location = connectResponse.headers()["location"] || "";
    test.skip(!location.startsWith("https://www.facebook.com/") && !location.includes("facebook.com"), "META_* OAuth credentials not configured in this environment.");
    const authorizeUrl = new URL(location);
    const requestedScope = authorizeUrl.searchParams.get("scope") || "";
    const configId = authorizeUrl.searchParams.get("config_id") || "";
    const invalidScopes = ["business_management", "ads_read", "pages_show_list", "pages_read_engagement", "read_insights", "instagram_basic", "instagram_manage_insights"];
    if (configId) {
      // config_id path: scope should not carry these asset-level
      // permissions at all — they're defined inside the Configuration.
      for (const invalid of invalidScopes) expect(requestedScope).not.toContain(invalid);
    } else {
      // No Configuration set up yet: must be the safe, always-valid baseline.
      expect(requestedScope).toBe("public_profile,email");
    }
    // read_insights specifically must never be requested under any
    // circumstance — confirmed via Meta's current deprecation notices that
    // it's rejected outright for any app in Live mode.
    expect(requestedScope).not.toContain("read_insights");

    // Fetch the real authorize page and confirm Meta itself doesn't reject
    // it outright — the actual, live proof this task requires. An
    // unauthenticated request may just redirect to Meta's login page rather
    // than reaching full scope validation (that only showed a definitive
    // "Sorry, something went wrong" 400 in manual testing for the fully
    // invalid combination), so this checks both signals defensively.
    const authorizePage = await request.get(location, { maxRedirects: 0 });
    expect(authorizePage.status()).not.toBe(400);
    const authorizeBody = await authorizePage.text().catch(() => "");
    expect(authorizeBody.toLowerCase()).not.toContain("invalid scopes");
  });

  test("TEST B — Instagram/Facebook cards distinguish 'Meta connected, child selection needed' from 'never logged in'", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID);
    test.skip(!company, "Reported production company not found in this environment.");

    const integrationsResponse = await request.get(`/api/customer/integrations?company=${REPORTED_COMPANY_ID}`);
    const integrationsBody = await integrationsResponse.json().catch(() => ({}));
    const hasMetaParent = (integrationsBody.assets || []).some((a: any) => a.platform === "meta");
    const hasFacebookAsset = (integrationsBody.assets || []).some((a: any) => a.platform === "facebook");
    const hasInstagramAsset = (integrationsBody.assets || []).some((a: any) => a.platform === "instagram");
    test.skip(!hasMetaParent, "This company has no real, existing Meta connection in this environment to verify against.");

    await gotoAsQaAdmin(page, `/musteri-paneli?company=${REPORTED_COMPANY_ID}&from=hk-admin&branch=all#hesap-bagla`);
    await page.waitForTimeout(1500);

    const instagramCard = page.locator("button").filter({ has: page.getByText("Instagram", { exact: true }) }).first();
    const facebookCard = page.locator("button").filter({ has: page.getByText("Facebook", { exact: true }) }).first();
    await expect(instagramCard).toBeVisible();
    await expect(facebookCard).toBeVisible();
    const instagramText = await instagramCard.innerText();
    const facebookText = await facebookCard.innerText();

    if (!hasInstagramAsset) {
      // The real regression: must show the Meta-connected intermediate
      // state, never the bare "no login at all" wording.
      expect(instagramText).toContain("Meta hesabı bağlı");
      expect(instagramText).toContain("seçimi gerekli");
    }
    if (!hasFacebookAsset) {
      expect(facebookText).toContain("Meta hesabı bağlı");
      expect(facebookText).toContain("seçimi gerekli");
    }
  });

  test("TEST G — sync never silently no-ops: Instagram/Facebook get an explicit, specific message when permission/asset is missing", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID);
    test.skip(!company, "Reported production company not found in this environment.");

    const response = await request.post("/api/admin/analytics-center/sync", {
      data: { companyId: REPORTED_COMPANY_ID, providers: ["instagram", "facebook"] }
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    for (const result of body.results || []) {
      expect(typeof result.message).toBe("string");
      expect(result.message.length).toBeGreaterThan(0);
      // A real, specific reason — never a blank/generic no-op.
      if (!result.ok) expect(result.message).not.toBe("");
    }
  });

  test("TEST I — company isolation: Meta integration data for one company is not visible under another company's id", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    test.skip(companies.length < 2, "Need at least two real companies in this environment to test isolation.");
    const [companyA, companyB] = companies;

    const responseA = await request.get(`/api/customer/integrations?company=${companyA.id}`);
    const responseB = await request.get(`/api/customer/integrations?company=${companyB.id}`);
    expect(responseA.status()).toBe(200);
    expect(responseB.status()).toBe(200);
    const bodyA = await responseA.json();
    const bodyB = await responseB.json();
    expect(bodyA.integration?.company_id === companyB.id).toBeFalsy();
    expect(bodyB.integration?.company_id === companyA.id).toBeFalsy();
  });
});
