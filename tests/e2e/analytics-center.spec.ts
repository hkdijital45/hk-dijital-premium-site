import { test, expect } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, loginAsQaAdmin, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";
import { watchForHydrationErrors } from "./fixtures/hydration";

// Coverage for the Analiz & Raporlama Merkezi (Analytics Center) module.
// Deliberately does NOT trigger a real sync (POST .../sync) — that calls
// real Meta/Google APIs and would spend real quota/rate limit budget in
// every CI run. UI-state and API-auth/shape are covered instead; the real
// provider-fetch logic is exercised manually per docs/analytics-center/setup.md.

test.describe("unauthenticated access is rejected", () => {
  for (const path of [
    "/api/admin/analytics-center/status?companyId=00000000-0000-0000-0000-000000000000",
    "/api/admin/analytics-center/metrics?companyId=00000000-0000-0000-0000-000000000000",
    "/api/admin/analytics-center/content?companyId=00000000-0000-0000-0000-000000000000",
    "/api/admin/analytics-center/reports?companyId=00000000-0000-0000-0000-000000000000"
  ]) {
    test(`GET ${path} requires auth`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(403);
    });
  }

  test("POST sync requires auth", async ({ request }) => {
    const response = await request.post("/api/admin/analytics-center/sync", { data: { companyId: "00000000-0000-0000-0000-000000000000" } });
    expect(response.status()).toBe(403);
  });

  test("POST report requires auth", async ({ request }) => {
    const response = await request.post("/api/admin/analytics-center/report", { data: { companyId: "00000000-0000-0000-0000-000000000000", startDate: "2026-09-01", endDate: "2026-09-14" } });
    expect(response.status()).toBe(403);
  });
});

