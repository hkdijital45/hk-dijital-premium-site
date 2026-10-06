import { test, expect, type Page } from "@playwright/test";

/**
 * /teklif-al (Dijital Pazarlama Ön Analizi) — "Platform İhtiyacınız" multi-select
 * step. Public route, no auth required. Covers independent Meta/Google/Sosyal
 * Medya toggling, the "Hepsi" select-all/clear-all shortcut and its visual sync,
 * Continue-button + step-navigation validation, the resolved platform array
 * reaching the /api/leads payload, and the platform-aware deterministic
 * analysis text. No package, price, or AI recommendation is expected.
 */

type LeadPayload = { platforms?: string[]; [key: string]: unknown };

const PLATFORM_TESTID: Record<string, string> = {
  Meta: "platform-card-meta",
  Google: "platform-card-google",
  "Sosyal Medya": "platform-card-social-media",
  Hepsi: "platform-card-all"
};

function platformCard(page: Page, label: keyof typeof PLATFORM_TESTID) {
  return page.getByTestId(PLATFORM_TESTID[label]);
}

function continueButton(page: Page) {
  return page.getByTestId("platform-continue");
}

async function interceptLeadSubmission(page: Page) {
  let capturedBody: LeadPayload | null = null;
  await page.route("**/api/leads", async (route) => {
    capturedBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, lead: { id: "test" } }) });
  });
  return () => capturedBody;
}

