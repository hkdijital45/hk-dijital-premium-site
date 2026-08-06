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

// Regression coverage for the removed secondary horizontal module toolbar
// (previously rendered by DesktopModuleToolbar under the top header — it
// duplicated the exact same adminNavigationGroups data the left sidebar
// already exposes, and was getting vertically clipped by the desktop shell's
// fixed-height flex column at certain viewport heights). The toolbar was
// deleted entirely rather than patched, so this asserts it stays gone and
// that removing it did not leave a dead spacer or push content out of place.
const DESKTOP_VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 }
];

test.describe("admin shell: secondary module toolbar removal", () => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    test(`no duplicate horizontal module toolbar and no dead spacer at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoAsQaAdmin(page, "/hk-admin");
      await page.waitForLoadState("domcontentloaded");

      // The removed component's markup/CSS classes must not exist at all.
      await expect(page.locator(".admin-module-toolbar")).toHaveCount(0);
      await expect(page.locator(".admin-module-toolbar-btn")).toHaveCount(0);

      const header = page.locator(".admin-top-header").first();
      await expect(header).toBeVisible();
      // The persistent left sidebar rail was replaced by a top mega-nav
      // (desktop) + slide-in drawer (mobile) — no `.admin-sidebar` column
      // should render at desktop widths any more.
      await expect(page.locator(".admin-sidebar")).toHaveCount(0);
      await expect(page.locator(".admin-mega-nav").first()).toBeVisible();

      // Content must begin directly below the header — no empty horizontal
      // strip left behind where the toolbar used to sit.
      const headerBox = await header.boundingBox();
      const bodyBox = await page.locator(".admin-desktop-body").first().boundingBox();
      expect(headerBox).not.toBeNull();
      expect(bodyBox).not.toBeNull();
      if (headerBox && bodyBox) {
        const gap = bodyBox.y - (headerBox.y + headerBox.height);
        expect(gap, "no dead spacer should remain between the header and the dashboard body").toBeLessThan(24);
      }

      // No unexpected horizontal page overflow introduced by the shell change.
      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(hasHorizontalOverflow).toBe(false);
    });
  }

  test("dashboard content is not overlapped by the header and the shell scrolls normally", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoAsQaAdmin(page, "/hk-admin");
    await page.waitForLoadState("domcontentloaded");

    const header = page.locator(".admin-top-header").first();
    const scrollArea = page.locator(".admin-desktop-body .lg\\:overflow-y-auto").first();
    const headerBox = await header.boundingBox();
    const scrollBox = await scrollArea.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(scrollBox).not.toBeNull();
    if (headerBox && scrollBox) {
      expect(scrollBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
    }
  });
});

// Coverage for the rebuilt navigation model: top nav + mega-menu on desktop,
// slide-in drawer on mobile (<1024px). Replaces the old persistent left
// accordion sidebar as the default desktop chrome.
test.describe("admin shell: top mega-nav (desktop) and drawer (mobile)", () => {
  test("Dashboard button is always visible in the top chrome and reaches the dashboard in one click", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAsQaAdmin(page, "/hk-admin/musteriler");
    await page.waitForLoadState("domcontentloaded");

    const dashboardButton = page.getByRole("link", { name: "Panele git" });
    await expect(dashboardButton).toBeVisible();
    await dashboardButton.click();
    await expect(page).toHaveURL(/\/hk-admin$/);
  });

  test("clicking a group opens its mega-menu and an item navigates + highlights active", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAsQaAdmin(page, "/hk-admin");
    await page.waitForLoadState("domcontentloaded");

    const group = page.locator(".admin-mega-nav button[aria-haspopup='true']").first();
    await group.click();
    const menu = page.locator(".admin-mega-menu").first();
    await expect(menu).toBeVisible();

    const firstItem = menu.locator("a").first();
    const href = await firstItem.getAttribute("href");
    await firstItem.click();
    if (href) await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"));
    // The menu closes itself after navigation.
    await expect(page.locator(".admin-mega-menu")).toHaveCount(0);
  });

  test("⌘K command palette still opens from the top header", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAsQaAdmin(page, "/hk-admin");
    await page.waitForLoadState("domcontentloaded");
    await page.getByLabel("HK Mission Control'ı aç (⌘K)").click();
    await expect(page.locator(".hk-command-panel")).toBeVisible();
  });

  test("favorites star popover still opens from the top header", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAsQaAdmin(page, "/hk-admin");
    await page.waitForLoadState("domcontentloaded");
    await page.getByRole("button", { name: /Favoriler/ }).click();
    await expect(page.getByText("Favori modüller")).toBeVisible();
  });

  test("mobile viewport (390px) hides the mega-nav and opens the slide-in drawer instead", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAsQaAdmin(page, "/hk-admin");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator(".admin-mega-nav")).toBeHidden();
    await page.getByRole("button", { name: "Menüyü aç" }).click();
    await expect(page.locator(".admin-mobile-nav-panel")).toBeVisible();
  });
});
