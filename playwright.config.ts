import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// The Playwright test runner is a plain Node process — unlike `next dev`/
// `next start`, it never loads .env.local on its own. Use Next's own loader
// (already a dependency via `next`, no new package needed) so QA_ADMIN_EMAIL/
// QA_ADMIN_PASSWORD etc. in .env.local reach process.env here exactly the
// way the app itself would read them.
loadEnvConfig(process.cwd());

// Real Playwright infrastructure for HK Dijital (Final Development Sprint D).
// Runs against a locally-built production server (npm run start) unless
// PLAYWRIGHT_BASE_URL is supplied (e.g. to point at a real staging/production
// domain for smoke tests) — see tests/e2e/README or the sprint report for
// exact env vars.
const PORT = Number(process.env.PLAYWRIGHT_PORT || 4173);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  // Performs the suite's single real QA-admin login once, up front, and
  // saves it to tests/e2e/.auth/qa-admin.json — see tests/e2e/global-setup.ts
  // and tests/e2e/fixtures/qa-auth.ts for why (GoTrue sign-in rate limit).
  globalSetup: require.resolve("./tests/e2e/global-setup.ts"),
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Video recording engages this sandbox's software GPU compositor, which
    // has been observed to add tens of seconds to context teardown on this
    // specific macOS/ARM + headless-shell combination (harmless
    // "SharedImageManager::ProduceMemory" logging, not an app defect) —
    // screenshot + trace already cover failure debugging without it.
    video: "off",
    actionTimeout: 10_000,
    navigationTimeout: 15_000
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } }
  ],
  // Only auto-start a local server when no external baseURL is supplied —
  // never spin up a dev/production server against a real remote target.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run start -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 60_000
      }
});
