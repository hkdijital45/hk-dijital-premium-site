import { test, expect, type Page } from "@playwright/test";

/**
 * /teklif-al (Dijital Pazarlama Ön Analizi) — "Diğer" custom business-sector requirement.
 * Public route, no auth required. Covers reveal/validation of the manual sector
 * field, category switching, back/forward persistence, the resolved category
 * reaching the /api/leads payload, and the /api/leads server-side rejection of
 * a generic sector value.
 */

type LeadPayload = { businessType?: string; [key: string]: unknown };

async function interceptLeadSubmission(page: Page) {
  let capturedBody: LeadPayload | null = null;
  await page.route("**/api/leads", async (route) => {
    capturedBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, lead: { id: "test" } }) });
  });
  return () => capturedBody;
}

// The wizard is the 7-step Dijital Pazarlama Ön Analizi (İşletme → Hedef →
// Platform → Bütçe → İhtiyaç → Analiz → İletişim). The old package
// recommendation step ("Paketi Öner" / "Bilgilerimi Bırakayım") was removed
// on purpose — teklif-al-platform-multiselect.spec.ts and
// teklif-al-custom-sector-differentiation.spec.ts assert those labels are
// absent — so this walks the same real path a visitor takes today.
async function completeStepsThroughAnalysis(page: Page) {
  await page.getByRole("button", { name: "Daha Fazla Mesaj" }).click();
  await page.getByTestId("platform-card-meta").click();
  await page.getByTestId("platform-continue").click();
  await page.getByRole("button", { name: "5.000-20.000 TL" }).click();
  await expect(page.getByRole("heading", { name: "Operasyon İhtiyacınız" })).toBeVisible();
  await page.getByRole("button", { name: "Analizi Görüntüle" }).click();
  await expect(page.getByRole("heading", { name: "Dijital Pazarlama Ön Analiziniz" })).toBeVisible();
  await page.getByRole("button", { name: "İletişim Bilgilerine Geç" }).click();
  await expect(page.getByRole("heading", { name: "Analizinizi Tamamlayın" })).toBeVisible();
}

async function fillContactAndSubmit(page: Page) {
  await page.getByLabel(/Ad Soyad/).fill("Test Kullanıcı");
  await page.getByLabel(/Firma Adı/).fill("Test Firma");
  await page.getByLabel(/E-posta/).fill("test@example.com");
  await page.getByRole("textbox", { name: /Telefon/ }).fill("5551234567");
  await page.getByRole("button", { name: "Analizimi Gönder" }).click();
}

