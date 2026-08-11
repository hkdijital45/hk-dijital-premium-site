import { test, expect } from "@playwright/test";

// Desktop keyboard trigger for the Secret Access Control Center modal:
// Ctrl/Cmd+Shift held, then the physical key sequence 1 -> 1 -> 2, all
// within 2s. See src/components/public/SecretAccessGate.tsx.

const MODAL_TITLE = "HK Digital Access";

async function pressSequence(page: import("@playwright/test").Page, modifier: "Meta" | "Control", keys: string[], delayMs = 100) {
  await page.keyboard.down(modifier);
  await page.keyboard.down("Shift");
  for (const key of keys) {
    await page.keyboard.press(key);
    if (delayMs) await page.waitForTimeout(delayMs);
  }
  await page.keyboard.up("Shift");
  await page.keyboard.up(modifier);
}

test.describe("Secret Access desktop keyboard trigger (1-1-2 sequence)", () => {
  test("Ctrl+Shift+1,1,2 opens the modal", async ({ page }) => {
    await page.goto("/");
    await pressSequence(page, "Control", ["1", "1", "2"]);
    await expect(page.getByText(MODAL_TITLE)).toBeVisible();
  });

  test("Meta+Shift+1,1,2 opens the modal", async ({ page }) => {
    await page.goto("/");
    await pressSequence(page, "Meta", ["1", "1", "2"]);
    await expect(page.getByText(MODAL_TITLE)).toBeVisible();
  });

  test("the old H+K combo no longer opens the modal", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.down("Control");
    await page.keyboard.down("Shift");
    await page.keyboard.press("h");
    await page.keyboard.press("k");
    await page.keyboard.up("Shift");
    await page.keyboard.up("Control");
    await page.waitForTimeout(300);
    await expect(page.getByText(MODAL_TITLE)).toHaveCount(0);
  });

  test("a wrong key in the middle resets the sequence", async ({ page }) => {
    await page.goto("/");
    await pressSequence(page, "Control", ["1", "9", "1", "1", "2"]);
    await expect(page.getByText(MODAL_TITLE)).toBeVisible();
  });

  test("releasing the modifiers mid-sequence resets progress", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.down("Control");
    await page.keyboard.down("Shift");
    await page.keyboard.press("1");
    await page.keyboard.up("Shift");
    await page.keyboard.up("Control");
    await page.waitForTimeout(150);
    // Resume with a fresh, complete sequence — the earlier lone "1" must not count.
    await pressSequence(page, "Control", ["1", "2"]);
    await expect(page.getByText(MODAL_TITLE)).toHaveCount(0);
    await pressSequence(page, "Control", ["1", "1", "2"]);
    await expect(page.getByText(MODAL_TITLE)).toBeVisible();
  });

  test("timing out after 2s resets the sequence", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.down("Control");
    await page.keyboard.down("Shift");
    await page.keyboard.press("1");
    await page.waitForTimeout(2200);
    await page.keyboard.press("1");
    await page.keyboard.press("2");
    await page.keyboard.up("Shift");
    await page.keyboard.up("Control");
    await expect(page.getByText(MODAL_TITLE)).toHaveCount(0);
  });

  test("never triggers while typing in a text field", async ({ page }) => {
    await page.goto("/iletisim");
    const textInput = page.locator('input[type="text"], input[type="email"], textarea').first();
    if (await textInput.count()) {
      await textInput.click();
      await pressSequence(page, "Control", ["1", "1", "2"], 80);
      await expect(page.getByText(MODAL_TITLE)).toHaveCount(0);
    }
  });

  test("mobile 5-tap logo trigger is unaffected", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Emulate touch capability so Header.tsx's touch-only gate engages.
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "maxTouchPoints", { get: () => 5 });
    });
    await page.goto("/");
    const logo = page.getByLabel("HK Dijital ana sayfa");
    for (let i = 0; i < 5; i++) {
      await logo.click();
    }
    await expect(page.getByText(MODAL_TITLE)).toBeVisible();
  });
});
