import { test, expect } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, loginAsQaAdmin, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";
import { watchForHydrationErrors } from "./fixtures/hydration";

// Regression coverage for a real production-only hydration bug: formatDate/
// formatDateTime (and DashboardRecentActivity's own copy) called
// toLocaleDateString/toLocaleString with no explicit timeZone, so the
// formatted text depended on the server process's local zone. On Vercel
// that's UTC; a real viewer's browser is (overwhelmingly) Europe/Istanbul —
// same Date, two different strings, a React #418 hydration mismatch on
// every server-rendered date/time these paths touch. This never reproduced
// in local dev/prod-build runs because a local server and a local browser
// share one machine's timezone — only a real cross-timezone split (or the
// TZ=UTC simulation used to verify the fix) exposes it. See
// src/components/admin/AdminDashboard.tsx's formatDate/formatDateTime and
// src/components/admin/dashboard/DashboardRecentActivity.tsx.
//
// Public, unauthenticated routes are also checked here (not just
// /hk-admin/*) since a hydration mismatch is a rendering-pipeline defect,
// not an admin-only concern — the timezone bug above happened to be
// admin-only, but this suite shouldn't assume the next one will be.

test.describe("hydration mismatch regression — public routes", () => {
  const PUBLIC_ROUTES = ["/", "/login"];

  for (const path of PUBLIC_ROUTES) {
    for (const reducedMotion of [false, true] as const) {
      test(`${path} has no hydration mismatch (reduced motion: ${reducedMotion})`, async ({ page }) => {
        if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
        const hydration = watchForHydrationErrors(page);
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);
        expect(hydration.getHydrationErrors(), `${path} (reduced motion: ${reducedMotion})`).toEqual([]);
      });
    }
  }
});

test.describe("hydration mismatch regression — admin routes", () => {
  test.use({ storageState: qaAdminStorageState });
  test.beforeEach(() => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
  });

  test("admin dashboard, leads, Müşteri Keşfi and a customer onboarding tab have no hydration mismatch (cold x5 each)", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const companiesRes = await request.get("/api/admin/companies");
    const companiesBody = await companiesRes.json().catch(() => ({}));
    const companyId = companiesBody.companies?.[0]?.id;

    const routes = [
      "/hk-admin",
      "/hk-admin/leads",
      "/hk-admin/musteri-kesfi",
      companyId ? `/hk-admin/musteriler?companyId=${companyId}&tab=Onboarding` : null
    ].filter((path): path is string => Boolean(path));

    for (const path of routes) {
      for (let i = 0; i < 5; i++) {
        const hydration = watchForHydrationErrors(page);
        await gotoAsQaAdmin(page, path);
        await page.waitForTimeout(1200);
        expect(hydration.getHydrationErrors(), `${path} (cold load ${i + 1}/5)`).toEqual([]);
        hydration.reset();
      }
    }
  });

  test("admin dashboard has no hydration mismatch under prefers-reduced-motion", async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await loginAsQaAdmin(request);
    const hydration = watchForHydrationErrors(page);
    await gotoAsQaAdmin(page, "/hk-admin");
    await page.waitForTimeout(1200);
    expect(hydration.getHydrationErrors()).toEqual([]);
  });
});
