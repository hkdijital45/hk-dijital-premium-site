import { test, expect } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, qaSkipReason } from "./fixtures/qa-auth";

test.beforeEach(() => {
  test.skip(!hasQaAdminCredentials(), qaSkipReason);
});

const REPRESENTATIVE_ROUTES = [
  "/hk-admin",
  "/hk-admin/musteriler",
  "/hk-admin/karlilik",
  "/hk-admin/agent-hub",
  "/hk-admin/blog-seo",
  "/hk-admin/entegrasyonlar",
  "/hk-admin/kullanici-yonetimi",
  "/hk-admin/sistem-sagligi",
  "/hk-admin/sistem-ayarlari"
];

for (const path of REPRESENTATIVE_ROUTES) {
  test(`admin route ${path} loads for an authenticated admin with no fatal console errors`, async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await gotoAsQaAdmin(page, path);
    await page.waitForLoadState("domcontentloaded");

    expect(pageErrors, `${path} must not throw uncaught page errors`).toEqual([]);
    const hydrationErrors = consoleErrors.filter((text) => /hydrat/i.test(text));
    expect(hydrationErrors, `${path} must not produce hydration warnings`).toEqual([]);
  });
}

test("admin navigation renders after authentication", async ({ page }) => {
  await gotoAsQaAdmin(page, "/hk-admin");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("nav, aside, [role='navigation']").first()).toBeVisible();
});

test("protected admin content is not visible before authentication (fresh context)", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/hk-admin", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/hk-admin$/);
  await context.close();
});
