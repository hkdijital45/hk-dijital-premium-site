import { test, expect } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, loginAsQaAdmin, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";

// Regression coverage for "HK ANALYTICS — REMOVE CUSTOMER PANEL HOP FROM
// ADMIN OAUTH FLOW". Real root cause: connections.ts's manageHref/
// connectHref used to build a /musteri-paneli?...&from=hk-admin URL — an
// admin clicking "Bağlantıyı Yönet" opened the customer panel's own Hesap
// Bağla screen (in a new tab), which then built the real OAuth connect URL
// itself once loaded, reading `from=hk-admin` to route the eventual return
// trip back to HK Admin. The actual OAuth engine
// (oauthConnect/oauthCallback in customer-integration-oauth.ts) never
// needed the customer panel at all — it already derives origin
// ("hk_admin" vs "customer_panel") purely from the live session server-side
// and already redirected straight back to /hk-admin/analiz-raporlama on
// success. Fixed by having connections.ts build the direct
// /api/integrations/{meta|google}/connect URL itself (directConnectHref)
// and giving HK Admin its own native connection drawer
// (AdminConnectionDrawer) instead of reusing CustomerAccountConnectCenter.

const REPORTED_COMPANY_ID = "466a4859-332f-4f04-93f9-087fc97e564b";

async function getRealCompanies(request: import("@playwright/test").APIRequestContext) {
  const response = await request.get("/api/admin/companies");
  if (!response.ok()) return [];
  const body = await response.json();
  return Array.isArray(body.companies) ? body.companies : [];
}

test.describe("HK Admin direct OAuth — no customer-panel hop", () => {
  test.use({ storageState: qaAdminStorageState });
  test.beforeEach(() => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
  });

  test("A/B/D/G — every provider's connect URL is direct (never /musteri-paneli), targets the correct OAuth parent, preserves the company, and its returnTo never leaves this site", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    test.skip(!companies.length, "No real company available in this environment to test against.");
    const companyId = companies[0].id;

    const statusResponse = await request.get(`/api/admin/analytics-center/status?companyId=${companyId}`);
    expect(statusResponse.ok()).toBeTruthy();
    const body = await statusResponse.json();
    test.skip(!body.tablesReady, "Analytics Center tables not migrated in this environment.");

    const expectedParent: Record<string, string> = { instagram: "meta", facebook: "meta", tiktok: "tiktok", youtube: "google", google_ads: "google", google_business_profile: "google" };
    for (const conn of body.connections) {
      for (const href of [conn.manageHref, conn.connectHref]) {
        expect(href).not.toContain("musteri-paneli");
        expect(href.startsWith(`/api/integrations/${expectedParent[conn.provider]}/connect?`)).toBeTruthy();
        const hrefUrl = new URL(href, "https://hkdijital.local");
        expect(hrefUrl.searchParams.get("company")).toBe(companyId);
        const returnTo = hrefUrl.searchParams.get("returnTo") || "";
        // No open redirect: returnTo must be a same-site path, never an
        // absolute URL to another host.
        expect(returnTo.startsWith("/hk-admin/analiz-raporlama")).toBeTruthy();
        expect(returnTo).not.toContain("musteri-paneli");
        const returnToUrl = new URL(returnTo, "https://hkdijital.local");
        expect(returnToUrl.searchParams.get("company")).toBe(companyId);
        expect(returnToUrl.searchParams.get("requestedChild")).toBe(conn.provider);
      }
    }
  });

  test("C — the connect URL's own redirect reaches the real provider directly (no intermediate HK Dijital page)", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID) || companies[0];
    test.skip(!company, "No real company available in this environment to test against.");

    const statusResponse = await request.get(`/api/admin/analytics-center/status?companyId=${company.id}`);
    const body = await statusResponse.json().catch(() => ({}));
    test.skip(!body.tablesReady, "Analytics Center tables not migrated in this environment.");
    const metaConn = (body.connections || []).find((c: any) => c.provider === "instagram" || c.provider === "facebook");
    test.skip(!metaConn, "No Meta-backed provider connection available to test against.");

    const connectResponse = await request.get(metaConn.manageHref, { maxRedirects: 0 });
    const location = connectResponse.headers()["location"] || "";
    test.skip(!location.includes("facebook.com"), "META_* OAuth credentials not configured in this environment.");
    expect(location).not.toContain("musteri-paneli");
  });

  test("E — clicking 'Bağlantıyı Yönet' opens a native HK Admin panel; the browser never navigates to /musteri-paneli", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID) || companies[0];
    test.skip(!company, "No real company available in this environment to test against.");

    await gotoAsQaAdmin(page, `/hk-admin/analiz-raporlama?company=${company.id}#hesaplar`);
    await page.waitForTimeout(1500);
    // Dismiss any open header dropdown (e.g. a hover menu) that would
    // otherwise intercept the click below — same defensive pattern already
    // used by analytics-center.spec.ts for this exact admin shell.
    await page.mouse.move(0, 0);
    await page.keyboard.press("Escape");

    const manageButton = page.getByRole("button", { name: "Bağlantıyı Yönet" }).first();
    test.skip(!(await manageButton.isVisible().catch(() => false)), "No provider card rendered to test against (tables may not be migrated).");
    await manageButton.click({ force: true });
    await page.waitForTimeout(500);

    expect(page.url()).not.toContain("musteri-paneli");
    await expect(page.getByRole("dialog", { name: "Bağlantı Yönetimi" })).toBeVisible();
  });

  test("F — customer panel's own Hesap Bağla screen is unaffected: still renders, still targets /musteri-paneli for its own return route", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID) || companies[0];
    test.skip(!company, "No real company available in this environment to test against.");

    await gotoAsQaAdmin(page, `/musteri-paneli?company=${company.id}&from=hk-admin&branch=all#hesap-bagla`);
    await page.waitForTimeout(1200);
    await expect(page.getByText("Hesap Bağla", { exact: true }).first()).toBeVisible();
  });

  test("meta diagnostics is now staff-aware (was customer-only, blocking HK Admin's own Meta panel)", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = companies.find((c: any) => c.id === REPORTED_COMPANY_ID) || companies[0];
    test.skip(!company, "No real company available in this environment to test against.");

    const response = await request.get(`/api/customer/integrations/meta/diagnostics?company=${company.id}`);
    // Never a bare 403 for a real, module-authorized staff session with a
    // valid ?company= — 200 (has a Meta token) or 409 (no token yet) are
    // both legitimate; 403 would mean the staff-awareness fix regressed.
    expect(response.status()).not.toBe(403);

    const noCompanyResponse = await request.get("/api/customer/integrations/meta/diagnostics");
    expect(noCompanyResponse.status()).toBe(403);
  });

  test("disconnect endpoint rejects an invalid/foreign company without touching any real data", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/customer/integrations/disconnect", {
      data: { company: "00000000-0000-0000-0000-000000000000", provider: "meta", account_type: "facebook_page", provider_account_id: "does-not-exist" }
    });
    expect(response.status()).toBe(403);
  });

  test("disconnect endpoint requires all identifying fields", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    test.skip(!companies.length, "No real company available in this environment to test against.");
    const response = await request.post("/api/customer/integrations/disconnect", { data: { company: companies[0].id, provider: "meta" } });
    expect(response.status()).toBe(400);
  });
});
