import { test, expect } from "@playwright/test";

// Coverage for the homepage redesign + conversion-optimization sprint.
//
// Performance cleanup update: the hero's previous scroll-pinned (~200vh),
// scroll-scrubbed MacBook video engine (MacBookEcosystem.tsx) has been
// removed entirely — it was a heavy RAF loop + always-fetched video that
// forced a long, semi-scroll-hijacked hero. The hero is now a normal-flow
// section with no scroll listeners at all.
//
// 2026-10-10/11 public-site redesign (commits 28185ba, 2036ddc, 25966a2 —
// see docs/PUBLIC-SITE-REDESIGN-2026-10.md): the hero's raster
// `.hero-poster` image became the HTML/CSS AdOperationsPanel (`.ad-panel`),
// the "Paketini Bul" CTA label became "Ücretsiz Ön Analiz" (still
// /teklif-al), and the homepage was cut to hero → platform strip → one
// discovery area (#kesif) → closing CTA. The packages section and its
// "Bu Paketi Seç" cards moved to /paketler, the contact form to /iletisim.
// These tests assert that CURRENT structure — the same user journeys, on
// the pages where they live now.

// WhatsApp CTAs render only for a real configured number: placeholder
// numbers are rejected so a CTA is hidden instead of pointing at a fake one
// (src/lib/public-contact.ts). NEXT_PUBLIC_WHATSAPP_NUMBER wins over the
// admin-configured value and is inlined at build time; CI's e2e job sets a
// dedicated non-dialable test number so the configured state is exercised.
const CONFIGURED_WHATSAPP_DIGITS = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");
const PLACEHOLDER_WHATSAPP_DIGITS = "905550000000";
// Without the env number and without Supabase the site falls back to the
// bundled default content, which has no WhatsApp number — so no CTA at all.
const WHATSAPP_EXPECTED_HIDDEN = !CONFIGURED_WHATSAPP_DIGITS && !process.env.NEXT_PUBLIC_SUPABASE_URL;

test.describe("Ücretsiz Ön Analiz CTA visibility", () => {
  test("appears in the header, hero and closing CTA, and packages are one click away", async ({ page }) => {
    // The header CTA only renders in the desktop nav (hidden lg:flex) — its
    // mobile-menu equivalent is covered by the dedicated mobile-menu test
    // below, so force a desktop viewport here regardless of which Playwright
    // project (including mobile emulation) runs this file.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const headerCta = page.locator("header").getByRole("link", { name: "Ücretsiz Ön Analiz" });
    await expect(headerCta).toBeVisible();
    await expect(headerCta).toHaveAttribute("href", "/teklif-al");

    const heroCta = page.locator("#hero").getByRole("link", { name: "Ücretsiz Ön Analiz" });
    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveAttribute("href", "/teklif-al");

    const closingCta = page.locator("main section", { hasText: "Reklamınızı Büyümeye Çevirin" }).getByRole("link", { name: "Ücretsiz Ön Analiz" });
    await closingCta.scrollIntoViewIfNeeded();
    await expect(closingCta).toBeVisible();
    await expect(closingCta).toHaveAttribute("href", "/teklif-al");

    const packagesLink = page.locator("#kesif").getByRole("link", { name: /Paketler/ });
    await packagesLink.scrollIntoViewIfNeeded();
    await expect(packagesLink).toBeVisible();
    await expect(packagesLink).toHaveAttribute("href", "/paketler");
  });

  test("mobile: menu exposes Nasıl Çalışıyoruz link plus the Ücretsiz Ön Analiz CTA (and WhatsApp only when configured)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Menüyü aç").click();
    const menu = page.locator("#mobile-public-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Nasıl Çalışıyoruz" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Ücretsiz Ön Analiz" })).toHaveAttribute("href", "/teklif-al");
    const whatsapp = menu.getByRole("link", { name: /WhatsApp/i });
    if (CONFIGURED_WHATSAPP_DIGITS) {
      await expect(whatsapp).toBeVisible();
      await expect(whatsapp).toHaveAttribute("href", new RegExp(`^https://wa\\.me/${CONFIGURED_WHATSAPP_DIGITS}(\\?|$)`));
    } else if (WHATSAPP_EXPECTED_HIDDEN) {
      await expect(whatsapp).toHaveCount(0);
    }
  });
});

test("package card deep-links to /teklif-al with the correct package slug (from /paketler)", async ({ page }) => {
  await page.goto("/paketler", { waitUntil: "domcontentloaded" });
  const link = page.getByRole("link", { name: "Bu Paketi Seç" }).first();
  const href = await link.getAttribute("href");
  expect(href, "package card must deep-link with a ?paket= slug").toMatch(/^\/teklif-al\?paket=[a-z0-9-]+$/);

  await link.click();
  await page.waitForURL(/\/teklif-al\?paket=/);
  const response = await page.request.get(page.url());
  expect(response.status()).toBeLessThan(400);
  await expect(page.getByRole("heading", { name: "İşletme Türünüz" })).toBeVisible();
});

