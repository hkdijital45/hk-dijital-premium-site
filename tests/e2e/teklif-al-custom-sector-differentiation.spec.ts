import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "crypto";

// The /api/ai/ad-budget-research route rate-limits per x-forwarded-for,
// falling back to a shared "anonymous" bucket when the header is absent
// (which is what both direct API calls and browser-driven fetches from
// Playwright do by default). Without isolating each test onto its own
// synthetic client IP, every test hitting this endpoint across the whole
// suite collapses into one bucket and trips the production abuse-prevention
// limit (6 requests / 10 minutes) well before a full run finishes. Page-level
// requests are given a unique IP via route interception; direct API calls
// get it via a request header — neither touches the production rate limiter
// itself.
async function isolateAdBudgetRateLimit(page: Page) {
  const clientIp = `qa-test-${randomUUID()}`;
  await page.route("**/api/ai/ad-budget-research", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": clientIp } })
  );
}

/**
 * /teklif-al (Paket Öneri Robotu) — production verification for custom
 * ("Diğer") sector differentiation. Confirms that two different custom
 * sectors, with every other wizard answer identical, produce genuinely
 * sector-specific reasoning/risk/extra-service output (not just the sector
 * name swapped into an otherwise generic response), that the "Bütçe Analizi
 * Oluştur" button always reflects the *current* sector (no stale-state
 * reuse across back/forward navigation), and that /api/ai/ad-budget-research
 * itself rejects generic sector values.
 */

const OTO_SERVIS = "Oto Servis";
const GUZELLIK_MERKEZI = "Güzellik Merkezi";

async function enterCustomSector(page: Page, sector: string) {
  await page.getByRole("button", { name: /Diğer/ }).click();
  const input = page.getByLabel("İşletme sektörünüzü yazın");
  await input.fill(sector);
  await page.getByRole("button", { name: "Devam" }).click();
}

async function ensurePlatformSelected(page: Page, testId: string) {
  const card = page.getByTestId(testId);
  // These are toggle buttons (aria-pressed), and this helper is invoked twice
  // per test in the back/forward regression case below, re-entering steps
  // that already hold pass-1 selections. Clicking unconditionally would
  // toggle an already-selected platform back off.
  if ((await card.getAttribute("aria-pressed")) !== "true") await card.click();
}

async function completeToRecommendation(page: Page) {
  await page.getByRole("button", { name: "Daha Fazla Satış" }).click();
  await ensurePlatformSelected(page, "platform-card-meta");
  await ensurePlatformSelected(page, "platform-card-google");
  await page.getByTestId("platform-continue").click();
  await page.getByRole("button", { name: "5.000-20.000 TL" }).click();
  await page.getByRole("button", { name: "Paketi Öner" }).click();
  await expect(page.getByText("Önerilen Paket")).toBeVisible();
}

async function goBack(page: Page, times: number) {
  for (let i = 0; i < times; i += 1) {
    await page.getByRole("button", { name: "Geri" }).click();
  }
}

test.describe("/teklif-al - özel sektör farklılaştırma doğrulaması", () => {
  test("Oto Servis: reasoning görsel olarak sektöre özgü ipuçları içerir", async ({ page }) => {
    await isolateAdBudgetRateLimit(page);
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await enterCustomSector(page, OTO_SERVIS);
    await completeToRecommendation(page);
    // Both the package-choice reasoning and the AI-budget reasoning blocks
    // legitimately mention the sector name, so .first() avoids a strict-mode
    // ambiguity — we only need to confirm it renders somewhere.
    await expect(page.getByText(new RegExp(OTO_SERVIS)).first()).toBeVisible();
    // Deterministic risk note appended to adBudget.notes (rendered under
    // "Dikkat Edilmesi Gerekenler") must reflect the local-high-intent
    // profile, not a generic list reused for every sector.
    await expect(page.getByText(/Google puanı/)).toBeVisible();
  });

  test("Güzellik Merkezi: reasoning görsel olarak farklı, sektöre özgü ipuçları içerir", async ({ page }) => {
    await isolateAdBudgetRateLimit(page);
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await enterCustomSector(page, GUZELLIK_MERKEZI);
    await completeToRecommendation(page);
    await expect(page.getByText(new RegExp(GUZELLIK_MERKEZI)).first()).toBeVisible();
    await expect(page.getByText(/izin ve etik/)).toBeVisible();
    // Must NOT show the other sector's risk note.
    await expect(page.getByText(/Google puanı/)).not.toBeVisible();
  });

  test("Bütçe Analizi Oluştur: sektör değiştirilip geri/ileri gidildiğinde ikinci analiz doğru (güncel) sektörü yansıtır, önceki sektörü değil", async ({ page }) => {
    test.setTimeout(45_000);
    await isolateAdBudgetRateLimit(page);
    await page.goto("/teklif-al", { waitUntil: "domcontentloaded" });
    await enterCustomSector(page, OTO_SERVIS);
    await completeToRecommendation(page);

    const generateButton = page.getByRole("button", { name: /Bütçe Analizi Oluştur/ });
    await generateButton.click();
    await expect(page.getByText(new RegExp(OTO_SERVIS)).first()).toBeVisible({ timeout: 15_000 });
    // Button must be disabled once an analysis exists — prevents duplicate
    // simultaneous requests / reuse-by-reclick.
    await expect(page.getByRole("button", { name: "Analiz hazır" })).toBeDisabled();

    // Navigate back to the business-type step (5 steps back: recommendation
    // → needs → budget → platform → goal → business type) and switch the
    // custom sector while keeping every other answer identical.
    await goBack(page, 5);
    await expect(page.getByLabel("İşletme sektörünüzü yazın")).toHaveValue(OTO_SERVIS);
    await page.getByLabel("İşletme sektörünüzü yazın").fill(GUZELLIK_MERKEZI);
    await page.getByRole("button", { name: "Devam" }).click();
    await completeToRecommendation(page);

    // A brand-new Recommendation component instance mounts here (the whole
    // step 5 subtree is conditionally rendered), so aiBudget state must be
    // fresh — no leftover "Analiz hazır" from the Oto Servis run.
    const secondGenerateButton = page.getByRole("button", { name: /Bütçe Analizi Oluştur/ });
    await expect(secondGenerateButton).toBeVisible();
    await secondGenerateButton.click();
    await expect(page.getByText(new RegExp(GUZELLIK_MERKEZI)).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Google puanı/)).not.toBeVisible();
  });
});

