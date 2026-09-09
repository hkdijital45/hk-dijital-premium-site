import { test, expect, type Page } from "@playwright/test";
import { gotoAsQaAdmin, hasQaAdminCredentials, qaAdminStorageState, qaSkipReason } from "./fixtures/qa-auth";

// Regression coverage for a verified, app-wide production defect: a global
// admin CSS rule (`.hk-admin .text-xs`/`.font-black`/`p`/`span`/etc.
// { color: ...!important }`, meant to fix components that hardcode
// light-on-dark text colors) was unconditionally defeating ANY element's own
// inline or class-based color the instant it also carried a plain
// size/weight utility class (text-xs, text-[10px], font-black, font-bold) —
// with no way for that color to win back. Confirmed live on
// /hk-admin/iletisim-merkezi: a selected tab's teal background (rgb(11, 122,
// 136)) rendered with forced gray text (rgb(95, 102, 114)) despite an
// explicit inline `color: #fff`.
//
// Fixed at the source (globals.css) via a --hk-force-text-color escape hatch
// plus an explicit exemption for Tailwind arbitrary-value color classes
// (text-[#hex] / text-[var(...)]) — see AdminTabs.tsx and
// CustomerCommunicationCenter.tsx's CommunicationModeSwitch for the two
// confirmed-affected shared components this checks against real computed
// styles (not class/style presence, which would not have caught the bug).
test.use({ storageState: qaAdminStorageState });

test.beforeEach(() => {
  test.skip(!hasQaAdminCredentials(), qaSkipReason);
});

function relativeLuminance([r, g, b]: [number, number, number]) {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrastRatio(a: [number, number, number], b: [number, number, number]) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Resolves ANY CSS color (rgb/lab/oklch/color(...)/named) to concrete 0-255
// sRGB via a real canvas pixel readback — getComputedStyle can return
// non-rgb, non-0-255-scale color-space strings in current Chromium
// (e.g. "color(srgb 0.98 0.91 0.91)"), which a naive string/regex parser
// silently mis-reads as tiny near-zero RGB components.
async function computedRgb(page: Page, selector: string, property: "color" | "backgroundColor"): Promise<[number, number, number]> {
  return page.evaluate(
    ({ selector, property }) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`Element not found: ${selector}`);
      let target: Element | null = el;
      let value = getComputedStyle(target).getPropertyValue(property === "color" ? "color" : "background-color");
      if (property === "backgroundColor") {
        let hops = 0;
        while (target && hops < 10) {
          const cs = getComputedStyle(target);
          const bg = cs.backgroundColor;
          const canvas = document.createElement("canvas");
          canvas.width = 1; canvas.height = 1;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, 1, 1);
          const [, , , a] = ctx.getImageData(0, 0, 1, 1).data;
          if (a > 0) { value = bg; break; }
          target = target.parentElement;
          hops++;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = 1; canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b] as [number, number, number];
    },
    { selector, property }
  );
}

test("Communication Center mode switch: the active tab's own text color is never overridden by the global text-xs/font-black rule", async ({ page }) => {
  await gotoAsQaAdmin(page, "/hk-admin/iletisim-merkezi");
  await page.waitForLoadState("domcontentloaded");

  const activeTab = page.locator('[role="tablist"][aria-label="İletişim modu"] [role="tab"][aria-selected="true"]');
  await expect(activeTab).toBeVisible();

  const [textColor, bgColor] = await Promise.all([
    computedRgb(page, '[role="tablist"][aria-label="İletişim modu"] [role="tab"][aria-selected="true"]', "color"),
    computedRgb(page, '[role="tablist"][aria-label="İletişim modu"] [role="tab"][aria-selected="true"]', "backgroundColor")
  ]);
  const ratio = contrastRatio(textColor, bgColor);

  // This is the exact production regression: text rgb(95, 102, 114) on
  // teal rgb(11, 122, 136) measured ~1.9:1 — nowhere near readable.
  expect(ratio, `active tab text ${JSON.stringify(textColor)} vs background ${JSON.stringify(bgColor)} must be readable (was gray-on-teal ~1.9:1 before the fix)`).toBeGreaterThanOrEqual(4.5);
});

test("AI Workforce tab bar (AdminTabs): active and idle tabs both stay readable against their own background", async ({ page }) => {
  await gotoAsQaAdmin(page, "/ai-workforce");
  await page.waitForLoadState("domcontentloaded");

  const activeTab = page.locator('main [role="tab"][aria-selected="true"]').first();
  const hasTabs = await activeTab.count();
  test.skip(hasTabs === 0, "QA admin account does not have ai-workforce module access in this environment, or the page redirected — no AdminTabs bar to check.");

  const [activeColor, activeBg] = await Promise.all([
    computedRgb(page, 'main [role="tab"][aria-selected="true"]', "color"),
    computedRgb(page, 'main [role="tab"][aria-selected="true"]', "backgroundColor")
  ]);
  expect(contrastRatio(activeColor, activeBg), `active AdminTabs tab: color ${JSON.stringify(activeColor)} vs bg ${JSON.stringify(activeBg)}`).toBeGreaterThanOrEqual(4.5);

  const idleTab = page.locator('main [role="tab"][aria-selected="false"]').first();
  if (await idleTab.count()) {
    const [idleColor, idleBg] = await Promise.all([
      computedRgb(page, 'main [role="tab"][aria-selected="false"]', "color"),
      computedRgb(page, 'main [role="tab"][aria-selected="false"]', "backgroundColor")
    ]);
    expect(contrastRatio(idleColor, idleBg), `idle AdminTabs tab: color ${JSON.stringify(idleColor)} vs bg ${JSON.stringify(idleBg)}`).toBeGreaterThanOrEqual(4.5);
  }
});