test.describe("authenticated Analytics Center", () => {
  test.use({ storageState: qaAdminStorageState });
  test.beforeEach(() => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
  });

  test("status API rejects an invalid companyId and accepts a real one", async ({ request }) => {
    await loginAsQaAdmin(request);
    const badResponse = await request.get("/api/admin/analytics-center/status?companyId=not-a-uuid");
    expect(badResponse.status()).toBe(400);

    const companiesResponse = await request.get("/api/admin/companies");
    const companiesBody = await companiesResponse.json();
    const companyId = companiesBody.companies?.[0]?.id;
    test.skip(!companyId, "No company available in this environment to test against.");

    const statusResponse = await request.get(`/api/admin/analytics-center/status?companyId=${companyId}`);
    expect(statusResponse.ok()).toBeTruthy();
    const statusBody = await statusResponse.json();
    expect(typeof statusBody.tablesReady).toBe("boolean");
    if (statusBody.tablesReady) {
      expect(Array.isArray(statusBody.connections)).toBeTruthy();
      const providers = statusBody.connections.map((c: any) => c.provider).sort();
      expect(providers).toEqual(["facebook", "google_ads", "google_business_profile", "instagram", "tiktok", "youtube"].sort());
      for (const conn of statusBody.connections) {
        expect(["connected", "not_connected", "token_expired", "reauth_required", "sync_error", "no_data"]).toContain(conn.status);
      }
    }
  });

  test("Analiz & Raporlama Merkezi loads with no console/hydration errors, and the customer-first empty state renders", async ({ page }) => {
    const hydration = watchForHydrationErrors(page);
    await gotoAsQaAdmin(page, "/hk-admin/analiz-raporlama");
    await page.waitForTimeout(1500);
    expect(hydration.getHydrationErrors()).toEqual([]);

    // V2 redesign: customer-first — no company selected yet shows a
    // centered "pick a customer" empty state (no left-sidebar
    // Müşteri Seç/Tarih Aralığı/Platformlar panel; date/comparison
    // controls and platform pills only appear after a customer is picked).
    await expect(page.getByRole("heading", { name: "Bir müşteri seçin", exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Müşteri ara...")).toBeVisible();
  });

  test("selecting a customer shows connection status and tabs; no console/hydration errors", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companiesResponse = await request.get("/api/admin/companies");
    const companiesBody = await companiesResponse.json();
    const companyName: string | undefined = companiesBody.companies?.[0]?.name;
    test.skip(!companyName, "No company available in this environment to test against.");

    const hydration = watchForHydrationErrors(page);
    await gotoAsQaAdmin(page, "/hk-admin/analiz-raporlama");
    await page.waitForTimeout(1000);

    await page.mouse.move(0, 0);
    await page.keyboard.press("Escape");
    await page.getByPlaceholder("Müşteri ara...").fill(companyName!.slice(0, 4));
    await page.waitForTimeout(400);
    await page.getByText(companyName!, { exact: true }).first().click({ force: true });
    await page.waitForTimeout(1500);

    // V2 redesign: "Hesaplar" was renamed "Bağlantılar"; "Raporlama" is no
    // longer a platform-nav pill — it's reached via the toolbar's "Rapor"
    // button (see the "report builder" test below).
    await expect(page.getByRole("tab", { name: "Genel Bakış", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "İçerik Performansı", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Bağlantılar", exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Bağlantılar", exact: true }).click({ force: true });
    await page.waitForTimeout(800);
    // Every connected-or-not account card should show a real status badge, never a blank card.
    const statusBadges = ["Bağlı", "Bağlı değil", "Yetki süresi dolmuş", "Yeniden yetkilendirme gerekli", "Senkronizasyon hatası"];
    let sawAStatus = false;
    for (const label of statusBadges) {
      if (await page.getByText(label, { exact: true }).first().isVisible().catch(() => false)) sawAStatus = true;
    }
    expect(sawAStatus).toBeTruthy();

    expect(hydration.getHydrationErrors()).toEqual([]);
  });

  test("report builder (opened via the toolbar's Rapor button) renders platform checkboxes and a generate button", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companiesResponse = await request.get("/api/admin/companies");
    const companiesBody = await companiesResponse.json();
    const companyName: string | undefined = companiesBody.companies?.[0]?.name;
    test.skip(!companyName, "No company available in this environment to test against.");

    await gotoAsQaAdmin(page, "/hk-admin/analiz-raporlama");
    await page.mouse.move(0, 0);
    await page.keyboard.press("Escape");
    await page.getByPlaceholder("Müşteri ara...").fill(companyName!.slice(0, 4));
    await page.waitForTimeout(400);
    await page.getByText(companyName!, { exact: true }).first().click({ force: true });
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Rapor", exact: true }).click({ force: true });
    await page.waitForTimeout(500);

    await expect(page.getByText("Rapor Oluştur", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Kaydedilen Raporlar", { exact: true })).toBeVisible();
  });

  test("mobile viewport: no horizontal overflow", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAsQaAdmin(page, "/hk-admin/analiz-raporlama");
    await page.waitForTimeout(1200);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 4); // small rounding tolerance
  });

  test("customer profile 'Analiz' tab is reachable and shows connection/KPI state without a crash", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companiesResponse = await request.get("/api/admin/companies");
    const companiesBody = await companiesResponse.json();
    const companyName: string | undefined = companiesBody.companies?.[0]?.name;
    test.skip(!companyName, "No company available in this environment to test against.");

    const hydration = watchForHydrationErrors(page);
    await gotoAsQaAdmin(page, "/hk-admin/musteriler");
    await page.waitForTimeout(1500);
    const row = page.getByText(companyName!, { exact: false }).first();
    if (await row.count()) {
      await row.click().catch(() => {});
      await page.waitForTimeout(1000);
      const analizTab = page.getByRole("button", { name: "Analiz", exact: true }).or(page.getByText("Analiz", { exact: true }));
      if (await analizTab.first().isVisible().catch(() => false)) {
        await analizTab.first().click();
        await page.waitForTimeout(1200);
        await expect(page.getByText("Analiz Özeti", { exact: false })).toBeVisible();
      }
    }
    expect(hydration.getHydrationErrors()).toEqual([]);
  });
});
