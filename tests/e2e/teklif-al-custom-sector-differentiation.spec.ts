import { test, expect, type Page } from "@playwright/test";

/**
 * /teklif-al (Dijital Pazarlama Ön Analizi) — custom ("Diğer") sector flow.
 * Confirms that a custom sector is shown as the business profile on the
 * analysis screen, that changing it after back/forward navigation updates the
 * analysis, and that the analysis carries no AI or package recommendation.
 */

const OTO_SERVIS = "Oto Servis";
const GUZELLIK_MERKEZI = "Güzellik Merkezi";

async function enterCustomSector(page: Page, sector: string) {
  await expect(async () => {
    await page.getByRole("button", { name: /Diğer/ }).click();
    await expect(page.getByLabel("İşletme sektörünüzü yazın")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30000 });
  const input = page.getByLabel("İşletme sektörünüzü yazın");
  await input.fill(sector);
  await page.getByRole("button", { name: "Devam" }).click();
}

async function ensurePlatformSelected(page: Page, testId: string) {
  const card = page.getByTestId(testId);
  if ((await card.getAttribute("aria-pressed")) !== "true") await card.click();
}

async function completeToAnalysis(page: Page) {
  await page.getByRole("button", { name: "Daha Fazla Satış" }).click();
  await ensurePlatformSelected(page, "platform-card-meta");
  await ensurePlatformSelected(page, "platform-card-google");
  await page.getByTestId("platform-continue").click();
  await page.getByRole("button", { name: "5.000-20.000 TL" }).click();
  await page.getByRole("button", { name: "Analizi Görüntüle" }).click();
  await expect(page.getByRole("heading", { name: "Dijital Pazarlama Ön Analiziniz" })).toBeVisible();
}

async function goBack(page: Page, times: number) {
  // Each StepPanel transition is animated; wait for it to settle so a click
  // is never dropped mid-transition (test timing, not an app defect).
  for (let i = 0; i < times; i += 1) {
    await page.getByRole("button", { name: "Geri" }).click();
    await page.waitForTimeout(400);
  }
}

test.describe("/teklif-al - özel sektör ön analiz doğrulaması", () => {
  test("Oto Servis özel sektörü analiz ekranındaki İşletme Profili'nde görünür", async ({ page }) => {
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await enterCustomSector(page, OTO_SERVIS);
    await completeToAnalysis(page);
    await expect(page.locator("dd", { hasText: OTO_SERVIS })).toBeVisible();
  });

  test("Güzellik Merkezi özel sektörü analiz ekranındaki İşletme Profili'nde görünür", async ({ page }) => {
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await enterCustomSector(page, GUZELLIK_MERKEZI);
    await completeToAnalysis(page);
    await expect(page.locator("dd", { hasText: GUZELLIK_MERKEZI })).toBeVisible();
  });

  test("analiz kartları deterministik ve AI/paket önerisi içermez", async ({ page }) => {
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await enterCustomSector(page, OTO_SERVIS);
    await completeToAnalysis(page);
    for (const title of ["Reklam Stratejisi", "Bütçe Planlaması", "İçerik & Kreatif", "Ölçüm & Raporlama"]) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
    const wizard = page.locator("section.px-4").filter({ hasText: "Dijital Pazarlama Ön Analiziniz" }).first();
    for (const absent of ["Önerilen Paket", "Paketi Öner", "Bütçe Analizi Oluştur", "AI Destekli", "KDV"]) {
      await expect(wizard).not.toContainText(absent);
    }
  });

  test("sektör değiştirilip Geri/İleri gidildiğinde analiz güncel sektörü gösterir, önceki sektörü değil", async ({ page }) => {
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await enterCustomSector(page, OTO_SERVIS);
    await completeToAnalysis(page);
    await expect(page.locator("dd", { hasText: OTO_SERVIS })).toBeVisible();

    // analysis → needs → budget → platform → goal → business type
    await goBack(page, 5);
    await expect(page.getByLabel("İşletme sektörünüzü yazın")).toHaveValue(OTO_SERVIS);
    await page.getByLabel("İşletme sektörünüzü yazın").fill(GUZELLIK_MERKEZI);
    await page.getByRole("button", { name: "Devam" }).click();
    await completeToAnalysis(page);

    await expect(page.locator("dd", { hasText: GUZELLIK_MERKEZI })).toBeVisible();
    await expect(page.locator("dd", { hasText: OTO_SERVIS })).toHaveCount(0);
  });
});
