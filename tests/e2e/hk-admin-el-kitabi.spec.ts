import { test, expect } from "@playwright/test";
import { qaAdminStorageState, hasQaAdminCredentials, qaSkipReason } from "./fixtures/qa-auth";

// Coverage for the HK Admin El Kitabı (handbook) integration inside Sistem
// Rehberi — SystemGuideCenter.tsx's "HK Admin El Kitabı" card, the native
// HandbookReader.tsx overlay, and the authenticated content/PDF/screenshot
// API routes under /api/admin/system-guide/el-kitabi.

test.describe("HK Admin El Kitabı", () => {
  test.skip(!hasQaAdminCredentials(), qaSkipReason);
  test.use({ storageState: qaAdminStorageState });

  test("desktop: card opens the native reader, chapters render, PDF downloads", async ({ page }) => {
    // PDF generation embeds 7 real screenshots + a two-pass page-numbered
    // TOC layout — measured at up to ~18-20s on a serverless deploy (cached
    // per warm instance after the first request, see pdf/route.ts), well
    // past the suite's default per-action/request timeouts.
    test.setTimeout(60000);
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/hk-admin/sistem-rehberi", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "HK Admin El Kitabı" })).toBeVisible();

    await page.getByRole("button", { name: /El Kitabını Aç/i }).click();
    const reader = page.locator(".fixed.z-\\[120\\]");
    await expect(reader.getByRole("heading", { name: "HK Admin El Kitabı" })).toBeVisible();
    // At least the front matter + first real chapter must render as real
    // sanitized content, not an error/empty state.
    await expect(reader.getByText("El kitabı yüklenemedi")).toHaveCount(0);
    await expect(reader.locator(".hk-handbook-body")).not.toBeEmpty();
    // Regression coverage for a real bug found on production: the edition
    // date regex used \w+ for the month token, which doesn't match Turkish
    // letters (the 'ü' in "Eylül") without the /u flag — it silently failed
    // and fell through to a file-mtime fallback that showed a nonsensical
    // 2018 date instead of the handbook's real "13 Eylül 2026".
    await expect(reader.getByText(/Birinci baskı · \d{1,2} \S+ 2026/).first()).toBeVisible();

    // The overlay must be fully opaque — no background page bleeding
    // through (regression coverage for the shared `.fixed.inset-0` global
    // backdrop-scrim rule in globals.css, which this reader deliberately
    // avoids matching).
    const bg = await reader.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg.startsWith("rgba") && bg.endsWith("0.78)")).toBe(false);

    const downloadPromise = page.waitForEvent("download", { timeout: 45000 });
    await reader.getByRole("button", { name: /PDF İndir/i }).click();
    await expect(reader.getByRole("button", { name: /Hazırlanıyor/i })).toBeVisible();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("HK-Admin-El-Kitabi.pdf");

    expect(consoleErrors, "handbook reader must render with 0 console errors").toEqual([]);
  });

  test("mobile: card and reader are usable with no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/hk-admin/sistem-rehberi", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /El Kitabını Aç/i }).click();
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("PDF route returns a real PDF binary", async ({ page }) => {
    test.setTimeout(60000);
    const response = await page.request.get("/api/admin/system-guide/el-kitabi/pdf", { timeout: 45000 });
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    const body = await response.body();
    expect(body.slice(0, 4).toString("latin1")).toBe("%PDF");
  });
});

test("unauthenticated requests to the handbook API are rejected", async ({ request }) => {
  const contentResponse = await request.get("/api/admin/system-guide/el-kitabi");
  expect(contentResponse.status()).toBe(403);
  const pdfResponse = await request.get("/api/admin/system-guide/el-kitabi/pdf");
  expect(pdfResponse.status()).toBe(403);
});
