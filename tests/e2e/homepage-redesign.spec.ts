import { test, expect } from "@playwright/test";

// Coverage for the homepage redesign + conversion-optimization sprint.
//
// Context for the device-section tests: the previous ScrollScrubStage tied a
// MacBook screen's opening animation to scroll progress inside a 350vh
// position:sticky container. Because the public <main> wrapper (Shell.tsx)
// sets overflow-hidden, sticky elements inside it lose their viewport-based
// containing block — the "pinned" stage could freeze mid-open, disagree with
// reality after a refresh at a mid-scroll offset, and burned ~3.5 screens of
// scroll height on very little content (root cause of the "feels empty" /
// "device gets stuck" complaints). DeviceShowcase.tsx replaces it with a
// normal-flow, whileInView-revealed section where the active module rotates
// on a plain setInterval — nothing here is scroll-linked, so there is no
// scroll trap and no stuck state to test for; these tests assert that.
test.describe("Paket Seçme Robotu CTA visibility", () => {
  test("appears in the header, hero, packages section, and final CTA", async ({ page }) => {
    // The header's "Paketini Bul" button only renders in the desktop nav
    // (hidden lg:flex) — its mobile-menu equivalent is covered by the
    // dedicated mobile-menu test below, so force a desktop viewport here
    // regardless of which Playwright project (including mobile emulation)
    // runs this file.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const headerCta = page.locator("header").getByRole("link", { name: /Paketini Bul/i });
    await expect(headerCta).toBeVisible();
    await expect(headerCta).toHaveAttribute("href", "/teklif-al");

    const heroCta = page.locator("#hero").getByRole("link", { name: /Paketini Bul/i });
    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveAttribute("href", "/teklif-al");

    const packagesCta = page.locator("#packages").getByRole("link", { name: /Paket Seçme Robotunu Başlat/i });
    await expect(packagesCta).toBeVisible();
    await expect(packagesCta).toHaveAttribute("href", "/teklif-al");

    const robotSection = page.locator("#paket-robotu").getByRole("link", { name: /Paket Seçme Robotunu Başlat/i });
    await expect(robotSection).toBeVisible();
    await expect(robotSection).toHaveAttribute("href", "/teklif-al");
  });

  test("mobile: menu exposes Nasıl Çalışıyoruz link plus both WhatsApp and Paketini Bul CTAs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Menüyü aç").click();
    const menu = page.locator("#mobile-public-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Nasıl Çalışıyoruz" })).toBeVisible();
    await expect(menu.getByRole("link", { name: /Paketini Bul/i })).toHaveAttribute("href", "/teklif-al");
    await expect(menu.getByRole("link", { name: /WhatsApp/i })).toBeVisible();
  });
});

test("package card deep-links to /teklif-al with the correct package slug", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const firstCard = page.locator("#packages [role='tabpanel'] > div").first();
  const link = firstCard.getByRole("link", { name: "Bu Paketi Seç" });
  const href = await link.getAttribute("href");
  expect(href, "package card must deep-link with a ?paket= slug").toMatch(/^\/teklif-al\?paket=[a-z0-9-]+$/);

  await link.click();
  await page.waitForURL(/\/teklif-al\?paket=/);
  const response = await page.request.get(page.url());
  expect(response.status()).toBeLessThan(400);
});

test("WhatsApp CTAs across the homepage all point to the same configured number", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const hrefs = await page.locator("a", { hasText: "WhatsApp" }).evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).getAttribute("href")).filter((href): href is string => Boolean(href) && href !== "/iletisim")
  );
  expect(hrefs.length, "homepage should expose at least one real WhatsApp link").toBeGreaterThan(0);
  const unique = new Set(hrefs);
  expect(unique.size, `all WhatsApp CTAs must point to the same number, got: ${[...unique].join(", ")}`).toBe(1);
});

