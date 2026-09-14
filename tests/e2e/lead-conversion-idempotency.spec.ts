import { test, expect } from "@playwright/test";
import { hasQaAdminCredentials, loginAsQaAdmin, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";

// Regression coverage for the /api/admin/customers/onboarding lead→customer
// conversion path (used by the "Onboarding" nav item / OnboardingCenter,
// distinct from the CRM Lead Drawer's /api/admin/leads/[id]/convert). Before
// this fix, calling it twice for the same lead — a real risk since its own
// lead list never hides already-converted leads — silently created a second
// duplicate company and a second duplicate customer login for one business.
// Any real lead/company/user created here is deleted again in this same
// test regardless of outcome, so no QA byproduct data survives a run.

test.describe("lead → customer conversion is idempotent (POST /api/admin/customers/onboarding)", () => {
  test.use({ storageState: qaAdminStorageState });
  test.beforeEach(() => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
  });

  test("converting the same lead twice reuses the same company and customer account instead of duplicating them", async ({ request }) => {
    await loginAsQaAdmin(request);
    const uniqueName = `QA E2E Onboarding Idempotency ${Date.now()}`;

    const searchResponse = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "", sector: "QA E2E Onboarding Idempotency Sector", limit: "3" } });
    const searchBody = await searchResponse.json();
    const candidate = searchBody.businesses?.[0];
    test.skip(!candidate, "Discovery search returned no candidate business to save (likely no valid GOOGLE_MAPS_API_KEY in this environment).");
    candidate.name = uniqueName;
    candidate.phone = "0500000098";

    let leadId: string | undefined;
    let companyId: string | undefined;
    try {
      const saveResponse = await request.put("/api/admin/business-discovery", { data: { businesses: [candidate], sector: "QA E2E Onboarding Idempotency Sector", city: "Manisa", district: "" } });
      const saveBody = await saveResponse.json();
      leadId = saveBody.leads?.[0]?.id;
      test.skip(!leadId, "Lead was not created (unexpected save failure) — nothing to convert.");

      const firstConvert = await request.post("/api/admin/customers/onboarding", { data: { leadId } });
      expect(firstConvert.ok(), await firstConvert.text()).toBeTruthy();
      const firstBody = await firstConvert.json();
      companyId = firstBody.company?.id;
      const firstUserId = firstBody.user?.id;
      expect(companyId).toBeTruthy();
      expect(firstUserId).toBeTruthy();

      const secondConvert = await request.post("/api/admin/customers/onboarding", { data: { leadId } });
      expect(secondConvert.ok(), await secondConvert.text()).toBeTruthy();
      const secondBody = await secondConvert.json();

      // Same company reused, not a second one created for the same lead.
      expect(secondBody.company?.id).toBe(companyId);
      // Same customer login reused, not a second account left behind.
      expect(secondBody.user?.id).toBe(firstUserId);
    } finally {
      if (companyId) await request.delete(`/api/admin/companies/${companyId}`, { data: { confirmationName: uniqueName } });
      if (leadId) await request.delete(`/api/admin/leads/${leadId}`);
    }
  });
});
