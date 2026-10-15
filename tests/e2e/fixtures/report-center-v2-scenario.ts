import { expect, type Locator, type Page, type Request } from "@playwright/test";

// Rapor Merkezi V2 — mocked API layer + the end-to-end UI scenario.
// Every /api/admin/report-center/v2/* call is answered from the FICTIONAL
// fixtures below (page.route), so the scenario never reads or writes a real
// lead, customer or report. The server-side authorization of those routes is
// covered separately (unauthenticated checks in report-center-v2.spec.ts and
// the unit suite tests/unit/report-center-v2).

export const FIXTURE = {
  leadId: "0e000000-0000-4000-8000-0000000000a1",
  companyId: "0e000000-0000-4000-8000-0000000000c1",
  unitId: "0e000000-0000-4000-8000-0000000000e1",
  reportId: "0e000000-0000-4000-8000-0000000000f1",
  branchReportId: "0e000000-0000-4000-8000-0000000000f2"
};

const catalog = {
  categories: [
    { key: "on-inceleme", label: "Ön İnceleme", description: "Satış öncesi dijital ön inceleme raporları." },
    { key: "reklam-doktoru", label: "Reklam Doktoru Pro", description: "Meta reklam değerlendirme raporları." }
  ],
  types: [
    { key: "pre_audit_client", category: "on-inceleme", label: "Müşteriye Özel Ön İnceleme", description: "Müşteriye sunulabilir ön inceleme raporu.", owners: ["lead", "company"], businessUnits: true, variants: ["client"], formats: { pdf: true, docx: true }, modules: ["on-inceleme"] },
    { key: "ad_evaluation", category: "reklam-doktoru", label: "Meta Reklam Değerlendirmesi", description: "Yayındaki Meta kampanyasının değerlendirmesi.", owners: ["company"], businessUnits: false, variants: ["client", "internal"], formats: { pdf: true, docx: true }, modules: ["ad-insights"] }
  ]
};

function listItem(id: string, title: string, businessName: string | null) {
  return {
    ref: `pre_audit_client:${id}`, type: "pre_audit_client", sourceId: id, title, subtitle: null,
    date: "2026-10-14T09:00:00Z", period: null, status: "approved", statusLabel: "Onaylandı", archived: false,
    businessName, businessUnitId: businessName ? FIXTURE.unitId : null, variants: ["client"], formats: { pdf: true, docx: true }, storedFile: false
  };
}

const detail = {
  title: "Test Akademi — Ön İnceleme",
  variant: "client", variants: ["client"], storedFile: false, hasStoredFile: false, empty: false,
  document: {
    title: "HK Dijital — Ön İnceleme Raporu", customerName: "Test Akademi", period: "14.10.2026",
    executiveSummary: "Test Akademi için kurgusal yönetici özeti.",
    metaLines: ["Firma: Test Akademi", "Rapor Tarihi: 14.10.2026"],
    sections: [
      { title: "Instagram Bulguları", items: ["Profil biyografisi eksik.", "Öne çıkanlar düzensiz."] },
      { title: "Kanal Tablosu", table: { headers: ["Kanal", "Durum"], rows: [["Instagram", "Aktif"], ["WhatsApp", "Bağlantı yok"]] } }
    ]
  }
};

export type MockLog = { reports: URL[]; documents: URL[]; owners: URL[] };

