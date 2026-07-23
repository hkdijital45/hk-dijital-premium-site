import { test, expect } from "@playwright/test";
import { hasQaAdminCredentials, loginAsQaAdmin, qaSkipReason } from "./fixtures/qa-auth";

// Regression coverage for the permanent-delete fix:
//   - /api/admin/companies/[id] DELETE used to only PATCH status="Silindi"
//     (never actually removed the row) despite the UI calling it "Kalıcı Sil".
//   - /api/admin/leads/[id] DELETE used to only PATCH deleted_at (archive),
//     while the UI claimed the lead was "tamamen silinir" (fully removed).
// Both now perform a real DELETE. These tests exercise the parts that don't
// require a dedicated seeded test record (auth/validation), and the
// data-dependent scenarios (dependent-record cleanup, bulk delete, archived
// cleanup) run only when a real archived test customer / test lead id is
// supplied, since destructively deleting an unknown production record is
// out of scope for this environment.
const RANDOM_UUID = "00000000-0000-0000-0000-000000000000";
const QA_ARCHIVED_COMPANY_ID = process.env.QA_ARCHIVED_COMPANY_ID;
const QA_ARCHIVED_COMPANY_NAME = process.env.QA_ARCHIVED_COMPANY_NAME;
const QA_TEST_LEAD_ID = process.env.QA_TEST_LEAD_ID;

test("unauthenticated request to permanently delete a customer is rejected", async ({ request }) => {
  const response = await request.delete(`/api/admin/companies/${RANDOM_UUID}`, { data: { confirmationName: "x" } });
  expect([401, 403]).toContain(response.status());
});

test("unauthenticated request to permanently delete a lead is rejected", async ({ request }) => {
  const response = await request.delete(`/api/admin/leads/${RANDOM_UUID}`);
  expect([401, 403]).toContain(response.status());
});

test("unauthenticated request to the bulk data-management endpoint is rejected", async ({ request }) => {
  const response = await request.post("/api/admin/data-management", { data: { resource: "lead", scope: "all" } });
  expect([401, 403]).toContain(response.status());
});

test.describe("authenticated admin validation", () => {
  test.beforeEach(() => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
  });

  test("deleting a non-existent customer returns a clear error, not a false success", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.delete(`/api/admin/companies/${RANDOM_UUID}`, { data: { confirmationName: "Mevcut Olmayan Firma" } });
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test("deleting a non-existent lead returns a clear error, not a false success", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.delete(`/api/admin/leads/${RANDOM_UUID}`);
    expect(response.status()).toBe(404);
  });

  test("bulk permanent delete without the typed confirmation phrase is rejected before touching data", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.post("/api/admin/data-management", { data: { resource: "customer", scope: "archived_all" } });
    expect(response.status()).toBe(400);
  });

  test("single customer permanent delete requires the exact company name to be typed", async ({ request }) => {
    test.skip(!QA_ARCHIVED_COMPANY_ID, "QA_ARCHIVED_COMPANY_ID (a real, already-archived, disposable test company) not supplied in this environment.");
    await loginAsQaAdmin(request);
    const response = await request.delete(`/api/admin/companies/${QA_ARCHIVED_COMPANY_ID}`, { data: { confirmationName: "yanlis-isim" } });
    expect(response.status()).toBe(400);
  });

  test("archived customer is permanently deleted and does not reappear after refresh", async ({ request }) => {
    test.skip(!QA_ARCHIVED_COMPANY_ID || !QA_ARCHIVED_COMPANY_NAME, "QA_ARCHIVED_COMPANY_ID and QA_ARCHIVED_COMPANY_NAME (a real, already-archived, disposable test company) not supplied in this environment.");
    await loginAsQaAdmin(request);
    const response = await request.delete(`/api/admin/companies/${QA_ARCHIVED_COMPANY_ID}`, { data: { confirmationName: QA_ARCHIVED_COMPANY_NAME } });
    expect(response.ok()).toBeTruthy();
    // Row is really gone, not just re-archived: a second delete must 404,
    // and this proves it does not silently "reappear" on any subsequent read.
    const again = await request.delete(`/api/admin/companies/${QA_ARCHIVED_COMPANY_ID}`, { data: { confirmationName: QA_ARCHIVED_COMPANY_NAME } });
    expect(again.status()).toBe(404);
  });

  test("single lead permanent delete removes the record", async ({ request }) => {
    test.skip(!QA_TEST_LEAD_ID, "QA_TEST_LEAD_ID (a real, disposable test lead) not supplied in this environment.");
    await loginAsQaAdmin(request);
    const response = await request.delete(`/api/admin/leads/${QA_TEST_LEAD_ID}`);
    expect(response.ok()).toBeTruthy();
    const again = await request.delete(`/api/admin/leads/${QA_TEST_LEAD_ID}`);
    expect(again.status()).toBe(404);
  });
});
