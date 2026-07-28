import { test, expect, type Page } from "@playwright/test";

/**
 * /teklif-al (Paket Öneri Robotu) — "Platform İhtiyacınız" multi-select step.
 * Public route, no auth required. Covers independent Meta/Google/Sosyal Medya
 * toggling, the "Hepsi" select-all/clear-all shortcut and its visual sync,
 * Continue-button + step-navigation validation, the resolved platform array
 * reaching the /api/leads payload, and combination-aware AI budget output.
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
  await page.getByRole("button", { name: "Restoran" }).click();
  await page.getByRole("button", { name: "Daha Fazla Satış" }).click();
  await expect(page.getByRole("heading", { name: "Platform İhtiyacınız" })).toBeVisible();
}

async function completeStepsThroughRecommendation(page: Page) {
  await page.getByRole("button", { name: "5.000-20.000 TL" }).click();
  await page.getByRole("button", { name: "Paketi Öner" }).click();
  await page.getByRole("button", { name: "Bilgilerimi Bırakayım" }).click();
}

async function fillContactAndSubmit(page: Page) {
  await page.getByLabel(/Ad Soyad/).fill("Test Kullanıcı");
  await page.getByLabel(/Firma Adı/).fill("Test Firma");
  await page.getByLabel(/E-posta/).fill("test@example.com");
  await page.getByLabel(/Telefon/).fill("5551234567");
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
    await completeStepsThroughRecommendation(page);
    await fillContactAndSubmit(page);
    await expect.poll(() => getBody()).not.toBeNull();
    expect(getBody()?.platforms).toEqual(["meta", "google"]);
  });

  test("öneri metni yalnızca seçilen platformları yansıtır (Meta + Sosyal Medya, Google hariç)", async ({ page }) => {
    await reachPlatformStep(page);
    await platformCard(page, "Meta").click();
    await platformCard(page, "Sosyal Medya").click();
    await continueButton(page).click();
    await page.getByRole("button", { name: "5.000-20.000 TL" }).click();
    await page.getByRole("button", { name: "Paketi Öner" }).click();
    await expect(page.getByText(/Seçilen platformlar \(Meta, Sosyal Medya\)/)).toBeVisible();
    await expect(page.getByText(/sosyal medya içerik takvimi ve profil optimizasyonu/)).toBeVisible();
  });

  test("mobil genişlikte Platform İhtiyacınız adımı kullanılabilir kalır", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await reachPlatformStep(page);
    await platformCard(page, "Meta").click();
    await expect(platformCard(page, "Meta")).toHaveAttribute("aria-pressed", "true");
    await expect(continueButton(page)).toBeEnabled();
  });
});

test.describe("/api/ai/ad-budget-research - platform normalizasyonu ve kombinasyon davranışı", () => {
  test("eski tekil 'Hepsi' değeri üç kanonik platforma normalize edilir", async ({ request }) => {
    const response = await request.post("/api/ai/ad-budget-research", {
      data: { sector: "Restoran", goal: "Daha Fazla Satış", platform: "Hepsi", budget: "20000" }
    });
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.marketSummary).toContain("Meta, Google, Sosyal Medya");
  });

  test("eski tekil 'meta' string değeri de doğru normalize edilir", async ({ request }) => {
    const response = await request.post("/api/ai/ad-budget-research", {
      data: { sector: "Restoran", goal: "Daha Fazla Satış", platform: "meta", budget: "20000" }
    });
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.marketSummary).toContain("seçilen Meta hizmetlerine");
    expect(data.marketSummary).not.toContain("Google");
  });

  test("AI istek yükü yalnızca seçilen hizmetleri yansıtır: Google + Sosyal Medya, Meta hariç", async ({ request }) => {
    const response = await request.post("/api/ai/ad-budget-research", {
      data: { sector: "Restoran", goal: "Daha Fazla Satış", platforms: ["google", "social-media"], budget: "20000" }
    });
    expect(response.ok()).toBe(true);
    const data = await response.json();
    const labels = data.platformSplit.map((item: { label: string }) => item.label).join(" ");
    expect(labels).toContain("Google");
    expect(labels).toContain("Sosyal");
    expect(labels).not.toContain("Meta");
  });
});
