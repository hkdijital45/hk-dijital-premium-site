import { test, expect } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";

// Regression coverage for this task's additions to HK AI Workforce:
// real ready-made workflow playbooks (Control Center), the HK Admin nav
// shortcut, and the new System Guide entry + deep link. These check real
// client-side validation and navigation — they never trigger a real
// (billed) AI provider run.
test.use({ storageState: qaAdminStorageState });

test.beforeEach(() => {
  test.skip(!hasQaAdminCredentials(), qaSkipReason);
});

test("HK Admin nav: İçerik ve AI > Yapay Zekâ Merkezi includes a same-origin AI Workforce link", async ({ page }) => {
  await gotoAsQaAdmin(page, "/hk-admin");
  await page.waitForLoadState("domcontentloaded");

  // Desktop shows the mega-nav directly; mobile (<1024px) hides it behind
  // the "Menüyü aç" slide-in drawer (see admin-shell.spec.ts) — open that
  // first if present so this one test covers both layouts.
  const mobileMenuButton = page.getByRole("button", { name: "Menüyü aç" });
  if (await mobileMenuButton.count()) await mobileMenuButton.click();

  // Desktop keeps its own (CSS-hidden, not DOM-removed) mega-nav trigger
  // mounted even while the mobile drawer is open, so ":visible" is required
  // — otherwise .first() can resolve to the hidden desktop button instead.
  const trigger = page.locator('button:has-text("İçerik ve AI"):visible').first();
  const hasTrigger = await trigger.count();
  test.skip(hasTrigger === 0, "QA admin account does not have an İçerik ve AI nav group visible in this environment.");
  await trigger.click();

  const link = page.locator('a:has-text("AI Workforce"):visible').first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/ai-workforce");
});

test("AI Workforce Control Center: a customer-scoped playbook refuses to run without a customer selected (no AI call made)", async ({ page }) => {
  await gotoAsQaAdmin(page, "/ai-workforce");
  await page.waitForLoadState("domcontentloaded");

  const playbookCard = page.locator("text=Müşteri 30 Günlük Performans Değerlendirmesi").first();
  // Client-rendered React content — "domcontentloaded" fires before
  // hydration/the first data fetch resolves. Locator.isVisible() checks the
  // CURRENT state only and never waits/retries (unlike expect(...).toBeVisible()),
  // so it must be driven through a retrying wait here instead.
  const hasCard = await playbookCard.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
  test.skip(!hasCard, "QA admin account does not have ai-workforce module access in this environment, or the page redirected.");

  const startButton = playbookCard.locator("xpath=ancestor::div[contains(@class,'rounded-[12px]')][1]").getByRole("button", { name: "Başlat" });
  await startButton.click();

  await expect(page.locator("text=Bu iş akışı için önce yukarıdan bir müşteri seçin.")).toBeVisible();
});

test("System Guide: the new AI Workforce guide is reachable via the ?topic= deep link used from inside AI Workforce", async ({ page }) => {
  await gotoAsQaAdmin(page, "/hk-admin/sistem-rehberi?topic=ai-workforce-rehberi");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800);

  await expect(page.locator("h2", { hasText: "AI Workforce Nasıl Kullanılır?" })).toBeVisible();
});
