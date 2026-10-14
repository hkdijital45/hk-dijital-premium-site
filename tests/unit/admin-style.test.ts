import test from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, forceTextColor } from "../../src/lib/admin-style.ts";

// Root cause of the real "unreadable notification buttons" bug: globals.css
// forces `color` to a theme token via !important on any element classed
// .font-black/.font-bold/.text-xs (etc.) unless that element also sets
// --hk-force-text-color inline. A plain inline `color` always lost to
// that rule — this is why the previous pass's background-color-only fix
// never actually produced readable button text.
test("forceTextColor: attaches --hk-force-text-color matching the real color so the !important theme-forcing rule in globals.css is defeated", () => {
  const result = forceTextColor({ background: "#0e7490", color: "#fff" });
  assert.equal(result["--hk-force-text-color" as keyof typeof result], "#fff");
  assert.equal(result.color, "#fff");
});

test("forceTextColor: a style with no color is returned unchanged (nothing to force)", () => {
  const style = { background: "#fff" };
  assert.deepEqual(forceTextColor(style), style);
});

// Every color PAIR actually shipped on a notification/task/proposal
// button in this app, verified against the real WCAG AA 4.5:1 target for
// normal-size text — not just "looks readable".
test("contrastRatio: white text on the real button backgrounds used across Bildirim/Görev/Teklif Merkezi meets WCAG AA (>= 4.5:1)", () => {
  assert.ok(contrastRatio("#ffffff", "#0e7490") >= 4.5, "teal action buttons (İlgili Kaydı Aç, Tümünü Okundu Yap, filters)");
  assert.ok(contrastRatio("#ffffff", "#6d28d9") >= 4.5, "purple action button (Göreve Dönüştür)");
});

test("contrastRatio: the OLD #0891b2 teal actually failed AA — this is the real, measured root cause, not a guess", () => {
  const ratio = contrastRatio("#ffffff", "#0891b2");
  assert.ok(ratio < 4.5, `expected the old color to fail AA, got ${ratio.toFixed(2)}:1`);
  assert.ok(ratio > 3, `sanity check — should still be in a plausible range, got ${ratio.toFixed(2)}:1`);
});

test("contrastRatio: identical colors have a 1:1 ratio, and the function is symmetric regardless of argument order", () => {
  assert.equal(contrastRatio("#000000", "#000000"), 1);
  assert.equal(contrastRatio("#ffffff", "#0e7490"), contrastRatio("#0e7490", "#ffffff"));
});
