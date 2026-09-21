import { test, expect } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, loginAsQaAdmin, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";

// Regression coverage for the Lead Merkezi "🔍 Ön İncele" bug: clicking the
// button successfully navigated to Ön İnceleme Merkezi, but the queued lead
// did not visibly appear in "Bekleyen" — because PreAuditCenter always
// mounted on its "Tamamlanan" tab by default, regardless of arrival path.
// The queue mutation itself (startPreReviewQueue → leads.status) was never
// broken; these tests prove BOTH halves explicitly so a future regression
// in either one is caught:
//   1. the mutation really moves the exact lead id into queue.pending
//      (source/company_id independent), and
//   2. the real button, clicked in the real UI, lands the admin on the
//      "Bekleyen" tab with that lead visible — not just "some navigation
//      happened".
test.use({ storageState: qaAdminStorageState });

test.beforeEach(() => {
  test.skip(!hasQaAdminCredentials(), qaSkipReason);
});

async function createTestLead(request: any, overrides: Record<string, unknown> = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await request.post("/api/leads", {
    data: {
      name: `QA PreAudit Test ${suffix}`,
      company: `QA PreAudit Co ${suffix}`,
      email: `qa-preaudit-${suffix}@example.com`,
      source: "contact",
      ...overrides
    }
  });
  expect(response.ok(), `lead creation should succeed: ${await response.text()}`).toBeTruthy();
  const body = await response.json();
  const lead = body.lead || body;
  expect(lead.id).toBeTruthy();
  return lead;
}

async function deleteTestLead(request: any, id: string) {
  await request.delete(`/api/admin/leads/${id}`).catch(() => {});
}

test.describe("startPreReviewQueue → Bekleyen queue link (API layer)", () => {
  test("a freshly created manual lead is placed in queue.pending by exact id after start_review", async ({ request }) => {
    await loginAsQaAdmin(request);
    const lead = await createTestLead(request);
    try {
      const patchRes = await request.patch(`/api/admin/pre-audit/lead/${lead.id}`, { data: { action: "start_review" } });
      expect(patchRes.ok(), `start_review should succeed: ${await patchRes.text()}`).toBeTruthy();
      const patchBody = await patchRes.json();
      expect(patchBody.ok).toBe(true);
      expect(patchBody.lead.id).toBe(lead.id);

      const queueRes = await request.get("/api/admin/pre-audit");
      expect(queueRes.ok()).toBeTruthy();
      const queueBody = await queueRes.json();
      const pendingIds = (queueBody.queue?.pending || []).map((row: any) => row.id);
      expect(pendingIds).toContain(lead.id);
    } finally {
      await deleteTestLead(request, lead.id);
    }
  });

  test("a lead with company_id null and non-Web source still enters the queue (no company_id/source requirement)", async ({ request }) => {
    await loginAsQaAdmin(request);
    const lead = await createTestLead(request, { source: "wizard" });
    expect(lead.company_id ?? null).toBeNull();
    try {
      const patchRes = await request.patch(`/api/admin/pre-audit/lead/${lead.id}`, { data: { action: "start_review" } });
      expect(patchRes.ok()).toBeTruthy();

      const queueRes = await request.get("/api/admin/pre-audit");
      const queueBody = await queueRes.json();
      const pendingIds = (queueBody.queue?.pending || []).map((row: any) => row.id);
      expect(pendingIds).toContain(lead.id);
    } finally {
      await deleteTestLead(request, lead.id);
    }
  });

  test("clicking start_review twice on the same lead does not duplicate the queue entry (idempotent)", async ({ request }) => {
    await loginAsQaAdmin(request);
    const lead = await createTestLead(request);
    try {
      const first = await request.patch(`/api/admin/pre-audit/lead/${lead.id}`, { data: { action: "start_review" } });
      const second = await request.patch(`/api/admin/pre-audit/lead/${lead.id}`, { data: { action: "start_review" } });
      expect(first.ok()).toBeTruthy();
      expect(second.ok()).toBeTruthy();

      const queueRes = await request.get("/api/admin/pre-audit");
      const queueBody = await queueRes.json();
      const matches = (queueBody.queue?.pending || []).filter((row: any) => row.id === lead.id);
      expect(matches.length).toBe(1);
    } finally {
      await deleteTestLead(request, lead.id);
    }
  });

  test("start_review on a non-existent lead id fails honestly (no false success)", async ({ request }) => {
    await loginAsQaAdmin(request);
    const response = await request.patch("/api/admin/pre-audit/lead/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", { data: { action: "start_review" } });
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });
});

test.describe("Lead Merkezi → Ön İncele button (real UI)", () => {
  test("clicking 🔍 Ön İncele in Lead Merkezi opens Ön İnceleme Merkezi directly on Bekleyen with the lead visible", async ({ page, request }) => {
    await loginAsQaAdmin(request);
    const lead = await createTestLead(request);
    try {
      await gotoAsQaAdmin(page, "/hk-admin/leads");
      await page.waitForLoadState("domcontentloaded");

      // Find the freshly created lead's actual clickable grid row and select
      // it. Note: the lead's name also appears as plain text in the "Son
      // Aktiviteler" feed above the grid, so a bare text match would pick
      // that non-interactive element instead — scope to AdminDataGrid's own
      // row/card wrapper (tr.is-clickable on desktop, .admin-card on
      // mobile/narrow viewports; only one is visible at a time via CSS).
      const row = page.locator("tr.is-clickable:visible, .admin-card:visible").filter({ hasText: lead.company }).first();
      await row.waitFor({ state: "visible", timeout: 15000 });
      await row.click();

      // Selecting a row also opens the "Başvuru Detayı" (LeadDrawer) modal
      // as a pre-existing, unrelated side effect — it covers the right-panel
      // "Ön İncele" button, so it must be closed first.
      const detailDialog = page.getByRole("dialog", { name: "Başvuru Detayı" });
      if (await detailDialog.isVisible().catch(() => false)) {
        await detailDialog.getByRole("button", { name: "Kapat" }).click();
      }

      const startButton = page.getByRole("button", { name: /Ön İncele/ }).first();
      await startButton.waitFor({ state: "visible", timeout: 10000 });
      await startButton.scrollIntoViewIfNeeded();
      await startButton.click();

      // Regression assertion: the Bekleyen tab must be the one already
      // active after navigation, and the queued lead must be visible in it —
      // not merely "Ön İnceleme Merkezi opened".
      const bekleyenTab = page.getByRole("button", { name: /^Bekleyen/ });
      await expect(bekleyenTab).toBeVisible({ timeout: 15000 });
      await expect(bekleyenTab).toHaveCSS("background-color", "rgb(8, 145, 178)");
      await expect(page.getByText(lead.company, { exact: false }).first()).toBeVisible({ timeout: 15000 });
    } finally {
      await deleteTestLead(request, lead.id);
    }
  });
});
