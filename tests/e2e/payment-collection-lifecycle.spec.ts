import { test, expect, request as playwrightRequest } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";

// Real end-to-end coverage for the Tahsilat Takibi (Muhasebe Merkezi ->
// Tahsilatlar) production bug fix: both "add" buttons must open a real
// create form, submits must hit the real API and persist to Supabase,
// edits and deletes must survive a full page reload, and the previous
// "invisible empty draft" blocker must never appear since no local-only
// draft row is created before a real save.
//
// A dedicated, is_test-flagged company is created directly via the
// Supabase REST API (service role) for the duration of this test and hard-
// deleted afterward — consistent with this repo's "never leave synthetic
// data behind" QA convention. This does not touch any real production
// company or payment record.

test.use({ storageState: qaAdminStorageState });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function restHeaders() {
  return { apikey: SERVICE_KEY as string, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };
}

test.describe("Tahsilat Takibi: real create / edit / delete lifecycle", () => {
  test.skip(!hasQaAdminCredentials() || !SUPABASE_URL || !SERVICE_KEY, hasQaAdminCredentials() ? "SUPABASE_URL/SERVICE_ROLE_KEY not configured" : qaSkipReason);

  let companyId = "";
  let companyName = "";

  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext();
    companyName = `E2E Tahsilat Test ${Date.now()}`;
    const res = await ctx.post(`${SUPABASE_URL}/rest/v1/companies`, {
      headers: { ...restHeaders(), Prefer: "return=representation" },
      data: { name: companyName, status: "Aktif", is_active: true, is_test: true, sector: "Test" }
    });
    const rows = await res.json();
    if (!res.ok() || !rows[0]) throw new Error(`Test company create failed: ${JSON.stringify(rows)}`);
    companyId = rows[0].id;
    await ctx.dispose();
  });

  test.afterAll(async () => {
    if (!companyId) return;
    const ctx = await playwrightRequest.newContext();
    // Hard-delete any payment records left on the test company, then the company itself.
    await ctx.delete(`${SUPABASE_URL}/rest/v1/payment_records?company_id=eq.${companyId}`, { headers: restHeaders() });
    await ctx.delete(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, { headers: restHeaders() });
    const remainingPayments = await (await ctx.get(`${SUPABASE_URL}/rest/v1/payment_records?company_id=eq.${companyId}`, { headers: restHeaders() })).json();
    const remainingCompany = await (await ctx.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, { headers: restHeaders() })).json();
    expect(remainingPayments).toEqual([]);
    expect(remainingCompany).toEqual([]);
    await ctx.dispose();
  });

  test("full lifecycle: create via both buttons, edit, delete, refresh persistence, no invisible-draft block", async ({ page }) => {
    await gotoAsQaAdmin(page, "/hk-admin/muhasebe?tab=tahsilatlar");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText("Tahsilat Takibi")).toBeVisible();

    // The drawer panel and the left filter panel both contain a "Müşteri"
    // labeled select — every form interaction below is scoped to the drawer
    // panel specifically to avoid ambiguity with the filter panel's select.
    const drawer = page.locator(".admin-drawer-panel");

    // --- Step 1: bottom "Tahsilat Kaydı Ekle" button opens a real form ---
    await page.getByRole("button", { name: "Tahsilat Kaydı Ekle" }).click();
    await expect(drawer.getByText("Yeni Tahsilat Kaydı")).toBeVisible();

    // Select the test company (dropdown may already default to the applied
    // filter's company, but explicitly select ours to be certain).
    await drawer.getByRole("combobox").first().selectOption({ label: companyName });
    await drawer.getByLabel("Tutar (TL)").fill("1250");
    await drawer.getByRole("button", { name: "Kaydet" }).click();

    // Drawer closes once the real API call succeeds.
    await expect(drawer).toHaveCount(0, { timeout: 10000 });

    // --- Step 2: record appears in the list ---
    await expect(page.getByText("1.250 TL").first()).toBeVisible();

    // --- Step 3: refresh, record must still be there ---
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("1.250 TL").first()).toBeVisible();

    // --- Step 4: edit the record, change amount to 1500 ---
    await page.locator("tbody tr").filter({ hasText: companyName }).first().click();
    await page.getByRole("button", { name: "Düzenle" }).click();
    await expect(drawer.getByText("Tahsilat Kaydını Düzenle")).toBeVisible();
    await drawer.getByLabel("Tutar (TL)").fill("1500");
    await drawer.getByRole("button", { name: "Kaydet" }).click();
    await expect(drawer).toHaveCount(0, { timeout: 10000 });

    // --- Step 5: refresh, updated amount must persist ---
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("1.500 TL").first()).toBeVisible();
    await expect(page.getByText("1.250 TL")).toHaveCount(0);

    // --- Step 6: delete the record via ConfirmDialog ---
    await page.locator("tbody tr").filter({ hasText: companyName }).first().click();
    await page.getByRole("button", { name: "Sil", exact: true }).click();
    const confirmDialog = page.locator(".admin-modal-panel");
    await expect(confirmDialog.getByText("Tahsilat kaydını sil")).toBeVisible();
    await confirmDialog.getByRole("button", { name: /^Sil$/ }).click();
    await expect(confirmDialog).toHaveCount(0, { timeout: 10000 });

    // --- Step 7: refresh, deleted record must NOT reappear ---
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("1.500 TL")).toHaveCount(0);

    // --- Step 8: top "+ Tahsilat Kaydı" button must open cleanly a second
    // time — no "zaten boş bir tahsilat taslağı var" block from a phantom
    // draft left over by the previous (now-deleted) record. ---
    await page.getByRole("button", { name: "+ Tahsilat Kaydı" }).click();
    await expect(drawer.getByText("Yeni Tahsilat Kaydı")).toBeVisible();
    await expect(page.getByText("Zaten boş bir tahsilat taslağı var")).toHaveCount(0);

    await drawer.getByRole("combobox").first().selectOption({ label: companyName });
    await drawer.getByLabel("Tutar (TL)").fill("750");
    await drawer.getByRole("button", { name: "Kaydet" }).click();
    await expect(drawer).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText("750 TL").first()).toBeVisible();
  });
});
