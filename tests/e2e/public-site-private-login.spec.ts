import { test, expect } from "@playwright/test";
import { hasQaAdminCredentials, qaSkipReason } from "./fixtures/qa-auth";

// Regression coverage for the public-site redesign + private admin login
// consolidation: no public login entry point should remain, the old public
// login routes must not expose the login screen to unauthenticated
// visitors, and the private (env-controlled) path must still reach the
// real login screen and authenticate correctly.
const PRIVATE_PATH = process.env.PRIVATE_ADMIN_LOGIN_PATH;

test("public homepage loads with no page errors", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBeLessThan(400);
  expect(pageErrors).toEqual([]);
});

test("public navigation links resolve", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Hakkımızda" }).first().click();
  await page.waitForURL("**/hakkimda");
});

test("no public login link is visible on the homepage (desktop or mobile)", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const html = await page.content();
  expect(html).not.toContain("Müşteri Girişi");
  expect(html).not.toContain("Admin Girişi");
  const digitalCenterLinks = await page.locator('a[href*="digital-center"]').count();
  expect(digitalCenterLinks, "no visible link should point at the login route").toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const menuButton = page.getByRole("button", { name: /menü/i });
  await menuButton.click();
  const mobileHtml = await page.content();
  expect(mobileHtml).not.toContain("Müşteri Girişi");
});

test("orphaned legacy login shortcuts (/login, /giris) redirect home instead of exposing a login form", async ({ page }) => {
  for (const path of ["/login", "/giris"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/$/);
    const hasLoginForm = await page.locator('input[autocomplete="current-password"]').count();
    expect(hasLoginForm, `${path} must not show the login form to an unauthenticated visitor`).toBe(0);
  }
});

// /digital-center is a deliberate, documented exception: it is the real
// login page implementation (never renamed), kept reachable directly
// because password-reset/admin-setup flows already hardcode redirects to it
// after completing their own token-gated action. It carries noindex/nofollow
// and is not linked from any public nav/footer (see the other test above).
test("/digital-center itself stays functional for internal auth-flow redirects, but is noindexed and unlinked", async ({ page }) => {
  const response = await page.goto("/digital-center", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBeLessThan(400);
  const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robotsMeta).toContain("noindex");
});

test("private login path loads the real login screen", async ({ page }) => {
  test.skip(!PRIVATE_PATH, "PRIVATE_ADMIN_LOGIN_PATH not configured in this environment.");
  const response = await page.goto(`/${PRIVATE_PATH}`, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "HK OPERATING SYSTEM" })).toBeVisible();
});

test("successful QA admin login via the private path redirects to /hk-admin", async ({ page }) => {
  test.skip(!PRIVATE_PATH || !hasQaAdminCredentials(), PRIVATE_PATH ? qaSkipReason : "PRIVATE_ADMIN_LOGIN_PATH not configured in this environment.");
  await page.goto(`/${PRIVATE_PATH}`, { waitUntil: "domcontentloaded" });
  await page.fill('input[autocomplete="username"]', process.env.QA_ADMIN_EMAIL!);
  await page.fill('input[autocomplete="current-password"]', process.env.QA_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sisteme Giriş" }).click();
  await page.waitForURL("**/hk-admin**", { timeout: 15_000 });
});

test("unauthenticated request to a protected admin route is still blocked", async ({ request }) => {
  const response = await request.get("/api/admin/integration-settings");
  expect([401, 403]).toContain(response.status());
});

test("contact form requires the required fields before submitting", async ({ page }) => {
  await page.goto("/iletisim", { waitUntil: "domcontentloaded" });
  const nameInput = page.locator('input[name="name"]').first();
  await expect(nameInput).toHaveAttribute("required", "");
  const emailInput = page.locator('input[name="email"]').first();
  await expect(emailInput).toHaveAttribute("required", "");
});

test("mobile homepage has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