export async function mockReportCenterApi(page: Page, options: { failDocx?: boolean } = {}): Promise<MockLog> {
  const log: MockLog = { reports: [], documents: [], owners: [] };
  const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/admin/report-center/v2/**", async (route) => {
    const request: Request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.split("/").pop();
    if (endpoint === "catalog") return route.fulfill(json(catalog));
    if (endpoint === "owners") {
      log.owners.push(url);
      const type = url.searchParams.get("type");
      return route.fulfill(json({ owners: type === "lead"
        ? [{ id: FIXTURE.leadId, name: "Test Akademi", detail: "Yeni" }]
        : [{ id: FIXTURE.companyId, name: "Test Pastanesi", detail: "active" }] }));
    }
    if (endpoint === "businesses") return route.fulfill(json({ businesses: [{ id: FIXTURE.unitId, name: "Test Akademi Kampüs", relationship: "Şube" }] }));
    if (endpoint === "reports") {
      log.reports.push(url);
      const business = url.searchParams.get("business");
      const items = business === FIXTURE.unitId
        ? [listItem(FIXTURE.branchReportId, "Kampüs Şubesi Ön İnceleme", "Test Akademi Kampüs")]
        : [listItem(FIXTURE.reportId, "Test Akademi — Ön İnceleme", null)];
      return route.fulfill(json({ items, hasMore: false, offset: 0, pageSize: 20 }));
    }
    if (endpoint === "report") return route.fulfill(json(detail));
    if (endpoint === "document") {
      log.documents.push(url);
      const format = url.searchParams.get("format");
      if (format === "docx" && options.failDocx) return route.fulfill(json({ error: "Bu raporda belgeye dönüştürülecek içerik bulunmuyor." }, 422));
      const inline = url.searchParams.get("disposition") === "inline";
      const name = format === "docx" ? "test-akademi-on-inceleme-musteri.docx" : "test-akademi-on-inceleme-musteri.pdf";
      return route.fulfill({
        status: 200,
        contentType: format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
        headers: { "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"` },
        body: format === "docx" ? Buffer.from("PK\u0003\u0004 test") : Buffer.from("%PDF-1.4\n% test\n%%EOF")
      });
    }
    return route.fulfill(json({ error: "Bilinmeyen uç." }, 404));
  });
  return log;
}

/** Waits for the admin shell's start-up splash and closes any hover
 * dropdown of the sticky header (same defensive pattern as
 * analytics-center.spec.ts / admin-direct-oauth.spec.ts). */
export async function settleAdminShell(page: Page) {
  await expect(page.getByText(/Başlatılıyor\.\.\./)).toHaveCount(0, { timeout: 20_000 });
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape");
}

/** Clicks after centring the element, so the pointer never lands on the
 * sticky header (whose hover menu would otherwise cover the panel). */
async function press(locator: Locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await locator.click();
}

/** The required STEP 1 → STEP 7 flow, asserting the separation of lead and
 * customer selections and that every list request is owner-scoped. */
export async function runReportCenterScenario(page: Page, log: MockLog) {
  const panel = page.getByTestId("report-center-v2");
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await settleAdminShell(page);

  // STEP 1-2: category → type. A customer-only type disables "Lead".
  await press(page.getByTestId("category-reklam-doktoru"));
  await press(page.getByTestId("type-ad_evaluation"));
  await expect(page.getByTestId("source-lead")).toBeDisabled();
  await expect(page.getByTestId("source-company")).toHaveAttribute("aria-pressed", "true");

  // Back to Ön İnceleme (supports both) and STEP 3: Lead.
  await press(page.getByTestId("category-on-inceleme"));
  await press(page.getByTestId("type-pre_audit_client"));
  await press(page.getByTestId("source-lead"));

  // STEP 4: dedicated LEAD SEÇ dropdown (searchable).
  const leadInput = page.getByRole("combobox");
  await expect(page.getByRole("heading", { name: "LEAD SEÇ" })).toBeVisible();
  await leadInput.fill("test");
  await press(page.getByRole("option", { name: /Test Akademi/ }));
  await expect(page.getByTestId("selected-lead")).toContainText("Test Akademi");
  expect(log.owners.some((u) => u.searchParams.get("type") === "lead")).toBe(true);
  expect(log.owners.every((u) => u.searchParams.get("type") === "lead"), "lead search never queries customers").toBe(true);

  // STEP 6: the list is requested for exactly this lead.
  const card = page.getByTestId("report-card").first();
  await expect(card).toContainText("Test Akademi — Ön İnceleme");
  const first = log.reports.at(-1)!;
  expect(first.searchParams.get("ownerType")).toBe("lead");
  expect(first.searchParams.get("ownerId")).toBe(FIXTURE.leadId);
  expect(first.searchParams.get("business")).toBe("all");
  for (const action of ["Raporu Görüntüle", "PDF Önizle", "PDF İndir", "Word İndir"]) {
    await expect(card.getByRole("button", { name: action })).toBeVisible();
  }

  // STEP 5: İşletme / Şube — the branch scope is sent to the server.
  await page.getByTestId("business-select").selectOption(FIXTURE.unitId);
  await expect(page.getByTestId("report-card").first()).toContainText("Kampüs Şubesi Ön İnceleme");
  expect(log.reports.at(-1)!.searchParams.get("business")).toBe(FIXTURE.unitId);
  await page.getByTestId("business-select").selectOption("all");
  await expect(page.getByTestId("report-card").first()).toContainText("Test Akademi — Ön İnceleme");

  // STEP 7a: Raporu Görüntüle shows the real document content.
  await press(page.getByTestId("report-card").first().getByRole("button", { name: "Raporu Görüntüle" }));
  const viewer = page.getByTestId("report-detail");
  await expect(viewer).toBeVisible();
  await expect(viewer).toContainText("kurgusal yönetici özeti");
  await expect(viewer).toContainText("Instagram Bulguları");
  await expect(viewer.getByRole("cell", { name: "Bağlantı yok" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();

  // STEP 7b: PDF İndir downloads the server-generated file.
  const download = page.waitForEvent("download");
  await press(page.getByTestId("report-card").first().getByRole("button", { name: "PDF İndir" }));
  expect((await download).suggestedFilename()).toBe("test-akademi-on-inceleme-musteri.pdf");
  const pdfRequest = log.documents.at(-1)!;
  expect(pdfRequest.searchParams.get("id")).toBe(FIXTURE.reportId);
  expect(pdfRequest.searchParams.get("ownerId")).toBe(FIXTURE.leadId);

  // STEP 7c: PDF Önizle opens the PDF in a new tab (no iframe).
  const popup = page.waitForEvent("popup");
  await press(page.getByTestId("report-card").first().getByRole("button", { name: "PDF Önizle" }));
  await (await popup).close();
  expect(log.documents.at(-1)!.searchParams.get("disposition")).toBe("inline");

  // Switching to Müşteri clears the lead selection and the list.
  await press(page.getByTestId("source-company"));
  await expect(page.getByTestId("selected-lead")).toHaveCount(0);
  await expect(page.getByTestId("report-list")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "MÜŞTERİ SEÇ" })).toBeVisible();
  await press(page.getByRole("combobox"));
  await press(page.getByRole("option", { name: /Test Pastanesi/ }));
  await expect(page.getByTestId("report-card").first()).toBeVisible();
  const companyRequest = log.reports.at(-1)!;
  expect(companyRequest.searchParams.get("ownerType")).toBe("company");
  expect(companyRequest.searchParams.get("ownerId")).toBe(FIXTURE.companyId);
}

/** Word İndir failure: the Turkish server message is shown, nothing downloads. */
export async function runDownloadErrorScenario(page: Page) {
  await settleAdminShell(page);
  await press(page.getByTestId("category-on-inceleme"));
  await press(page.getByTestId("type-pre_audit_client"));
  await press(page.getByTestId("source-lead"));
  await page.getByRole("combobox").fill("test");
  await press(page.getByRole("option", { name: /Test Akademi/ }));
  await press(page.getByTestId("report-card").first().getByRole("button", { name: "Word İndir" }));
  await expect(page.getByText("Bu raporda belgeye dönüştürülecek içerik bulunmuyor.").first()).toBeVisible();
}
