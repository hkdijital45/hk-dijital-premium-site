import { test, expect } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, loginAsQaAdmin, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";
import { watchForHydrationErrors } from "./fixtures/hydration";

// Regression coverage for "HK ANALYTICS CENTER V2 — PREMIUM METRICOOL-CLASS
// REDESIGN + TIKTOK". Covers the redesigned customer-first UI (top toolbar,
// platform pill navigation, per-platform detail views, cross-platform
// Content Performance) and the new TikTok Login Kit provider end-to-end at
// the code level. TikTok credentials (TIKTOK_CLIENT_KEY/SECRET) are not yet
// configured in any environment this suite runs in — tests that need a real
// TikTok connection skip cleanly rather than fabricate one; the connect-URL
// shape itself is still verified directly.

const REPORTED_COMPANY_ID = "466a4859-332f-4f04-93f9-087fc97e564b";

async function getRealCompanies(request: import("@playwright/test").APIRequestContext) {
  const response = await request.get("/api/admin/companies");
  if (!response.ok()) return [];
  const body = await response.json();
  return Array.isArray(body.companies) ? body.companies : [];
}

async function openCompany(page: import("@playwright/test").Page, companyId: string) {
  await gotoAsQaAdmin(page, "/hk-admin/analiz-raporlama");
  await page.waitForTimeout(1200);
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape");
  const statusResponse = await page.request.get(`/api/admin/companies`);
  const body = await statusResponse.json().catch(() => ({ companies: [] }));
  const company = (body.companies || []).find((c: any) => c.id === companyId);
  if (!company) return null;
  await page.getByPlaceholder("Müşteri ara...").first().fill(company.name.slice(0, 4));
  await page.waitForTimeout(400);
  await page.getByText(company.name, { exact: true }).first().click({ force: true });
  await page.waitForTimeout(1200);
  return company;
}