test.describe("Device showcase reliability (replaces the old scroll-jacked stage)", () => {
  test("desktop: survives fast scrolling past it, and a refresh mid-section leaves it in a valid, non-stuck state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    // Simulate an aggressive trackpad-style fast scroll straight through the
    // device section and the rest of the page.
    for (let y = 0; y < totalHeight; y += 800) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
    }
    await page.waitForTimeout(100);
    expect(pageErrors, "fast-scrolling past the device section must not throw").toEqual([]);

    // Land exactly mid-way through the device section and refresh — this is
    // exactly the scenario the old sticky/350vh stage could not survive.
    const deviceBox = await page.locator("#device").boundingBox();
    expect(deviceBox).not.toBeNull();
    const midDeviceY = deviceBox!.y + (await page.evaluate(() => window.scrollY)) + deviceBox!.height / 2;
    await page.evaluate((y) => window.scrollTo(0, y), midDeviceY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.evaluate((y) => window.scrollTo(0, y), midDeviceY);
    await page.waitForTimeout(300);

    // The section must render at its natural height and the mockup must be
    // present and visible — nothing "frozen" half-open or collapsed to 0.
    const device = page.locator("#device");
    await expect(device).toBeVisible();
    const box = await device.boundingBox();
    expect(box?.height, "device section must render at a real, non-collapsed height after a mid-scroll refresh").toBeGreaterThan(200);
    await expect(page.locator(".macbook-mockup-screen").first()).toBeVisible();
    expect(pageErrors, "a mid-scroll refresh must not throw").toEqual([]);
  });

  test("mobile: device module list and mockup are usable with no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("#device").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await expect(page.locator("#device").getByRole("tab", { name: /Müşteri Yönetimi/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("clicking a module switches the active screen without scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("#device").scrollIntoViewIfNeeded();
    const reportingTab = page.locator("#device").getByRole("tab", { name: /Raporlama/ });
    await reportingTab.click();
    await expect(reportingTab).toHaveAttribute("aria-selected", "true");
  });
});

test("homepage has no horizontal overflow at 1920px", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("reduced motion: every section reliably reveals as it's scrolled to, none stay stuck invisible", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });

  // Regression coverage for a real bug this sprint found: SectionShell used
  // to pick between two different `initial`/`whileInView` prop values based
  // on a local `useReducedMotion()` read. That hook resolves asynchronously
  // (it's null on the very first render, since prefers-reduced-motion can
  // only be read client-side) — so a reduced-motion section would mount
  // with the animated `initial={opacity:0}` already applied, then
  // `whileInView` flipped to `undefined` once the hook caught up, leaving
  // the section permanently invisible with nothing left to animate it in,
  // even after scrolling directly to it. The fix wraps the homepage in
  // <MotionConfig reducedMotion="user"> instead, which still lets
  // whileInView fire on scroll and only removes the transition duration.
  for (const id of ["services", "process", "device", "packages", "contact"]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const opacity = await page.locator(`#${id}`).evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity), `#${id} must reveal once scrolled into view under prefers-reduced-motion, not stay stuck invisible`).toBeCloseTo(1, 1);
  }
  await expect(page.locator("#device").getByRole("tab", { name: /Müşteri Yönetimi/ })).toHaveAttribute("aria-selected", "true");
  await context.close();
});

test("contact form creates a real lead via /api/leads", async ({ page }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!supabaseUrl || !serviceKey, "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not supplied in this environment.");

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const contact = page.locator("#contact");
  await contact.scrollIntoViewIfNeeded();

  const unique = `${Date.now()}`;
  await contact.locator('input[name="name"]').fill(`QA-Homepage-Lead-${unique}`);
  await contact.locator('input[name="email"]').fill(`qa-homepage-lead-${unique}@example.test`);
  await contact.locator('input[name="phone"]').fill("5551234567");
  await contact.locator('input[name="company"]').fill("QA Test Firması");
  await contact.locator('textarea[name="note"]').fill("Playwright homepage redesign regression test.");

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/leads") && res.request().method() === "POST"),
    contact.getByRole("button", { name: "Gönder" }).click()
  ]);
  expect(response.ok(), "contact form submission must succeed").toBeTruthy();
  const body = await response.json();
  expect(body.ok).toBeTruthy();
  await expect(contact.getByText("Mesajınız alındı.", { exact: false })).toBeVisible();

  if (body.lead?.id) {
    await fetch(`${supabaseUrl}/rest/v1/leads?id=eq.${body.lead.id}`, {
      method: "DELETE",
      headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` }
    });
  }
});
