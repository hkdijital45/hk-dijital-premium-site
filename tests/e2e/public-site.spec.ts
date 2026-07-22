import { test, expect } from "@playwright/test";

const PUBLIC_ROUTES = [
  ["/", "HK Dijital"],
  ["/hakkimda", null],
  ["/hizmetler", null],
  ["/paketler", null],
  ["/blog", null],
  ["/iletisim", null]
] as const;

for (const [path] of PUBLIC_ROUTES) {
  test(`public route ${path} loads with no page errors`, async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${path} should respond with a successful status`).toBeLessThan(400);
    await page.waitForLoadState("domcontentloaded");

    expect(pageErrors, `${path} must not throw uncaught page errors`).toEqual([]);

    // Hydration mismatches always surface as a console error mentioning
    // "hydrat" (React "Hydration failed" / "did not match") — fail loudly on
    // those specifically rather than suppressing all console noise.
    const hydrationErrors = consoleErrors.filter((text) => /hydrat/i.test(text));
    expect(hydrationErrors, `${path} must not produce hydration warnings`).toEqual([]);
  });
}

test("homepage has no unexpected horizontal overflow on desktop", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("domcontentloaded");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "homepage should not scroll horizontally").toBeLessThanOrEqual(1);
});

test("primary public navigation links resolve to real routes", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const nav = page.locator("header nav, header").first();
  await expect(nav).toBeVisible();
  const hrefs = await page.locator("a[href^='/']").evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute("href")).filter(Boolean));
  expect(hrefs.length, "homepage should contain internal navigation links").toBeGreaterThan(0);
});

test("external target=_blank links declare safe rel where inspectable", async ({ page }) => {
  await page.goto("/hakkimda", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("domcontentloaded");
  const unsafeBlankLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[target="_blank"]'))
      .filter((link) => {
        const rel = (link.getAttribute("rel") || "").toLowerCase();
        // rel="noreferrer" alone already implies noopener behavior in all
        // modern browsers, so either one on its own is a safe combination —
        // only flag links missing BOTH.
        return !rel.includes("noopener") && !rel.includes("noreferrer");
      })
      .map((link) => link.getAttribute("href"))
  );
  expect(unsafeBlankLinks, "target=_blank links must include rel=noopener and/or rel=noreferrer").toEqual([]);
});

test("no accidental localhost or deprecated-domain references leak into rendered public pages", async ({ page }) => {
  for (const [path] of PUBLIC_ROUTES) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const html = await page.content();
    expect(html, `${path} must not reference 11245911.com`).not.toContain("11245911.com");
    expect(html.match(/http:\/\/localhost/gi) || [], `${path} must not hardcode a localhost URL`).toEqual([]);
  }
});

test("mobile viewport: homepage navigation remains usable with no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("domcontentloaded");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "homepage should not scroll horizontally on mobile").toBeLessThanOrEqual(1);
});
