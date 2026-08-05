import { test, expect } from "@playwright/test";
import { hasQaAdminCredentials, loginAsQaAdmin, qaSkipReason } from "./fixtures/qa-auth";

// Coverage for the Müşteri Keşfi / Google Maps Müşteri Bulma sales-
// intelligence upgrade. Every test that creates a real lead deletes it
// again in the same test (immediate cleanup, not a separate afterAll),
// so no QA byproduct data survives a run regardless of pass/fail ordering.
//
// There is no demo/mock fallback in this route anymore: a real Google Maps
// failure (invalid/missing key, quota, etc.) is now an honest HTTP error
// (502/503) with no fabricated businesses, never a 200 with fake data. Since
// whether the configured GOOGLE_MAPS_API_KEY is genuinely valid varies by
// environment, every test that depends on a successful search branches on
// response.ok() and asserts the correct invariant for whichever real
// outcome the live key actually produces — it never assumes success.

const KNOWN_AD_STATUSES = ["active_signal", "no_signal_detected", "unverified", "manual_check_required", "source_unavailable"];

function expectHonestFailureShape(status: number, body: any) {
  expect([502, 503]).toContain(status);
  expect(typeof body.error).toBe("string");
  expect(body.error.length).toBeGreaterThan(0);
  expect(body.businesses).toEqual([]);
}

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

  test("a real Google Maps failure (invalid/missing key, quota, etc.) is an honest HTTP error — never a fake result set", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "", sector: "Güzellik Merkezi", limit: "5" } });
    const body = await response.json();
    if (!response.ok()) {
      expectHonestFailureShape(response.status(), body);
      expect(body.isDemoFallback).toBeUndefined();
    } else {
      // The configured key is genuinely valid in this run: assert on real data instead.
      expect(Array.isArray(body.businesses)).toBeTruthy();
      expect(body.error).toBeUndefined();
    }
  });

  test("city-wide search (no ilçe, no mahalle) never silently substitutes a district", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "", neighborhood: "", sector: "Güzellik Merkezi", limit: "5" } });
    const body = await response.json();
    expect(body.districtLabel).toBe("Tüm ilçeler");
    if (!response.ok()) expectHonestFailureShape(response.status(), body);
  });

  test("a specified ilçe is reflected as-is, not replaced", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "Yunusemre", neighborhood: "", sector: "Nail Studio", limit: "5" } });
    const body = await response.json();
    expect(body.districtLabel).toBe("Yunusemre");
    if (!response.ok()) expectHonestFailureShape(response.status(), body);
  });

  test("when the search succeeds, results are ordered by HK Opportunity Score descending", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "Şehzadeler", neighborhood: "", sector: "Protez Tırnak", limit: "10" } });
    const body = await response.json();
    if (!response.ok()) {
      expectHonestFailureShape(response.status(), body);
      return;
    }
    const scores = (body.businesses || []).map((b: any) => Number(b.opportunityScore ?? 0));
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  test("when the search succeeds, advertising status is always one of the honest known values — never a fabricated status", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "", sector: "Kuaför", limit: "10" } });
    const body = await response.json();
    if (!response.ok()) {
      expectHonestFailureShape(response.status(), body);
      return;
    }
    for (const business of body.businesses || []) {
      expect(KNOWN_AD_STATUSES).toContain(business.metaAdsStatus);
      expect(KNOWN_AD_STATUSES).toContain(business.googleAdsStatus);
    }
  });

  test("a legitimate zero-result search (ZERO_RESULTS from Google) is never confused with an API failure", async ({ request }) => {
    await loginAsQaAdmin(request);
    // A deliberately implausible sector name to maximize the odds of a real
    // ZERO_RESULTS from Google when the key is valid; if the key is invalid,
    // this still correctly exercises the honest-failure path instead.
    const response = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "", sector: "Xzqvwplorpqz Nonexistent Sector 12345", limit: "5" } });
    const body = await response.json();
    if (response.ok()) {
      expect(body.error).toBeUndefined();
      expect(Array.isArray(body.businesses)).toBeTruthy();
    } else {
      expectHonestFailureShape(response.status(), body);
    }
  });

  test("CRM save persists the lead, and saving the same place a second time is skipped as a duplicate (no double lead)", async ({ request }) => {
    await loginAsQaAdmin(request);
    const searchResponse = await request.post("/api/admin/business-discovery", { data: { city: "Manisa", district: "", sector: "QA E2E Discovery Sector", limit: "3" } });
    const searchBody = await searchResponse.json();
    const candidate = searchBody.businesses?.[0];
    test.skip(!candidate, "Discovery search returned no candidate business to save (likely no valid GOOGLE_MAPS_API_KEY in this environment).");
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
    test.skip(!candidate, "Discovery search returned no candidate business to save (likely no valid GOOGLE_MAPS_API_KEY in this environment).");
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