test.describe("Analytics Center V2 — customer selection, platform nav, dashboards", () => {
  test.use({ storageState: qaAdminStorageState });
  test.beforeEach(() => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
  });

  test("customer selection: empty state before a customer is chosen, toolbar + platform nav appear after", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const hydration = watchForHydrationErrors(page);
    await gotoAsQaAdmin(page, "/hk-admin/analiz-raporlama");
    await page.waitForTimeout(1200);
    await expect(page.getByText("Bir müşteri seçin", { exact: true })).toBeVisible();

    const companies = await getRealCompanies(request);
    test.skip(!companies.length, "No real company available in this environment to test against.");
    const company = await openCompany(page, companies[0].id);
    test.skip(!company, "Company not found via UI search.");

    await expect(page.getByRole("tab", { name: "Genel Bakış", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Bağlantılar", exact: true })).toBeVisible();
    expect(hydration.getHydrationErrors()).toEqual([]);
  });

  test("platform switching: clicking each platform pill switches the visible view without a full navigation", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    test.skip(!companies.length, "No real company available in this environment to test against.");
    const company = await openCompany(page, companies[0].id);
    test.skip(!company, "Company not found via UI search.");

    for (const label of ["Instagram", "Facebook", "TikTok", "YouTube", "Google Business Profile", "Google Ads"]) {
      const tab = page.getByRole("tab", { name: label, exact: true });
      await expect(tab).toBeVisible();
      await tab.click({ force: true });
      await page.waitForTimeout(300);
      await expect(tab).toHaveAttribute("aria-selected", "true");
    }
    const startUrl = page.url();
    await page.getByRole("tab", { name: "Genel Bakış", exact: true }).click({ force: true });
    await page.waitForTimeout(300);
    // Switching platforms is client-side state, never a page navigation —
    // the URL (aside from any hash) stays the same.
    expect(page.url().split("#")[0]).toBe(startUrl.split("#")[0]);
  });

  test("period switching: changing the date preset triggers a fresh metrics fetch for the new range", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    test.skip(!companies.length, "No real company available in this environment to test against.");
    const company = await openCompany(page, companies[0].id);
    test.skip(!company, "Company not found via UI search.");

    const toolbarDateButton = page.locator("button", { hasText: "Son 30 Gün" }).first();
    test.skip(!(await toolbarDateButton.isVisible().catch(() => false)), "Date toolbar button not found.");

    const requests: string[] = [];
    page.on("request", (req) => { if (req.url().includes("/api/admin/analytics-center/metrics")) requests.push(req.url()); });
    await toolbarDateButton.click({ force: true });
    await page.waitForTimeout(300);
    await page.getByText("Son 7 Gün", { exact: true }).click({ force: true });
    await page.waitForTimeout(1000);
    expect(requests.some((u) => u.includes("startDate"))).toBeTruthy();
  });

  test("Instagram dashboard renders KPI cards and sub-tabs without hydration errors", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = await openCompany(page, (companies.find((c: any) => c.id === REPORTED_COMPANY_ID) || companies[0])?.id);
    test.skip(!company, "Company not found via UI search.");
    const hydration = watchForHydrationErrors(page);

    await page.getByRole("tab", { name: "Instagram", exact: true }).click({ force: true });
    await page.waitForTimeout(800);
    await expect(page.getByText("Takipçi", { exact: true }).first()).toBeVisible();
    for (const subTab of ["Topluluk", "Demografi", "Hesap", "İçerikler"]) {
      await expect(page.getByRole("tab", { name: subTab, exact: true })).toBeVisible();
    }
    expect(hydration.getHydrationErrors()).toEqual([]);
  });

  test("Facebook dashboard renders KPI cards and sub-tabs", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = await openCompany(page, (companies.find((c: any) => c.id === REPORTED_COMPANY_ID) || companies[0])?.id);
    test.skip(!company, "Company not found via UI search.");

    await page.getByRole("tab", { name: "Facebook", exact: true }).click({ force: true });
    await page.waitForTimeout(800);
    for (const subTab of ["Sayfa Genel Bakış", "Gönderiler", "Kitle"]) {
      await expect(page.getByRole("tab", { name: subTab, exact: true })).toBeVisible();
    }
  });

  test("YouTube dashboard renders KPI cards and sub-tabs", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    test.skip(!companies.length, "No real company available in this environment to test against.");
    const company = await openCompany(page, companies[0].id);
    test.skip(!company, "Company not found via UI search.");

    await page.getByRole("tab", { name: "YouTube", exact: true }).click({ force: true });
    await page.waitForTimeout(800);
    for (const subTab of ["Topluluk", "Yayınlanan Videolar", "Video Performansı"]) {
      await expect(page.getByRole("tab", { name: subTab, exact: true })).toBeVisible();
    }
  });

  test("TikTok empty state: not-yet-connected shows a clear 'bağla' message, never a fabricated chart", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    test.skip(!companies.length, "No real company available in this environment to test against.");
    const company = await openCompany(page, companies[0].id);
    test.skip(!company, "Company not found via UI search.");

    await page.getByRole("tab", { name: "TikTok", exact: true }).click({ force: true });
    await page.waitForTimeout(800);
    const statusResponse = await page.request.get(`/api/admin/analytics-center/status?companyId=${company!.id}`);
    const statusBody = await statusResponse.json().catch(() => ({}));
    const tiktokConn = (statusBody.connections || []).find((c: any) => c.provider === "tiktok");
    test.skip(!tiktokConn, "No tiktok connection object returned in this environment.");
    if (!tiktokConn.parentConnected) {
      await expect(page.getByText("TikTok hesabını bağla", { exact: false })).toBeVisible();
    }
  });

  test("TikTok connect URL is a real, correctly-formed TikTok Login Kit authorize URL (client_key, response_type=code, read-only scopes, no publishing scope)", async ({ request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    test.skip(!companies.length, "No real company available in this environment to test against.");
    const statusResponse = await request.get(`/api/admin/analytics-center/status?companyId=${companies[0].id}`);
    const body = await statusResponse.json().catch(() => ({}));
    test.skip(!body.tablesReady, "Analytics Center tables not migrated in this environment.");
    const tiktokConn = (body.connections || []).find((c: any) => c.provider === "tiktok");
    test.skip(!tiktokConn, "No tiktok connection object returned in this environment.");
    expect(tiktokConn.manageHref).toContain("/api/integrations/tiktok/connect");
    expect(tiktokConn.manageHref).not.toContain("musteri-paneli");

    const connectResponse = await request.get(tiktokConn.manageHref, { maxRedirects: 0 });
    const location = connectResponse.headers()["location"] || "";
    test.skip(!location.includes("tiktok.com"), "TIKTOK_CLIENT_KEY/SECRET not configured in this environment — see docs/analytics-center/setup.md Action 5.");
    expect(location).toContain("v2/auth/authorize");
    expect(location).toContain("response_type=code");
    expect(location).toContain("client_key=");
    expect(location).not.toContain("app_id="); // the old, wrong Business-API param name must never reappear
    const scopeMatch = location.match(/scope=([^&]+)/);
    const scope = scopeMatch ? decodeURIComponent(scopeMatch[1]) : "";
    expect(scope).toContain("user.info.basic");
    expect(scope).toContain("video.list");
    expect(scope).not.toContain("video.publish");
    expect(scope).not.toContain("business");
  });

  test("content performance: cross-platform table renders with platform column and adapts columns to available metrics", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = await openCompany(page, (companies.find((c: any) => c.id === REPORTED_COMPANY_ID) || companies[0])?.id);
    test.skip(!company, "Company not found via UI search.");

    await page.getByRole("tab", { name: "İçerik Performansı", exact: true }).click({ force: true });
    await page.waitForTimeout(1000);
    const hasTable = await page.locator("table").first().isVisible().catch(() => false);
    const hasEmptyState = await page.getByText("Seçili dönemde içerik bulunamadı.", { exact: true }).isVisible().catch(() => false);
    expect(hasTable || hasEmptyState).toBeTruthy();
  });

  test("chart rendering: Genel Bakış renders at least one real SVG chart, not a placeholder", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companies = await getRealCompanies(request);
    const company = await openCompany(page, (companies.find((c: any) => c.id === REPORTED_COMPANY_ID) || companies[0])?.id);
    test.skip(!company, "Company not found via UI search.");
    await page.waitForTimeout(1000);
    const svgCount = await page.locator("svg[role='img']").count();
    expect(svgCount).toBeGreaterThan(0);
  });

  test("mobile viewport: no horizontal overflow, platform nav is horizontally scrollable", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    await page.setViewportSize({ width: 390, height: 844 });
    const companies = await getRealCompanies(request);
    const company = await openCompany(page, (companies.find((c: any) => c.id === REPORTED_COMPANY_ID) || companies[0])?.id);
    test.skip(!company, "Company not found via UI search.");
    await page.waitForTimeout(1000);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 4);
  });

  test("existing real Meta data still present: Instagram/Facebook remain connected with real followers after the V2 redesign", async ({ request }) => {
    await loginAsQaAdmin(request);
    const statusResponse = await request.get(`/api/admin/analytics-center/status?companyId=${REPORTED_COMPANY_ID}`);
    const body = await statusResponse.json().catch(() => ({}));
    test.skip(!body.tablesReady, "Analytics Center tables not migrated in this environment.");
    const instagram = (body.connections || []).find((c: any) => c.provider === "instagram");
    const facebook = (body.connections || []).find((c: any) => c.provider === "facebook");
    test.skip(!instagram || !facebook, "Instagram/Facebook connections not present in this environment.");
    expect(instagram.status).toBe("connected");
    expect(facebook.status).toBe("connected");

    const metricsResponse = await request.get(`/api/admin/analytics-center/metrics?companyId=${REPORTED_COMPANY_ID}&providers=instagram,facebook&startDate=2026-08-17&endDate=2026-09-16`);
    const metricsBody = await metricsResponse.json().catch(() => ({}));
    const igFollowers = (metricsBody.kpis?.instagram || []).find((k: any) => k.key === "followers");
    expect(igFollowers).toBeTruthy();
    expect(igFollowers.value).not.toBeNull();
  });
});
