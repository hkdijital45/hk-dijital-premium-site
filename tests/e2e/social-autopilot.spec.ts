import { test, expect } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";

test.use({ storageState: qaAdminStorageState });

test.beforeEach(() => {
  test.skip(!hasQaAdminCredentials(), qaSkipReason);
});

test("Social Autopilot route renders for an authenticated admin with no fatal console errors", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await gotoAsQaAdmin(page, "/hk-admin/social-autopilot");
  await page.waitForLoadState("domcontentloaded");

  await expect(page.getByText("HK Social Autopilot")).toBeVisible();
  expect(pageErrors, "the page must not throw uncaught page errors").toEqual([]);
});

test("all 9 tabs are present and switching tabs updates the active tab", async ({ page }) => {
  await gotoAsQaAdmin(page, "/hk-admin/social-autopilot");
  await page.waitForLoadState("domcontentloaded");

  const tabLabels = [
    "Genel Bakış", "30 Günlük Strateji", "İçerik Takvimi", "İçerik Stüdyosu",
    "Yayın Kuyruğu", "Instagram Analytics", "AI Öğrenmeleri", "Autopilot Ayarları", "Entegrasyonlar"
  ];
  for (const label of tabLabels) {
    await expect(page.getByRole("tab", { name: label })).toBeVisible();
  }

  await page.getByRole("tab", { name: "Autopilot Ayarları" }).click();
  await expect(page.getByText("Autopilot Kontrol")).toBeVisible();

  await page.getByRole("tab", { name: "Entegrasyonlar" }).click();
  await expect(page.getByText("Gizlilik Filtresi")).toBeVisible();
});

test("the autopilot active/pause switch and emergency stop control are visible on the overview tab", async ({ page }) => {
  await gotoAsQaAdmin(page, "/hk-admin/social-autopilot");
  await page.waitForLoadState("domcontentloaded");

  await expect(page.getByText("Autopilot Durumu")).toBeVisible();
  await expect(page.getByRole("button", { name: /OTOMATİK YAYINI DURDUR|Acil Durdurmayı Kaldır/ })).toBeVisible();
});

test("a non-admin cannot load the Social Autopilot route", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/hk-admin/social-autopilot", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/hk-admin\/social-autopilot$/);
  await context.close();
});
