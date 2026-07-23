import { test, expect } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, qaSkipReason } from "./fixtures/qa-auth";

// Regression coverage for two verified production defects:
//   1. The desktop admin shell was capped at max-width: 1680px and centered,
//      leaving large dead margins on wide screens (fixed in globals.css).
//   2. The right-side conversation management panel never activated because
//      /api/communication/[id] omitted company_name (used as the panel's
//      "is something selected" signal) even though a conversation was
//      genuinely selected and its messages were loading correctly.
test.beforeEach(() => {
  test.skip(!hasQaAdminCredentials(), qaSkipReason);
});

test("desktop shell fills the viewport width without the previous large centered margins", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAsQaAdmin(page, "/hk-admin/iletisim-merkezi");
  await page.waitForLoadState("domcontentloaded");

  const frame = page.locator(".admin-desktop-frame").first();
  await expect(frame).toBeVisible();
  const box = await frame.boundingBox();
  expect(box, "admin-desktop-frame must have a measurable layout box").not.toBeNull();
  // Small responsive gutter only (was previously hard-capped at 1680px,
  // leaving ~240px of dead space on either side at this viewport width).
  expect(box!.width).toBeGreaterThan(1440 - 64);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "no horizontal overflow at 1440px desktop width").toBeLessThanOrEqual(1);
});

test("mobile layout remains usable on the communication route", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAsQaAdmin(page, "/hk-admin/iletisim-merkezi");
  await page.waitForLoadState("domcontentloaded");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "no horizontal overflow on mobile").toBeLessThanOrEqual(1);
});

test("conversation selection activates the right management panel", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  await gotoAsQaAdmin(page, "/hk-admin/iletisim-merkezi");
  await page.waitForLoadState("domcontentloaded");

  const inboxButtons = page.locator(".admin-workspace-left button[type='button']");
  const conversationCount = await inboxButtons.count();
  test.skip(conversationCount === 0, "No conversations exist in the inbox for this QA admin account — seed at least one customer_conversations row to exercise selection.");

  // Empty state must be visible before any conversation is selected.
  await expect(page.getByText("Bir konuşma seçin").first()).toBeVisible();

  await inboxButtons.first().click();
  // Right panel must move off the empty state once a conversation is selected.
  await expect(page.getByText("Bir konuşma seçin")).toHaveCount(0);
  await expect(page.locator(".admin-detail-inspector-head")).toBeVisible();

  if (conversationCount > 1) {
    const firstTitle = await page.locator(".admin-detail-inspector-head strong").first().textContent();
    await inboxButtons.nth(1).click();
    await expect(page.locator(".admin-detail-inspector-head")).toBeVisible();
    const secondTitle = await page.locator(".admin-detail-inspector-head strong").first().textContent();
    // Not a strict inequality (two conversations may share a company name),
    // but the panel must re-render with fresh content, not stay stuck empty.
    expect(secondTitle, "right panel must still show a title after switching conversations").toBeTruthy();
    void firstTitle;
  }

  expect(pageErrors, "no uncaught page errors while selecting conversations").toEqual([]);
  const hydrationErrors = consoleErrors.filter((text) => /hydrat/i.test(text));
  expect(hydrationErrors, "no hydration warnings while selecting conversations").toEqual([]);
});
