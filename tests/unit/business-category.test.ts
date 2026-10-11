import test from "node:test";
import assert from "node:assert/strict";
import { businessCards, extraBusinessCards, orderedBusinessCards, isGenericBusinessCategory, isValidCustomCategory, normalizeCustomCategory, OTHER_BUSINESS_TYPE_ID, resolveBusinessCategory, resolvedBusinessCategoryOrFallback, sanitizeBusinessCategory } from "../../src/lib/business-category.ts";

test("normalizeCustomCategory: trims and collapses internal whitespace", () => {
  assert.equal(normalizeCustomCategory("  Oto   Servis  "), "Oto Servis");
});

test("isValidCustomCategory: rejects empty and whitespace-only input", () => {
  assert.equal(isValidCustomCategory(""), false);
  assert.equal(isValidCustomCategory("   "), false);
});

test("isValidCustomCategory: rejects a single meaningful character", () => {
  assert.equal(isValidCustomCategory("a"), false);
});

test("isValidCustomCategory: accepts 2+ meaningful characters", () => {
  assert.equal(isValidCustomCategory("Kuaför"), true);
});

test("resolveBusinessCategory: returns the predefined label for a known id", () => {
  assert.equal(resolveBusinessCategory("cafe", ""), "Kafe");
});

test("resolveBusinessCategory: returns the normalized custom value when id is 'other'", () => {
  assert.equal(resolveBusinessCategory("other", "  Mobilya   Mağazası "), "Mobilya Mağazası");
});

test("sanitizeBusinessCategory: strips HTML tags, collapses whitespace, caps length", () => {
  assert.equal(sanitizeBusinessCategory("  <b>Oto  Servis</b>  "), "Oto Servis");
  assert.equal(sanitizeBusinessCategory("a".repeat(150)).length, 100);
});

test("isGenericBusinessCategory: flags 'Diğer' / 'other' / empty as generic", () => {
  assert.equal(isGenericBusinessCategory("Diğer"), true);
  assert.equal(isGenericBusinessCategory("other"), true);
  assert.equal(isGenericBusinessCategory(""), true);
  assert.equal(isGenericBusinessCategory("Hukuk Bürosu"), false);
});

test("resolvedBusinessCategoryOrFallback: keeps a real category, replaces a generic one", () => {
  assert.equal(resolvedBusinessCategoryOrFallback("Güzellik Merkezi"), "Güzellik Merkezi");
  assert.equal(resolvedBusinessCategoryOrFallback("Diğer"), "belirtilmemiş sektör");
});

// 2026-10-11: expanded sector list (14 new, behind a "diğer sektörleri
// göster" toggle in the UI) — the original 8 ids/order/labels must be
// byte-for-byte unchanged (existing saved leads reference these ids), and
// every id anywhere in the combined list must be unique so
// resolveBusinessCategory never resolves two different sectors to the
// same id or silently collides with OTHER_BUSINESS_TYPE_ID.
test("businessCards: the original 8 ids/labels are unchanged", () => {
  assert.deepEqual(businessCards.map((c) => c.id), ["bakery", "cafe", "restaurant", "health", "real-estate", "education", "ecommerce", OTHER_BUSINESS_TYPE_ID]);
  assert.deepEqual(businessCards.map((c) => c.label), ["Butik Pasta", "Kafe", "Restoran", "Sağlık", "Emlak", "Eğitim", "E-Ticaret", "Diğer"]);
});

test("extraBusinessCards: has exactly the 14 requested sectors, each a unique id distinct from businessCards", () => {
  assert.equal(extraBusinessCards.length, 14);
  const existingIds = new Set(businessCards.map((c) => c.id));
  const extraIds = extraBusinessCards.map((c) => c.id);
  assert.equal(new Set(extraIds).size, 14, "no duplicate ids within extraBusinessCards");
  for (const id of extraIds) assert.ok(!existingIds.has(id), `extra id "${id}" must not collide with an existing businessCards id`);
  assert.ok(!extraIds.includes(OTHER_BUSINESS_TYPE_ID));
});

test("resolveBusinessCategory: resolves every extra sector id to its real label, not 'Diğer' or the raw id", () => {
  for (const card of extraBusinessCards) {
    assert.equal(resolveBusinessCategory(card.id, ""), card.label);
  }
});

test("resolveBusinessCategory: an unknown/garbage id never crashes and never silently becomes 'Diğer'", () => {
  assert.equal(resolveBusinessCategory("not-a-real-id", ""), "not-a-real-id");
  assert.equal(resolveBusinessCategory(undefined, ""), "-");
});

// 2026-10-11: superseded the "diğer sektörleri göster" toggle per an
// explicit user decision — every sector now renders directly in the
// wizard, in a single combined, correctly-ordered list with "Diğer" last.
test("orderedBusinessCards: every original (minus 'Diğer') + every extra sector, 'Diğer' last, no duplicates", () => {
  assert.equal(orderedBusinessCards.length, 7 + 14 + 1);
  assert.equal(orderedBusinessCards[orderedBusinessCards.length - 1].id, OTHER_BUSINESS_TYPE_ID);
  assert.equal(orderedBusinessCards[orderedBusinessCards.length - 1].label, "Diğer");
  assert.equal(orderedBusinessCards.filter((c) => c.id === OTHER_BUSINESS_TYPE_ID).length, 1);
  const ids = orderedBusinessCards.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "no duplicate ids in the combined ordered list");
});

test("hair-salon sector: id unchanged, label renamed from 'Kuaför & Berber' to 'Kuaför'", () => {
  const hairSalon = extraBusinessCards.find((c) => c.id === "hair-salon");
  assert.ok(hairSalon, "hair-salon id must still exist (existing recorded leads reference it)");
  assert.equal(hairSalon?.label, "Kuaför");
  assert.equal(resolveBusinessCategory("hair-salon", ""), "Kuaför");
});
