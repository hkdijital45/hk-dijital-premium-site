import { test, expect } from "@playwright/test";
import { hasQaAdminCredentials, loginAsQaAdmin, qaSkipReason } from "./fixtures/qa-auth";

// Coverage for the Müşteri Keşfi / Google Maps Müşteri Bulma sales-
// intelligence upgrade. Every test that creates a real lead deletes it
// again in the same test (immediate cleanup, not a separate afterAll),
// so no QA byproduct data survives a run regardless of pass/fail ordering.

const KNOWN_AD_STATUSES = ["active_signal", "no_signal_detected", "unverified", "manual_check_required", "source_unavailable"];

test("unauthenticated search request is rejected", async ({ request }) => {
  const response = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", sector: "Güzellik Merkezi" } });
  expect([401, 403]).toContain(response.status());
});

test.describe("authenticated discovery search", () => {
  test.beforeEach(() => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
  });

  test("sector is required independently of keyword — keyword alone does not satisfy validation", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "", sector: "", keyword: "protez tırnak" } });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/[Ss]ektör/);
  });

  test("city is required", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/admin/business-discovery", { data: { city: "", sector: "Güzellik Merkezi" } });
    expect(response.status()).toBe(400);
  });

  test("city-wide search (no ilçe, no mahalle) is accepted and never silently substitutes a district", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "", neighborhood: "", sector: "Güzellik Merkezi", limit: "5" } });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.districtLabel).toBe("Tüm ilçeler");
  });

  test("a specified ilçe is reflected as-is, not replaced", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "Yunusemre", neighborhood: "", sector: "Nail Studio", limit: "5" } });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.districtLabel).toBe("Yunusemre");
  });

  test("results are ordered by HK Opportunity Score descending by default", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "Şehzadeler", neighborhood: "", sector: "Protez Tırnak", limit: "10" } });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const scores = (body.businesses || []).map((b: any) => Number(b.opportunityScore ?? 0));
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  test("advertising status is always one of the honest known values — never a fabricated status", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "", sector: "Kuaför", limit: "10" } });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    for (const business of body.businesses || []) {
      expect(KNOWN_AD_STATUSES).toContain(business.metaAdsStatus);
      expect(KNOWN_AD_STATUSES).toContain(business.googleAdsStatus);
    }
  });

  test("API failure is distinguished from a legitimate zero-result search: a failure always carries an explicit warning", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "", sector: "Su Arıtma", limit: "5" } });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    if (body.isDemoFallback) {
      expect(typeof body.warning).toBe("string");
      expect(body.warning.length).toBeGreaterThan(0);
    } else {
      expect(body.warning).toBeFalsy();
    }
  });

  test("CRM save persists the lead, and saving the same place a second time is skipped as a duplicate (no double lead)", async ({ request }) => {
    await loginAsQaAdmin(request);
    const searchResponse = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "", sector: "QA E2E Discovery Sector", limit: "3" } });
    const searchBody = await searchResponse.json();
    const candidate = searchBody.businesses?.[0];
    test.skip(!candidate, "Discovery search returned no candidate business to save.");
    candidate.name = `QA E2E Discovery Lead ${Date.now()}`;
    candidate.phone = "0500000000";

    let leadId: string | undefined;
    try {
      const saveResponse = await request.put("/api/admin/business-discovery", { data: { businesses: [candidate], sector: "QA E2E Discovery Sector", city: "Manisa", district: "" } });
      expect(saveResponse.ok()).toBeTruthy();
      const saveBody = await saveResponse.json();
      expect(saveBody.count).toBe(1);
      leadId = saveBody.leads?.[0]?.id;
      expect(leadId).toBeTruthy();

      const dupResponse = await request.put("/api/admin/business-discovery", { data: { businesses: [candidate], sector: "QA E2E Discovery Sector", city: "Manisa", district: "" } });
      expect(dupResponse.ok()).toBeTruthy();
      const dupBody = await dupResponse.json();
      expect(dupBody.count).toBe(0);
      expect(dupBody.skipped).toBe(1);
      expect(dupBody.duplicates?.[0]?.existingLeadId).toBe(leadId);
    } finally {
      if (leadId) await request.delete(`/api/admin/leads/${leadId}`);
    }
  });

  test("manual ad-status verification either persists with an honest evidence trail or reports why it could not", async ({ request }) => {
    await loginAsQaAdmin(request);
    const searchResponse = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "", sector: "QA E2E Verification Sector", limit: "3" } });
    const searchBody = await searchResponse.json();
    const candidate = searchBody.businesses?.[0];
    test.skip(!candidate, "Discovery search returned no candidate business to save.");
    candidate.name = `QA E2E Verification Lead ${Date.now()}`;
    candidate.phone = "0500000001";

    let leadId: string | undefined;
    try {
      const saveResponse = await request.put("/api/admin/business-discovery", { data: { businesses: [candidate], sector: "QA E2E Verification Sector", city: "Manisa", district: "" } });
      const saveBody = await saveResponse.json();
      leadId = saveBody.leads?.[0]?.id;
      test.skip(!leadId, "Lead was not created (unexpected save failure) — nothing to verify.");

      const verifyResponse = await request.patch(`/api/admin/leads/${leadId}`, { data: { manualAdVerification: { channel: "meta", status: "active", source: "QA E2E test" } } });
      expect(verifyResponse.ok()).toBeTruthy();
      const verifyBody = await verifyResponse.json();
      // Either the migration is applied and the verification is genuinely
      // persisted, or it isn't and the response must say so explicitly —
      // never a silent no-op reported as success.
      const persisted = verifyBody.lead?.meta_ads_verified_status === "active";
      const honestlyDisclosed = typeof verifyBody.warning === "string" && verifyBody.warning.length > 0;
      expect(persisted || honestlyDisclosed).toBeTruthy();
    } finally {
      if (leadId) await request.delete(`/api/admin/leads/${leadId}`);
    }
  });
});
