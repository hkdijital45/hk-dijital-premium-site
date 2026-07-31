import { test, expect, type Page } from "@playwright/test";
import { hasQaAdminCredentials, loginAsQaAdmin, qaSkipReason } from "./fixtures/qa-auth";

// This sandbox's plain-HTTP local server still marks the session cookie
// Secure (matches NODE_ENV=production). A real browser's own network stack
// (page.goto navigations, in-page fetch via page.evaluate) correctly treats
// 127.0.0.1 as a potentially trustworthy loopback origin and sends it back;
// Playwright's Node-side request/page.request contexts do not and silently
// drop the cookie on later calls. Logging in via page.request is fine (it
// only needs to store the cookie), but every subsequent authenticated call
// must run through this in-page fetch to actually send it.
function inPageFetch(page: Page) {
  return (path: string, init: { method: string; body?: unknown } = { method: "GET" }) =>
    page.evaluate(
      async ({ path, init }) => {
        const response = await fetch(path, {
          method: init.method,
          headers: { "Content-Type": "application/json" },
          body: init.body !== undefined ? JSON.stringify(init.body) : undefined
        });
        const body = await response.json().catch(() => ({}));
        return { status: response.status, ok: response.ok, body };
      },
      { path, init }
    );
}

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
// A syntactically valid but non-existent UUID. Must be a real v4 shape
// (version nibble 4, variant nibble 8/9/a/b) — the all-zero placeholder this
// used to be fails /lib/meta-pixel-admin.ts's uuidPattern format check
// itself (a legitimate, correct guard), returning 400 before the route ever
// reaches its "record not found" 404 branch.
const RANDOM_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
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

  test("deleting a non-existent customer returns a clear error, not a false success", async ({ page }) => {
    // A page navigation (any same-origin page) is required before in-page
    // fetch() calls with relative URLs will resolve — page.evaluate runs
    // against about:blank until the page actually navigates somewhere.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await loginAsQaAdmin(page.request);
    const fetchInPage = inPageFetch(page);
    const response = await fetchInPage(`/api/admin/companies/${RANDOM_UUID}`, { method: "DELETE", body: { confirmationName: "Mevcut Olmayan Firma" } });
    expect(response.status).toBe(404);
    expect(response.body.error).toBeTruthy();
  });

  test("deleting a non-existent lead returns a clear error, not a false success", async ({ page }) => {
    // A page navigation (any same-origin page) is required before in-page
    // fetch() calls with relative URLs will resolve — page.evaluate runs
    // against about:blank until the page actually navigates somewhere.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await loginAsQaAdmin(page.request);
    const fetchInPage = inPageFetch(page);
    const response = await fetchInPage(`/api/admin/leads/${RANDOM_UUID}`, { method: "DELETE" });
    expect(response.status).toBe(404);
  });

  test("bulk permanent delete without the typed confirmation phrase is rejected before touching data", async ({ page }) => {
    // A page navigation (any same-origin page) is required before in-page
    // fetch() calls with relative URLs will resolve — page.evaluate runs
    // against about:blank until the page actually navigates somewhere.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await loginAsQaAdmin(page.request);
    const fetchInPage = inPageFetch(page);
    const response = await fetchInPage("/api/admin/data-management", { method: "POST", body: { resource: "customer", scope: "archived_all" } });
    expect(response.status).toBe(400);
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

  // Regression test for a real production defect: customer_conversations.company_id
  // was ON DELETE RESTRICT, so any customer with real Communication Center
  // history blocked the final `DELETE FROM companies` with a genuine Postgres
  // foreign key violation (23503), surfaced to the admin as the toast
  // "Veritabanı şema hatası". Self-provisions its own disposable QA-prefixed
  // company + conversation (via the service-role key already loaded from
  // .env.local) rather than depending on external env vars, so it always
  // runs whenever QA admin credentials are present.
  test("a customer with real conversation history can still be permanently deleted", async ({ page }, testInfo) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    test.skip(!supabaseUrl || !serviceKey, "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not supplied in this environment.");

    // A page navigation (any same-origin page) is required before in-page
    // fetch() calls with relative URLs will resolve — page.evaluate runs
    // against about:blank until the page actually navigates somewhere.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await loginAsQaAdmin(page.request);
    const inPageFetchForPage = inPageFetch(page);

    const unique = `${Date.now()}-${testInfo.project.name}`;
    const companyName = `QA-Perm-Delete-Convo-${unique}`;
    const createRes = await inPageFetchForPage("/api/admin/companies/create", { method: "POST", body: { name: companyName, email: `qa-perm-delete-convo-${unique}@example.test`, is_test: true } });
    expect(createRes.ok, `company create failed: ${JSON.stringify(createRes.body)}`).toBeTruthy();
    const companyId = createRes.body.company.id;

    const convoRes = await fetch(`${supabaseUrl}/rest/v1/customer_conversations`, {
      method: "POST",
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ company_id: companyId, subject: "Playwright regression: permanent delete with conversation history", category: "general" })
    });
    expect(convoRes.ok, "seeding a real conversation row must succeed").toBeTruthy();

    const archiveRes = await inPageFetchForPage(`/api/admin/companies/${companyId}`, { method: "PATCH", body: { status: "Silindi" } });
    expect(archiveRes.ok, `archive failed: ${JSON.stringify(archiveRes.body)}`).toBeTruthy();

    const deleteRes = await inPageFetchForPage(`/api/admin/companies/${companyId}`, { method: "DELETE", body: { confirmationName: companyName } });
    expect(deleteRes.ok, `permanent delete must succeed even with conversation history: ${JSON.stringify(deleteRes.body)}`).toBeTruthy();
    expect(deleteRes.body.deleted).toBeTruthy();

    const again = await inPageFetchForPage(`/api/admin/companies/${companyId}`, { method: "DELETE", body: { confirmationName: companyName } });
    expect(again.status).toBe(404);
  });
});
