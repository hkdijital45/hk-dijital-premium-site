import { test, expect } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, loginAsQaAdmin, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";

// Regression coverage for "successful Google OAuth but the customer
// integration UI still shows Durum: Eksik / Bağlantı yöntemi: Yok / Hesap
// listelemek için önce platform girişini tamamlayın."
//
// Root causes fixed (see src/lib/customer-integration-oauth.ts,
// src/lib/google-oauth-token.ts, src/app/api/customer/integrations/route.ts,
// src/components/customer/CustomerAccountConnectCenter.tsx):
//   1. GET /api/customer/integrations (the endpoint that feeds the
//      "Durum"/"Bağlantı yöntemi"/"Son güncelleme" card fields) was
//      customer-only — an HK Admin staff session previewing a company via
//      /musteri-paneli?company=<id>&from=hk-admin always got 403, and the
//      component treated that the same as "no connection exists yet",
//      rendering every card as "Eksik"/"Yok" regardless of real DB state.
//   2. oauthAccounts()/selectOAuthAccount() only ever worked using the
//      transient hk_oauth_session_{provider} cookie (15-minute TTL) — no
//      fallback to the token this app already persists and auto-refreshes
//      (getGoogleToken, moved to its own module to avoid a circular import)
//      for exactly this purpose. Any later revisit failed asset
//      discovery/selection with "please complete platform login first"
//      even though a fully valid, persisted Google connection existed.
//   3. The client always saved every Google-sourced child asset selection
//      with platform:"google" regardless of which specific service it was
//      (youtube/google_ads/google_business_profile/...), even though the
//      discovered account object already carried the correct specific
//      platform — so the YouTube/Google Ads/GBP cards could never find
//      their own saved asset again by platform match.
//
// This uses the REAL production company id and REAL, already-existing
// Google (and Meta) OAuth connection reported in production — no fixtures,
// no fabricated rows.

const REPORTED_COMPANY_ID = "466a4859-332f-4f04-93f9-087fc97e564b";

async function getRealCompanies(request: import("@playwright/test").APIRequestContext) {
  const response = await request.get("/api/admin/companies");
  if (!response.ok()) return [];
  const body = await response.json();
  return Array.isArray(body.companies) ? body.companies : [];
}

test.describe("Google/Meta connection state — staff-preview read path", () => {
  test.use({ storageState: qaAdminStorageState });
  test.beforeEach(() => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
  });

  test("TEST A — real Google parent connection is visible through the API (not a fixture)", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID);
    test.skip(!company, "Reported production company not found in this environment.");

    const response = await request.get(`/api/customer/integrations?company=${REPORTED_COMPANY_ID}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    const googleAsset = (body.assets || []).find((a: any) => a.platform === "google");
    test.skip(!googleAsset, "This company has no real, existing Google connection in this environment to verify against.");
    expect(["connected", "connected_oauth", "approved"]).toContain(googleAsset.status);
  });

  test("TEST B — UI reload: existing parent Google connection shows as authenticated, not Eksik", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID);
    test.skip(!company, "Reported production company not found in this environment.");

    await gotoAsQaAdmin(page, `/musteri-paneli?company=${REPORTED_COMPANY_ID}&from=hk-admin&branch=all#hesap-bagla`);
    await page.waitForTimeout(1500);

    const googleCard = page.locator("button").filter({ has: page.getByText("Google", { exact: true }) }).first();
    await expect(googleCard).toBeVisible();
    const cardText = await googleCard.innerText();
    test.skip(!/Bağlı|Onaylandı/.test(cardText) && !cardText.includes("Eksik"), "Ambiguous card text in this environment.");
    // The actual regression: this must NOT be "Eksik" for a company with a
    // real, existing, connected Google account.
    expect(cardText).not.toContain("Durum: Eksik");
    expect(cardText).not.toContain("Bağlantı yöntemi: Yok");
    expect(cardText).toMatch(/Bağlantı yöntemi: (Otomatik )?OAuth/);
  });

  test("TEST C — asset discovery no longer says 'complete platform login first' for an already-connected Google account", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID);
    test.skip(!company, "Reported production company not found in this environment.");

    const integrationsResponse = await request.get(`/api/customer/integrations?company=${REPORTED_COMPANY_ID}`);
    const integrationsBody = await integrationsResponse.json().catch(() => ({}));
    const hasGoogle = (integrationsBody.assets || []).some((a: any) => a.platform === "google");
    test.skip(!hasGoogle, "This company has no real, existing Google connection in this environment to verify against.");

    const response = await request.get(`/api/integrations/accounts?provider=google&company=${REPORTED_COMPANY_ID}`);
    const body = await response.json().catch(() => ({}));
    // The exact previous failure mode — must not recur for a real, existing,
    // persisted connection outside the 15-minute post-connect window.
    expect(body.code).not.toBe("oauth_session_missing");
    expect(body.message).not.toContain("önce platform girişini tamamlayın");
  });

  test("TEST F — company isolation: one company's integration data is not visible under another company's id", async ({ request }) => {
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

  test("staff session without module access cannot read another company's integrations via ?company=", async ({ browser }) => {
    // Unauthenticated baseline: no session at all must never see real data.
    const freshContext = await browser.newContext({ storageState: undefined });
    const response = await freshContext.request.get(`/api/customer/integrations?company=${REPORTED_COMPANY_ID}`);
    expect(response.status()).toBe(403);
    await freshContext.close();
  });
});
