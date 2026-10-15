import { test, expect } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";
import { mockReportCenterApi, runDownloadErrorScenario, runReportCenterScenario } from "./fixtures/report-center-v2-scenario";

// Rapor Merkezi V2.
//  - Security (always runs): every V2 endpoint refuses an unauthenticated
//    caller before touching any report, and the refusal carries no data.
//  - UI flow (real QA admin login): the V2 API is mocked with fictional
//    fixtures, so no real lead / customer / report is read or modified.

const LEAD = "0e000000-0000-4000-8000-0000000000a1";
const REPORT = "0e000000-0000-4000-8000-0000000000f1";

test.describe("Rapor Merkezi V2 — server-side authorization", () => {
  test("unauthenticated callers get 401/403 with a generic message and no report data", async ({ request }) => {
    const base = "/api/admin/report-center/v2";
    const cases: Array<[string, number[]]> = [
      [`${base}/catalog`, [401]],
      [`${base}/owners?type=lead&q=a`, [401]],
      [`${base}/businesses?ownerType=lead&ownerId=${LEAD}`, [401]],
      [`${base}/reports?type=pre_audit_internal&ownerType=lead&ownerId=${LEAD}&business=all`, [403]],
      [`${base}/report?type=pre_audit_internal&ownerType=lead&ownerId=${LEAD}&business=all&id=${REPORT}`, [403]],
      [`${base}/document?type=pre_audit_internal&ownerType=lead&ownerId=${LEAD}&business=all&id=${REPORT}&format=pdf`, [403]]
    ];
    for (const [url, statuses] of cases) {
      const response = await request.get(url);
      expect(statuses, url).toContain(response.status());
      const body = await response.json();
      expect(Object.keys(body), url).toEqual(["error"]);
      expect(String(body.error)).not.toMatch(/supabase|pre_audit_reports|select=|eq\./i);
    }
  });
});

test.describe("Rapor Merkezi V2 — report-first flow (mocked report API)", () => {
  test.use({ storageState: qaAdminStorageState });
  test.beforeEach(() => {
    test.skip(!hasQaAdminCredentials(), qaSkipReason);
  });

  test("category → type → Lead/Müşteri → işletme → list → view / preview / download", async ({ page }) => {
    const log = await mockReportCenterApi(page);
    await gotoAsQaAdmin(page, "/hk-admin/rapor-merkezi");
    await runReportCenterScenario(page, log);
  });

  test("a failed Word export shows the Turkish server message", async ({ page }) => {
    await mockReportCenterApi(page, { failDocx: true });
    await gotoAsQaAdmin(page, "/hk-admin/rapor-merkezi");
    await expect(page.getByTestId("report-center-v2")).toBeVisible({ timeout: 20_000 });
    await runDownloadErrorScenario(page);
  });
});