test.describe("/api/ai/ad-budget-research - sektör farklılaştırma ve doğrulama", () => {
  const baseBody = { goal: "Daha Fazla Satış", platforms: ["meta", "google"], budget: "20000", contentNeed: "medium", urgency: "this_month", socialStatus: "irregular" };

  test("Oto Servis ve Güzellik Merkezi için aynı diğer cevaplarla anlamlı farklı çıktı üretir", async ({ request }) => {
    const [otoRes, guzellikRes] = await Promise.all([
      request.post("/api/ai/ad-budget-research", {
        headers: { "x-forwarded-for": `qa-test-${randomUUID()}` },
        data: { ...baseBody, sector: OTO_SERVIS }
      }),
      request.post("/api/ai/ad-budget-research", {
        headers: { "x-forwarded-for": `qa-test-${randomUUID()}` },
        data: { ...baseBody, sector: GUZELLIK_MERKEZI }
      })
    ]);
    expect(otoRes.ok()).toBe(true);
    expect(guzellikRes.ok()).toBe(true);
    const oto = await otoRes.json();
    const guzellik = await guzellikRes.json();

    expect(oto.marketSummary).toContain(OTO_SERVIS);
    expect(guzellik.marketSummary).toContain(GUZELLIK_MERKEZI);
    expect(oto.marketSummary).not.toEqual(guzellik.marketSummary);

    // Not sharing stale state across concurrent requests.
    expect(oto.marketSummary).not.toContain(GUZELLIK_MERKEZI);
    expect(guzellik.marketSummary).not.toContain(OTO_SERVIS);

    // Meaningful differentiation beyond the sector name: risk text and
    // extra-service suggestions must differ.
    expect(oto.risks.join(" ")).not.toEqual(guzellik.risks.join(" "));
    expect(oto.extraServiceSuggestions).not.toEqual(guzellik.extraServiceSuggestions);

    // Platform allocation must lean toward the channel the actual sector
    // suits (Oto Servis -> Google, Güzellik Merkezi -> Meta) for the exact
    // same selected platforms.
    const percentFor = (data: typeof oto, prefix: string) => data.platformSplit.find((item: { label: string }) => item.label.startsWith(prefix))?.percent ?? 0;
    expect(percentFor(oto, "Google")).toBeGreaterThan(percentFor(guzellik, "Google"));
    expect(percentFor(guzellik, "Meta")).toBeGreaterThan(percentFor(oto, "Meta"));
  });

  test("boş, 'Diğer', 'other' ve yalnızca boşluk sektör değerlerini 400 ile reddeder", async ({ request }) => {
    const clientIp = `qa-test-${randomUUID()}`;
    for (const sector of ["", "Diğer", "other", "   "]) {
      const response = await request.post("/api/ai/ad-budget-research", {
        headers: { "x-forwarded-for": clientIp },
        data: { ...baseBody, sector }
      });
      expect(response.status(), `sector=${JSON.stringify(sector)}`).toBe(400);
    }
  });

  test("geçerli özel sektör 400 vermez", async ({ request }) => {
    const response = await request.post("/api/ai/ad-budget-research", {
      headers: { "x-forwarded-for": `qa-test-${randomUUID()}` },
      data: { ...baseBody, sector: OTO_SERVIS }
    });
    expect(response.status()).not.toBe(400);
  });
});