test.describe("/teklif-al - İşletme Türü adımı: özel sektör", () => {
  test("Diğer seçilince manuel sektör alanı görünür ve Devam devre dışıdır", async ({ page }) => {
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Diğer/ }).click();
    await expect(page.getByLabel("İşletme sektörünüzü yazın")).toBeVisible();
    await expect(page.getByRole("button", { name: "Devam" })).toBeDisabled();
  });

  test("boş alanla Devam devre dışı kalır", async ({ page }) => {
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Diğer/ }).click();
    await expect(page.getByRole("button", { name: "Devam" })).toBeDisabled();
  });

  test("sadece boşluk içeren değerle Devam devre dışı kalır", async ({ page }) => {
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Diğer/ }).click();
    await page.getByLabel("İşletme sektörünüzü yazın").fill("   ");
    await expect(page.getByRole("button", { name: "Devam" })).toBeDisabled();
  });

  test("geçerli özel sektör girilince Devam aktifleşir ve bir sonraki adıma geçer", async ({ page }) => {
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Diğer/ }).click();
    await page.getByLabel("İşletme sektörünüzü yazın").fill("Oto Servis");
    const devam = page.getByRole("button", { name: "Devam" });
    await expect(devam).toBeEnabled();
    await devam.click();
    await expect(page.getByRole("heading", { name: "Ana Hedefiniz" })).toBeVisible();
  });

  test("Enter tuşu geçersizken adımı atlamaz", async ({ page }) => {
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Diğer/ }).click();
    const input = page.getByLabel("İşletme sektörünüzü yazın");
    await input.fill("a");
    await input.press("Enter");
    await expect(page.getByRole("heading", { name: "İşletme Türünüz" })).toBeVisible();
  });

  test("geri ve ileri gidildiğinde girilen özel sektör korunur", async ({ page }) => {
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Diğer/ }).click();
    await page.getByLabel("İşletme sektörünüzü yazın").fill("Hukuk Bürosu");
    await page.getByRole("button", { name: "Devam" }).click();
    await expect(page.getByRole("heading", { name: "Ana Hedefiniz" })).toBeVisible();
    await page.getByRole("button", { name: "Geri" }).click();
    await expect(page.getByLabel("İşletme sektörünüzü yazın")).toHaveValue("Hukuk Bürosu");
    await expect(page.getByRole("button", { name: "Devam" })).toBeEnabled();
  });

  test("Diğer'den önceden tanımlı bir kategoriye geçince manuel alan kaybolur ve önceki değer yok sayılır", async ({ page }) => {
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Diğer/ }).click();
    await page.getByLabel("İşletme sektörünüzü yazın").fill("Mobilya Mağazası");
    await page.getByRole("button", { name: "Kafe" }).click();
    await expect(page.getByRole("heading", { name: "Ana Hedefiniz" })).toBeVisible();
    await page.getByRole("button", { name: "Geri" }).click();
    await expect(page.getByLabel("İşletme sektörünüzü yazın")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Kafe" })).toHaveAttribute("aria-pressed", "true");
  });

  test("önceden tanımlı kategori seçiminde regresyon yok: kart tıklanınca hemen ilerler", async ({ page }) => {
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Restoran" }).click();
    await expect(page.getByRole("heading", { name: "Ana Hedefiniz" })).toBeVisible();
  });

  test("çözümlenmiş kategori /api/leads isteğine ulaşır (özel sektör)", async ({ page }) => {
    const getBody = await interceptLeadSubmission(page);
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Diğer/ }).click();
    await page.getByLabel("İşletme sektörünüzü yazın").fill("  Güzellik   Merkezi  ");
    await page.getByRole("button", { name: "Devam" }).click();
    await completeStepsThroughAnalysis(page);
    await fillContactAndSubmit(page);
    await expect.poll(() => getBody()).not.toBeNull();
    expect(getBody()?.businessType).toBe("Güzellik Merkezi");
  });

  test("çözümlenmiş kategori /api/leads isteğine ulaşır (önceden tanımlı sektör)", async ({ page }) => {
    const getBody = await interceptLeadSubmission(page);
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Sağlık" }).click();
    await completeStepsThroughAnalysis(page);
    await fillContactAndSubmit(page);
    await expect.poll(() => getBody()).not.toBeNull();
    expect(getBody()?.businessType).toBe("Sağlık");
  });

  test("mobil genişlikte İşletme Türü adımı ve manuel alan görünür ve kullanılabilir kalır", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Diğer/ }).click();
    const input = page.getByLabel("İşletme sektörünüzü yazın");
    await expect(input).toBeVisible();
    await input.fill("Kuaför");
    await expect(page.getByRole("button", { name: "Devam" })).toBeEnabled();
  });
});

test.describe("/api/leads - sunucu tarafı sektör doğrulaması", () => {
  // /api/leads independently requires a valid email or phone (unrelated to
  // sector validation, checked first). Every payload below must supply one
  // so these tests actually exercise the sector check they claim to verify,
  // rather than incidentally getting a 400 (or missing a real failure) from
  // the earlier contact-info requirement.
  const contact = { email: "qa-sector-test@hkdijital.invalid" };

  test("businessType 'Diğer' olarak gönderilirse 400 döner", async ({ request }) => {
    const response = await request.post("/api/leads", {
      data: { source: "quote", name: "Test", ...contact, businessType: "Diğer", goal: "Daha Fazla Satış", budget: "5.000-20.000 TL" }
    });
    expect(response.status()).toBe(400);
  });

  test("businessType boş string olarak gönderilirse 400 döner", async ({ request }) => {
    const response = await request.post("/api/leads", {
      data: { source: "quote", name: "Test", ...contact, businessType: "   ", goal: "Daha Fazla Satış", budget: "5.000-20.000 TL" }
    });
    expect(response.status()).toBe(400);
  });

  test("geçerli özel businessType ile istek 400 vermez", async ({ request }) => {
    const response = await request.post("/api/leads", {
      data: { source: "quote", name: "Test", ...contact, businessType: "Oto Servis", goal: "Daha Fazla Satış", budget: "5.000-20.000 TL" }
    });
    expect(response.status()).not.toBe(400);
  });
});
