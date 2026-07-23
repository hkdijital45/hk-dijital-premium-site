import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 }
];

const ROUTES = ["/", "/hakkimda", "/hizmetler", "/paketler", "/iletisim"];

for (const viewport of VIEWPORTS) {
  for (const path of ROUTES) {
    test(`${viewport.name} (${viewport.width}px): ${path} has no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("domcontentloaded");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} at ${viewport.width}px must not overflow horizontally`).toBeLessThanOrEqual(1);
    });
  }
}

test("mobile: contact page long content and forms remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/iletisim", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("domcontentloaded");
  const forms = page.locator("form");
  const formCount = await forms.count();
  if (formCount > 0) {
    const firstInput = forms.first().locator("input, textarea").first();
    await expect(firstInput).toBeVisible();
    const box = await firstInput.boundingBox();
    expect(box?.width, "form input should fit within the mobile viewport").toBeLessThanOrEqual(390);
  }
});

test("desktop: login form dialog stays within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // /giris and /login now intentionally redirect unauthenticated visitors to
  // the homepage (private admin login consolidation) — /digital-center is
  // the real, still-reachable login page implementation.
  await page.goto("/digital-center", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("domcontentloaded");
  const identityInput = page.locator('input[type="text"]').first();
  await expect(identityInput).toBeVisible();
  const box = await identityInput.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1440);
  }
});
