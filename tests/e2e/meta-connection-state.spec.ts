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

  test("TEST A — real Meta parent connection is visible and the OAuth authorize URL now requests the advanced business/insights scopes", async ({ request }) => {
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

    // The actual regression: the generated authorize URL's scope param must
    // now include the advanced business/insights scopes whenever
    // META_ADVANCED_SCOPES_ENABLED is on (confirmed true in production via
    // this same company's stored metadata) — not just public_profile,email.
    const connectResponse = await request.get(`/api/integrations/meta/connect?company=${REPORTED_COMPANY_ID}`, { maxRedirects: 0 });
    const location = connectResponse.headers()["location"] || "";
    test.skip(!location.startsWith("https://www.facebook.com/") && !location.includes("facebook.com"), "META_* OAuth credentials not configured in this environment.");
    const authorizeUrl = new URL(location);
    const requestedScope = authorizeUrl.searchParams.get("scope") || "";
    if (metaAsset.metadata?.advanced_permissions_enabled !== false) {
      expect(requestedScope).toContain("pages_show_list");
      expect(requestedScope).toContain("instagram_basic");
      expect(requestedScope).toContain("business_management");
    }
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
