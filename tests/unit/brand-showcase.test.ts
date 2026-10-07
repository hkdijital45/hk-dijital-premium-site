import test from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_SERVICES_MAX_COUNT,
  extensionForBrandLogo,
  normalizeServices,
  parseBrandFields,
  servicesArray,
  swapPlan,
  validateBrandLogoMeta
} from "../../src/lib/brand-showcase.ts";

test("normalizeServices trims, dedupes case-insensitively and caps count", () => {
  assert.deepEqual(normalizeServices(["Meta Ads", " meta ads ", "SEO", ""]), ["Meta Ads", "SEO"]);
  const many = Array.from({ length: BRAND_SERVICES_MAX_COUNT + 5 }, (_, i) => `Hizmet ${i}`);
  assert.equal(normalizeServices(many).length, BRAND_SERVICES_MAX_COUNT);
  assert.deepEqual(normalizeServices("not-an-array" as never), []);
});

test("parseBrandFields requires a name and normalizes services/description", () => {
  const ok = parseBrandFields({ name: "  Görke Tasarım  ", services: ["Meta Ads", "Meta Ads"], description: "  Kısa açıklama  " });
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.value.name, "Görke Tasarım");
  assert.deepEqual(ok.ok && ok.value.services, ["Meta Ads"]);
  assert.equal(ok.ok && ok.value.description, "Kısa açıklama");

  const emptyDescription = parseBrandFields({ name: "X", services: [], description: "   " });
  assert.equal(emptyDescription.ok && emptyDescription.value.description, null);

  assert.equal(parseBrandFields({ name: "   " }).ok, false);
  assert.equal(parseBrandFields(null).ok, false);
});

test("logo validation enforces type and size before upload is attempted", () => {
  assert.equal(validateBrandLogoMeta({ type: "image/png", size: 1024 }).ok, true);
  assert.equal(validateBrandLogoMeta({ type: "image/gif", size: 1024 }).ok, false);
  assert.equal(validateBrandLogoMeta({ type: "image/png", size: 0 }).ok, false);
  assert.equal(validateBrandLogoMeta({ type: "image/png", size: 6 * 1024 * 1024 }).ok, false);
  assert.equal(extensionForBrandLogo("image/webp"), "webp");
  assert.equal(extensionForBrandLogo("image/svg+xml"), null);
});

test("swapPlan reorders with an adjacent row and rejects edge moves", () => {
  const rows = [
    { id: "a", sort_order: 0 },
    { id: "b", sort_order: 1 },
    { id: "c", sort_order: 2 }
  ];
  const up = swapPlan(rows, "b", "up");
  assert.equal(up.ok, true);
  assert.deepEqual(up.ok && [up.a, up.b].sort((x, y) => x.id.localeCompare(y.id)), [{ id: "a", sort_order: 1 }, { id: "b", sort_order: 0 }]);

  assert.equal(swapPlan(rows, "a", "up").ok, false);
  assert.equal(swapPlan(rows, "c", "down").ok, false);
  assert.equal(swapPlan(rows, "missing", "up").ok, false);
});

test("servicesArray reads both a JSON array and a JSON-encoded string", () => {
  assert.deepEqual(servicesArray(["Meta Ads", "SEO"]), ["Meta Ads", "SEO"]);
  assert.deepEqual(servicesArray(JSON.stringify(["Meta Ads"])), ["Meta Ads"]);
  assert.deepEqual(servicesArray("not json"), []);
  assert.deepEqual(servicesArray(null), []);
});
