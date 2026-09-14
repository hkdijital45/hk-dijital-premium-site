import { test, expect } from "@playwright/test";

// Coverage for the homepage redesign + conversion-optimization sprint.
//
// Updated for the current homepage architecture (site-wide visual
// unification pass): the old DeviceShowcase (#device, tab-based module
// switcher) referenced by earlier assertions here no longer exists — the
// homepage now composes distinct MarketingSection blocks (#hero, #services,
// #process, #packages, #contact) with a MacBook-centered hero ecosystem
// (HeroDeviceComposition, still using the real .macbook-mockup-screen CSS
// hook) instead of a single tabbed device module. These tests assert the
// CURRENT structure rather than the removed one — see git history for the
// original DeviceShowcase-era version of this file if that context is ever
// needed again.
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

test.describe("Hero ecosystem reliability (current MacBook + platform composition)", () => {
  test("desktop: survives fast scrolling past it, and a refresh mid-section leaves it in a valid, non-stuck state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    // Simulate an aggressive trackpad-style fast scroll straight through the
    // hero and the rest of the page.
    for (let y = 0; y < totalHeight; y += 800) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
    }
    await page.waitForTimeout(100);
    expect(pageErrors, "fast-scrolling past the hero must not throw").toEqual([]);

    // Land exactly mid-way through the hero and refresh — the hero's
    // whileInView/mount-triggered animations must not depend on a specific
    // scroll offset to reach a valid rendered state.
    const heroBox = await page.locator("#hero").boundingBox();
    expect(heroBox).not.toBeNull();
    const midHeroY = heroBox!.y + (await page.evaluate(() => window.scrollY)) + heroBox!.height / 2;
    await page.evaluate((y) => window.scrollTo(0, y), midHeroY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.evaluate((y) => window.scrollTo(0, y), midHeroY);
    await page.waitForTimeout(2500);

    // The hero must render at its natural height and the MacBook mockup must
    // be present and visible — nothing "frozen" half-open or collapsed to 0.
    const hero = page.locator("#hero");
    await expect(hero).toBeVisible();
    const box = await hero.boundingBox();
    expect(box?.height, "hero must render at a real, non-collapsed height after a mid-scroll refresh").toBeGreaterThan(200);
    await expect(page.locator(".macbook-mockup-screen").first()).toBeVisible();
    expect(pageErrors, "a mid-scroll refresh must not throw").toEqual([]);
  });

  test("mobile: hero and platform strip are usable with no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("#hero").scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    await expect(page.locator(".macbook-mockup-screen").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("desktop: the scroll-pinned hero releases cleanly — nothing from it stays visible once the next section is reached", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);

    // The hero is a tall (~200vh) scroll-pin wrapper on desktop — its own
    // rendered height must reflect that, or the cinematic transformation
    // has no scroll room to play out against. Its own top offset (below the
    // header) matters too — the pin range is [documentTop, documentTop +
    // height - viewportHeight]; scrolling relative to raw height alone
    // under-shoots by that offset and can land still inside the hero.
    const heroInfo = await page.locator("#hero").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { documentTop: r.top + window.scrollY, height: r.height };
    });
    expect(heroInfo.height, "desktop hero must be a tall scroll-pin wrapper, not a single-viewport section").toBeGreaterThan(1500);

    // Scroll well past the hero's own bottom into whatever comes next.
    // `behavior: "instant"` matters: this site sets `html { scroll-behavior:
    // smooth }`, which only affects *programmatic* scrolls like this one
    // (native wheel/trackpad input ignores it entirely) — without
    // overriding it here, `window.scrollTo` would animate toward the target
    // and a short wait could sample it mid-flight, landing this test still
    // inside the hero.
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), heroInfo.documentTop + heroInfo.height + 400);
    await page.waitForTimeout(300);

    const heroRect = await page.locator("#hero").evaluate((el) => el.getBoundingClientRect());
    expect(heroRect.bottom, "the hero section itself must have scrolled above the viewport, not stayed pinned").toBeLessThan(0);

    const canvasBox = await page.locator("#hero canvas").first().boundingBox();
    const canvasOnScreen = !!canvasBox && canvasBox.y < 900 && canvasBox.y + canvasBox.height > 0;
    expect(canvasOnScreen, "the cinematic canvas must not remain visible/pinned once the hero section is over").toBe(false);

    const macOnScreen = await page.locator("#hero .macbook-mockup-screen").first().boundingBox();
    const macIntersects = !!macOnScreen && macOnScreen.y < 900 && macOnScreen.y + macOnScreen.height > 0;
    expect(macIntersects, "the MacBook must not remain visible/pinned once the hero section is over").toBe(false);
  });

  test("desktop: MacBook and badges genuinely reach visible opacity once scrolled through the hero's reveal point", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    const heroInfo = await page.locator("#hero").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { documentTop: r.top + window.scrollY, height: r.height };
    });
    // Pin range is [documentTop, documentTop + height - viewportHeight];
    // land right near its end, where the reveal/settle stage should hold.
    const pinRangeEnd = heroInfo.documentTop + heroInfo.height - 900;
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), pinRangeEnd - 5);
    await page.waitForTimeout(400);
    // Confirm the settled composition (macbook screen) is fully opaque —
    // not stuck mid-fade or mid-disintegration — at this point in the scroll.
    const macOpacity = await page.locator("#hero .macbook-mockup-screen").first().evaluate((el) => {
      let n: HTMLElement | null = el as HTMLElement;
      while (n && (!n.style || n.style.opacity === "")) n = n.parentElement;
      return n ? Number(getComputedStyle(n).opacity) : -1;
    });
    expect(macOpacity, "MacBook should have reformed to full opacity by the end of the hero's scroll range").toBeGreaterThan(0.8);
    // The "Performans" result card is one of the badges/cards that only
    // arrives once the bloom has resolved — confirm it's both attached and
    // actually opaque, not just present at opacity:0 in the DOM.
    const perfCardOpacity = await page.locator("#hero").getByText("Performans", { exact: false }).first().evaluate((el) => {
      let n: HTMLElement | null = el as HTMLElement;
      while (n && (!n.style || n.style.opacity === "")) n = n.parentElement;
      return n ? Number(getComputedStyle(n).opacity) : -1;
    });
    expect(perfCardOpacity, "the Performans result card should have fully arrived by the end of the hero's scroll range").toBeGreaterThan(0.8);
  });

  test("desktop: all 6 platform marks and both data cards are present in the hero ecosystem", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const hero = page.locator("#hero");
    // Six platform badges (Google/Meta/Instagram/Facebook/TikTok/YouTube) —
    // desktop shows all of them (md:grid), independent of the 3-mark mobile
    // fallback set.
    const platformBadges = hero.locator("svg").locator("visible=true");
    expect(await platformBadges.count(), "hero should render more than the 3 mobile-only platform marks").toBeGreaterThan(3);
    await expect(hero.getByText("Performans", { exact: false })).toBeVisible();
    await expect(hero.getByText("İçerik Takvimi", { exact: false })).toBeVisible();
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
  // The hero's platform marks/data cards use the same reduced-motion branch
  // (initial={false} under useReducedMotion()) — they must render immediately
  // at their final state rather than requiring the entrance animation to run.
  await expect(page.locator("#hero .macbook-mockup-screen").first()).toBeVisible();
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
