import test from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_PRESET_SERVICES,
  BRAND_SERVICES_MAX_COUNT,
  extensionForBrandLogo,
  matchPresetService,
  normalizeServices,
  parseBrandFields,
  servicesArray,
  splitServices,
  swapPlan,
  toggleService,
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

test("matchPresetService matches presets case-insensitively and trims whitespace", () => {
  assert.equal(matchPresetService(" seo "), "SEO");
  assert.equal(matchPresetService("meta ads yönetimi"), "Meta Ads Yönetimi");
  assert.equal(matchPresetService("Kurumsal Danışmanlık"), null);
});

test("splitServices preserves legacy/custom values alongside checked presets", () => {
  const { presets, custom } = splitServices(["Meta Ads Yönetimi", "Kurumsal Danışmanlık"]);
  assert.deepEqual(presets, ["Meta Ads Yönetimi"]);
  assert.deepEqual(custom, ["Kurumsal Danışmanlık"]);
});

test("toggleService adds a preset once and removes it on a second toggle, never duplicating", () => {
  let services: string[] = [];
  services = toggleService(services, "SEO");
  assert.deepEqual(services, ["SEO"]);
  services = toggleService(services, "seo");
  assert.deepEqual(services, []);
  services = toggleService(services, "Meta Ads Yönetimi");
  services = toggleService(services, "Meta Ads Yönetimi");
  assert.deepEqual(services, []);
});

test("preset list stays within the normal services cap and round-trips through normalizeServices", () => {
  assert.ok(BRAND_PRESET_SERVICES.length <= BRAND_SERVICES_MAX_COUNT);
  assert.deepEqual(normalizeServices([...BRAND_PRESET_SERVICES, "Meta Ads Yönetimi"]), [...BRAND_PRESET_SERVICES]);
});

test("servicesArray reads both a JSON array and a JSON-encoded string", () => {
  assert.deepEqual(servicesArray(["Meta Ads", "SEO"]), ["Meta Ads", "SEO"]);
  assert.deepEqual(servicesArray(JSON.stringify(["Meta Ads"])), ["Meta Ads"]);
  assert.deepEqual(servicesArray("not json"), []);
  assert.deepEqual(servicesArray(null), []);
});
