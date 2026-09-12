import { test, expect } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";

test.use({ storageState: qaAdminStorageState });

// Regression coverage for a real bug found during HK Lead Intelligence V2
// E2E verification: the "Ajan Kurulu ile Derin Analiz" trigger button used
// to live inside a <details> that only auto-opened once a council result
// already existed (`open={Boolean(council)}`), so on a lead's very first
// visit — exactly when a user would want to discover the feature — the
// button was hidden behind an unlabeled disclosure toggle with no visual
// cue it held a powerful new action. Fixed by keeping that section always
// open. This test only ever runs the cheapest tier (Level 1, one AI call)
// and never clicks the actual Ajan Kurulu button — it only asserts the
// trigger is immediately visible, since exercising the real 6-call flow is
// covered separately and is too expensive to run on every regression pass.
test("Ajan Kurulu ile Derin Analiz button is immediately visible without expanding any hidden section", async ({ page, request }) => {
  test.skip(!hasQaAdminCredentials(), qaSkipReason);

  const businessName = `QA TEST — Görünürlük Regresyonu ${Date.now()}`;
  const created = await request.post("/api/admin/leads/from-analysis", {
    data: {
      businessName,
      source: "Sosyal İstihbarat Merkezi",
      sector: "Kuaför",
      city: "Manisa",
      district: "Yunusemre",
      is_test: true
    }
  });
  test.skip(!created.ok(), "Could not create the throwaway QA test lead (from-analysis route rejected the request) — skipping rather than failing on unrelated setup infrastructure.");
  const leadId: string | undefined = (await created.json()).lead?.id;
  test.skip(!leadId, "from-analysis did not return a lead id.");

  try {
    await gotoAsQaAdmin(page, "/hk-admin/satis-hunisi");
    await page.getByLabel("Arama").fill(businessName);
    await page.getByRole("button", { name: "Filtrele" }).click();
    await page.getByText(businessName).first().click();
    await expect(page.getByText("Müşteri İstihbarat Motoru")).toBeVisible({ timeout: 10000 });

    const level1ResponsePromise = page.waitForResponse((res) => res.url().includes("/api/admin/lead-intelligence") && res.request().method() === "POST", { timeout: 30000 });
    await page.getByRole("button", { name: /^Analiz Et$/ }).click();
    await level1ResponsePromise;

    // The real regression: this must be visible right now, with zero extra
    // clicks to expand a collapsed section first.
    await expect(page.getByRole("button", { name: "Ajan Kurulu ile Derin Analiz" })).toBeVisible({ timeout: 10000 });
  } finally {
    const me = await request.get("/api/auth/me").then((res) => res.json()).catch(() => null);
    if (me?.role === "admin" || me?.user?.role === "admin") {
      await request.delete(`/api/admin/leads/${leadId}`).catch(() => null);
    }
  }
});