test("WhatsApp CTAs across the homepage all point to the same configured number", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const hrefs = await page.locator("a", { hasText: "WhatsApp" }).evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).getAttribute("href")).filter((href): href is string => Boolean(href) && href !== "/iletisim")
  );
  for (const href of hrefs) {
    expect(href, "a WhatsApp CTA must never point at the placeholder number").not.toContain(PLACEHOLDER_WHATSAPP_DIGITS);
  }
  if (CONFIGURED_WHATSAPP_DIGITS) {
    expect(hrefs.length, "homepage should expose at least one real WhatsApp link").toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href, "every WhatsApp CTA must use the configured number").toMatch(new RegExp(`^https://wa\\.me/${CONFIGURED_WHATSAPP_DIGITS}(\\?|$)`));
    }
  } else if (WHATSAPP_EXPECTED_HIDDEN) {
    expect(hrefs, "with no WhatsApp number configured, no WhatsApp CTA may render").toEqual([]);
  }
  const unique = new Set(hrefs);
  expect(unique.size, `all WhatsApp CTAs must point to the same number, got: ${[...unique].join(", ")}`).toBeLessThanOrEqual(1);
});

test.describe("Hero reliability (normal-flow, static ad-operations panel — no scroll-pin engine)", () => {
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
    await expect(page.locator("#hero .ad-panel").first()).toBeVisible();
    expect(pageErrors, "a mid-scroll refresh must not throw").toEqual([]);
  });

  test("mobile: hero is usable with no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("#hero").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await expect(page.locator("#hero .ad-panel").first()).toBeVisible();
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
  //
  // Since the 2026-10 redesign the sections themselves are plain <section>s
  // and the fade-in lives on the MarketingReveal wrappers inside them — the
  // only homepage elements with an inline (framer-motion) opacity — so every
  // one of those is scrolled to and must end up fully visible.
  const sections = page.locator("main section");
  const sectionIds = await sections.evaluateAll((els) => els.map((el) => el.id).filter(Boolean));
  expect(sectionIds, "the homepage's hero and discovery sections must exist").toEqual(expect.arrayContaining(["hero", "kesif"]));
  expect(await sections.count(), "hero, platform strip, discovery and closing CTA").toBeGreaterThanOrEqual(4);

  const reveals = page.locator('main [style*="opacity"]');
  const revealCount = await reveals.count();
  expect(revealCount, "the homepage must still use scroll-reveal wrappers").toBeGreaterThan(0);
  for (let index = 0; index < revealCount; index += 1) {
    const reveal = reveals.nth(index);
    await reveal.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => Number(await reveal.evaluate((el) => getComputedStyle(el).opacity)), {
        message: `reveal #${index} must become visible once scrolled into view under prefers-reduced-motion, not stay stuck invisible`,
        timeout: 2000
      })
      .toBeCloseTo(1, 1);
  }
  // The hero's ad-operations panel renders identically regardless of
  // prefers-reduced-motion.
  await expect(page.locator("#hero .ad-panel").first()).toBeVisible();
  await context.close();
});

test("contact form (now on /iletisim) sends a contact request via /api/leads", async ({ page }) => {
  // The homepage no longer embeds a contact form (Phase 2 IA simplification);
  // the one real form lives on /iletisim and submits `source: "contact"`,
  // which the API stores as a contact request (contact_forms), not a lead.
  // The request is intercepted so the test never writes a real request into
  // a production database; the API's own validation is covered separately
  // (teklif-al-custom-sector.spec.ts's /api/leads tests, unit tests).
  let capturedBody: Record<string, unknown> | null = null;
  await page.route("**/api/leads", async (route) => {
    capturedBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/iletisim", { waitUntil: "domcontentloaded" });
  const form = page.locator("form", { has: page.locator('textarea[name="note"]') });
  await form.scrollIntoViewIfNeeded();

  await form.locator('input[name="name"]').fill("QA İletişim Testi");
  await form.locator('input[name="email"]').fill("qa-iletisim@example.test");
  await form.locator('input[name="phone"]').fill("5551234567");
  await form.locator('input[name="company"]').fill("QA Test Firması");
  await form.locator('textarea[name="note"]').fill("Playwright iletişim formu regresyon testi.");
  await form.getByRole("button", { name: "Gönder" }).click();

  await expect.poll(() => capturedBody).not.toBeNull();
  expect(capturedBody).toMatchObject({
    source: "contact",
    name: "QA İletişim Testi",
    email: "qa-iletisim@example.test",
    phone: "5551234567",
    company: "QA Test Firması",
    note: "Playwright iletişim formu regresyon testi."
  });
  await expect(form.getByText("Mesajınız alındı.", { exact: false })).toBeVisible();
});
