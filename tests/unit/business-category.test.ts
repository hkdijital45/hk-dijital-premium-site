import test from "node:test";
import assert from "node:assert/strict";
import { isGenericBusinessCategory, isValidCustomCategory, normalizeCustomCategory, resolveBusinessCategory, resolvedBusinessCategoryOrFallback, sanitizeBusinessCategory } from "../../src/lib/business-category.ts";

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