async function reachPlatformStep(page: Page) {
  await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
  await expect(async () => {
    await page.getByRole("button", { name: "Restoran" }).click();
    await expect(page.getByRole("button", { name: "Daha Fazla Satış" })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30000 });
  await page.getByRole("button", { name: "Daha Fazla Satış" }).click();
  await expect(page.getByRole("heading", { name: "Platform İhtiyacınız" })).toBeVisible();
}

async function completeStepsThroughAnalysis(page: Page) {
  await page.getByRole("button", { name: "5.000-20.000 TL" }).click();
  await page.getByRole("button", { name: "Analizi Görüntüle" }).click();
  await expect(page.getByRole("heading", { name: "Dijital Pazarlama Ön Analiziniz" })).toBeVisible();
  await page.getByRole("button", { name: "İletişim Bilgilerine Geç" }).click();
}

async function fillContactAndSubmit(page: Page) {
  await page.getByLabel(/Ad Soyad/).fill("Test Kullanıcı");
  await page.getByLabel(/Firma Adı/).fill("Test Firma");
  await page.getByLabel(/E-posta/).fill("test@example.com");
  await page.getByRole("textbox", { name: /Telefon/ }).fill("5551234567");
  await page.getByRole("button", { name: /Gönder|Bırakayım|Teklif/ }).last().click();
}

test.describe("/teklif-al - Platform İhtiyacınız adımı: çoklu seçim", () => {
  test("hiçbir platform seçilmeden Devam devre dışıdır ve adım ilerlemez", async ({ page }) => {
    await reachPlatformStep(page);
    await expect(continueButton(page)).toBeDisabled();
    await continueButton(page).click({ force: true }).catch(() => undefined);
    await expect(page.getByRole("heading", { name: "Platform İhtiyacınız" })).toBeVisible();
  });

  test("sadece Meta seçilince Devam aktifleşir ve bir sonraki adıma geçer", async ({ page }) => {
    await reachPlatformStep(page);
    await platformCard(page, "Meta").click();
    await expect(continueButton(page)).toBeEnabled();
    await continueButton(page).click();
    await expect(page.getByRole("heading", { name: "Aylık Reklam Bütçesi" })).toBeVisible();
  });

  test("Meta ve Google birlikte seçilince ikisi de seçili kalır", async ({ page }) => {
    await reachPlatformStep(page);
    await platformCard(page, "Meta").click();
    await platformCard(page, "Google").click();
    await expect(platformCard(page, "Meta")).toHaveAttribute("aria-pressed", "true");
    await expect(platformCard(page, "Google")).toHaveAttribute("aria-pressed", "true");
  });

  test("Meta + Google seçiminde Sosyal Medya ve Hepsi seçili olmaz", async ({ page }) => {
    await reachPlatformStep(page);
    await platformCard(page, "Meta").click();
    await platformCard(page, "Google").click();
    await expect(platformCard(page, "Sosyal Medya")).toHaveAttribute("aria-pressed", "false");
    await expect(platformCard(page, "Hepsi")).toHaveAttribute("aria-pressed", "false");
  });

  test("Hepsi'ye tıklanınca üç platform da seçilir", async ({ page }) => {
    await reachPlatformStep(page);
    await platformCard(page, "Hepsi").click();
    await expect(platformCard(page, "Meta")).toHaveAttribute("aria-pressed", "true");
    await expect(platformCard(page, "Google")).toHaveAttribute("aria-pressed", "true");
    await expect(platformCard(page, "Sosyal Medya")).toHaveAttribute("aria-pressed", "true");
  });

  test("Hepsi'ye tekrar tıklanınca üç platform da temizlenir", async ({ page }) => {
    await reachPlatformStep(page);
    const hepsi = platformCard(page, "Hepsi");
    await hepsi.click();
    await hepsi.click();
    await expect(platformCard(page, "Meta")).toHaveAttribute("aria-pressed", "false");
    await expect(platformCard(page, "Google")).toHaveAttribute("aria-pressed", "false");
    await expect(platformCard(page, "Sosyal Medya")).toHaveAttribute("aria-pressed", "false");
    await expect(hepsi).toHaveAttribute("aria-pressed", "false");
  });

  test("üç platform tek tek seçilince Hepsi görsel olarak aktifleşir", async ({ page }) => {
    await reachPlatformStep(page);
    await platformCard(page, "Meta").click();
    await platformCard(page, "Google").click();
    await platformCard(page, "Sosyal Medya").click();
    await expect(platformCard(page, "Hepsi")).toHaveAttribute("aria-pressed", "true");
  });

  test("üçü seçiliyken birini kaldırmak Hepsi'yi pasifleştirir", async ({ page }) => {
    await reachPlatformStep(page);
    await platformCard(page, "Hepsi").click();
    await platformCard(page, "Google").click();
    await expect(platformCard(page, "Google")).toHaveAttribute("aria-pressed", "false");
    await expect(platformCard(page, "Hepsi")).toHaveAttribute("aria-pressed", "false");
    await expect(platformCard(page, "Meta")).toHaveAttribute("aria-pressed", "true");
    await expect(platformCard(page, "Sosyal Medya")).toHaveAttribute("aria-pressed", "true");
  });

  test("boş seçime dönünce Devam yeniden devre dışı kalır ve satır içi hata gösterilebilir", async ({ page }) => {
    await reachPlatformStep(page);
    await platformCard(page, "Meta").click();
    await platformCard(page, "Meta").click();
    await expect(continueButton(page)).toBeDisabled();
    await expect(page.getByTestId("platform-error")).toHaveCount(0);
  });

  test("son lead gönderiminde platforms alanı dizi olarak iletilir", async ({ page }) => {
    const getBody = await interceptLeadSubmission(page);
    await reachPlatformStep(page);
    await platformCard(page, "Meta").click();
    await platformCard(page, "Google").click();
    await continueButton(page).click();
    await completeStepsThroughAnalysis(page);
    await fillContactAndSubmit(page);
    await expect.poll(() => getBody()).not.toBeNull();
    expect(getBody()?.platforms).toEqual(["meta", "google"]);
  });

  test("analiz ekranı seçilen kanalları gösterir ve metin yalnızca seçilen platformları yansıtır (Meta + Sosyal Medya, Google hariç)", async ({ page }) => {
    await reachPlatformStep(page);
    await platformCard(page, "Meta").click();
    await platformCard(page, "Sosyal Medya").click();
    await continueButton(page).click();
    await page.getByRole("button", { name: "5.000-20.000 TL" }).click();
    await page.getByRole("button", { name: "Analizi Görüntüle" }).click();
    await expect(page.getByRole("heading", { name: "Dijital Pazarlama Ön Analiziniz" })).toBeVisible();
    await expect(page.locator("dd", { hasText: "Meta, Sosyal Medya" })).toBeVisible();
    await expect(page.getByText("Hedefinize uygun Meta yapısının değerlendirilmesi.")).toBeVisible();
    const wizard = page.locator("section.px-4").filter({ hasText: "Dijital Pazarlama Ön Analiziniz" }).first();
    await expect(wizard.getByText(/Google Ads/)).toHaveCount(0);
  });

  test("Meta + Google seçimi analiz metnine iki kanalı birlikte yazar", async ({ page }) => {
    await reachPlatformStep(page);
    await platformCard(page, "Meta").click();
    await platformCard(page, "Google").click();
    await continueButton(page).click();
    await page.getByRole("button", { name: "5.000-20.000 TL" }).click();
    await page.getByRole("button", { name: "Analizi Görüntüle" }).click();
    await expect(page.getByText("Hedefinize uygun Meta ve Google Ads yapısının değerlendirilmesi.")).toBeVisible();
  });

  test("seçilen platformlar Geri/İleri gezintisinde korunur", async ({ page }) => {
    await reachPlatformStep(page);
    await platformCard(page, "Meta").click();
    await platformCard(page, "Google").click();
    await continueButton(page).click();
    await page.getByRole("button", { name: "5.000-20.000 TL" }).click();
    await page.getByRole("button", { name: "Analizi Görüntüle" }).click();
    for (let i = 0; i < 3; i += 1) {
      await page.getByRole("button", { name: "Geri" }).click();
      await page.waitForTimeout(400);
    }
    await expect(page.getByRole("heading", { name: "Platform İhtiyacınız" })).toBeVisible();
    await expect(platformCard(page, "Meta")).toHaveAttribute("aria-pressed", "true");
    await expect(platformCard(page, "Google")).toHaveAttribute("aria-pressed", "true");
  });

  test("analiz ekranında paket, fiyat veya AI öneri arayüzü bulunmaz", async ({ page }) => {
    await reachPlatformStep(page);
    await platformCard(page, "Meta").click();
    await continueButton(page).click();
    await page.getByRole("button", { name: "5.000-20.000 TL" }).click();
    await page.getByRole("button", { name: "Analizi Görüntüle" }).click();
    await expect(page.getByRole("heading", { name: "Dijital Pazarlama Ön Analiziniz" })).toBeVisible();
    const wizard = page.locator("section.px-4").filter({ hasText: "Dijital Pazarlama Ön Analiziniz" }).first();
    for (const absent of ["Önerilen Paket", "Paketi Öner", "Bütçe Analizi Oluştur", "KDV", "AI Destekli", "Bilgilerimi Bırakayım"]) {
      await expect(wizard).not.toContainText(absent);
    }
  });

  test("mobil genişlikte Platform İhtiyacınız adımı kullanılabilir kalır", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await reachPlatformStep(page);
    await platformCard(page, "Meta").click();
    await expect(platformCard(page, "Meta")).toHaveAttribute("aria-pressed", "true");
    await expect(continueButton(page)).toBeEnabled();
  });
});
