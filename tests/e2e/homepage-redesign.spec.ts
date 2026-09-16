import { test, expect } from "@playwright/test";

// Coverage for the homepage redesign + conversion-optimization sprint.
//
// Performance cleanup update: the hero's previous scroll-pinned (~200vh),
// scroll-scrubbed MacBook video engine (MacBookEcosystem.tsx) has been
// removed entirely — it was a heavy RAF loop + always-fetched video that
// forced a long, semi-scroll-hijacked hero. The hero is now a normal-flow
// section with a single static `.hero-poster` <Image> and no scroll
// listeners at all. These tests assert the CURRENT lightweight structure —
// see git history for earlier versions of this file if that context is
// ever needed again.
test.describe("Paket Seçme Robotu CTA visibility", () => {
  test("appears in the header, hero, and packages section", async ({ page }) => {
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

    const packagesLink = page.locator("#packages").getByRole("link", { name: /Tüm paketleri görüntüle/i });
    await expect(packagesLink).toBeVisible();
    await expect(packagesLink).toHaveAttribute("href", "/paketler");
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
  const link = page.locator("#packages").getByRole("link", { name: "Bu Paketi Seç" }).first();
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

test.describe("Hero reliability (normal-flow, static poster — no scroll-pin engine)", () => {
  test("desktop: survives fast scrolling past it, and a refresh mid-section leaves it in a valid, non-stuck state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < totalHeight; y += 800) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
    }
    await page.waitForTimeout(100);
    expect(pageErrors, "fast-scrolling past the hero must not throw").toEqual([]);

    const heroBox = await page.locator("#hero").boundingBox();
    expect(heroBox).not.toBeNull();
    const midHeroY = heroBox!.y + (await page.evaluate(() => window.scrollY)) + heroBox!.height / 2;
    await page.evaluate((y) => window.scrollTo(0, y), midHeroY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.evaluate((y) => window.scrollTo(0, y), midHeroY);
    await page.waitForTimeout(500);

    const hero = page.locator("#hero");
    await expect(hero).toBeVisible();
    const box = await hero.boundingBox();
    // A normal-flow hero renders at its natural (single-viewport-ish)
    // content height — no more ~200vh scroll-pin wrapper.
    expect(box?.height, "hero must render at a real, non-collapsed height after a mid-scroll refresh").toBeGreaterThan(200);
    expect(box?.height, "hero must no longer be a tall scroll-pin wrapper").toBeLessThan(1400);
    await expect(page.locator(".hero-poster").first()).toBeVisible();
    expect(pageErrors, "a mid-scroll refresh must not throw").toEqual([]);
  });

  test("mobile: hero is usable with no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("#hero").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await expect(page.locator(".hero-poster").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("desktop: hero is a normal-flow section, not a scroll-pinned/sticky one", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);

    const heroInfo = await page.locator("#hero").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { documentTop: r.top + window.scrollY, height: r.height };
    });
    // Performance cleanup: the hero is no longer a ~200vh scroll-pin
    // wrapper — it must render close to natural content height.
    expect(heroInfo.height, "hero must be a normal-flow section, not a tall scroll-pin wrapper").toBeLessThan(1400);

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), heroInfo.documentTop + heroInfo.height + 400);
    await page.waitForTimeout(300);

    const heroRect = await page.locator("#hero").evaluate((el) => el.getBoundingClientRect());
    expect(heroRect.bottom, "the hero section itself must have scrolled above the viewport").toBeLessThan(0);

    // No video element should exist anywhere on the page — the old
    // scroll-scrubbed MacBook video engine was removed entirely.
    expect(await page.locator("video").count(), "no <video> element should remain on the homepage").toBe(0);
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
  for (const id of ["hero", "services", "process", "packages", "contact"]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const opacity = await page.locator(`#${id}`).evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity), `#${id} must reveal once scrolled into view under prefers-reduced-motion, not stay stuck invisible`).toBeCloseTo(1, 1);
  }
  // The hero's static poster image renders identically regardless of
  // prefers-reduced-motion (it was never animated to begin with).
  await expect(page.locator("#hero .hero-poster").first()).toBeVisible();
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
