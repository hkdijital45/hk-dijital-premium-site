import { test, expect } from "@playwright/test";

// Customer isolation (one customer cannot read another customer's document/
// report) requires two real, dedicated test-customer accounts plus a known
// cross-account resource ID in a non-production Supabase environment — none
// of that exists in this environment, and Sprint D's instructions explicitly
// forbid running destructive/cross-customer probes against unknown
// production data. These tests skip clearly rather than faking a result;
// they run automatically once the required environment variables are
// supplied against a real dedicated test environment.
const CUSTOMER_A_EMAIL = process.env.QA_CUSTOMER_A_EMAIL;
const CUSTOMER_A_PASSWORD = process.env.QA_CUSTOMER_A_PASSWORD;
const CUSTOMER_B_DOCUMENT_ID = process.env.QA_CUSTOMER_B_DOCUMENT_ID;
const CUSTOMER_B_REPORT_ID = process.env.QA_CUSTOMER_B_REPORT_ID;

const hasIsolationFixtures = Boolean(CUSTOMER_A_EMAIL && CUSTOMER_A_PASSWORD && (CUSTOMER_B_DOCUMENT_ID || CUSTOMER_B_REPORT_ID));
const skipReason =
  "QA_CUSTOMER_A_EMAIL/PASSWORD and a known cross-account QA_CUSTOMER_B_DOCUMENT_ID/QA_CUSTOMER_B_REPORT_ID are required " +
  "(a dedicated non-production test environment with two seeded test customers) — not available in this environment.";

test.describe("customer data isolation", () => {
  test.beforeEach(() => {
    test.skip(!hasIsolationFixtures, skipReason);
  });

  test("customer A cannot open customer B's document", async ({ request }) => {
    await request.post("/api/auth/login", { data: { identity: CUSTOMER_A_EMAIL, password: CUSTOMER_A_PASSWORD, userType: "customer" } });
    const response = await request.get(`/api/customer/files/${CUSTOMER_B_DOCUMENT_ID}`);
    expect([403, 404]).toContain(response.status());
  });

  test("customer A cannot export customer B's report", async ({ request }) => {
    await request.post("/api/auth/login", { data: { identity: CUSTOMER_A_EMAIL, password: CUSTOMER_A_PASSWORD, userType: "customer" } });
    const response = await request.get(`/api/customer/reports/${CUSTOMER_B_REPORT_ID}/export?format=pdf`);
    expect([403, 404]).toContain(response.status());
  });
});

test("admin-only endpoint rejects an unauthenticated (non-admin) session", async ({ request }) => {
  const response = await request.get("/api/admin/integration-settings");
  expect(response.status()).toBe(401);
});
