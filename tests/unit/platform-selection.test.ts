import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PLATFORM_KEYS,
  isAllPlatformsSelected,
  normalizePlatformSelection,
  platformSelectionLabel,
  platformSelectionReadableList,
  toggleAllPlatforms,
  togglePlatform
} from "../../src/lib/platform-selection.ts";
import { estimateAdBudget, getPlatformBudgetSplit, recommendServicePackage } from "../../src/lib/packages.ts";

test("normalizePlatformSelection: a single legacy string becomes a one-item array", () => {
  assert.deepEqual(normalizePlatformSelection("meta"), ["meta"]);
  assert.deepEqual(normalizePlatformSelection("Meta"), ["meta"]);
});

test("normalizePlatformSelection: legacy 'Hepsi'/'all' expands to all three canonical keys", () => {
  assert.deepEqual(normalizePlatformSelection("Hepsi"), ["meta", "google", "social-media"]);
  assert.deepEqual(normalizePlatformSelection("all"), ["meta", "google", "social-media"]);
});

test("normalizePlatformSelection: an already-canonical array passes through deduplicated and ordered", () => {
  assert.deepEqual(normalizePlatformSelection(["google", "meta", "meta"]), ["meta", "google"]);
});

test("normalizePlatformSelection: a legacy combined string like 'Meta + Google' is parsed into both", () => {
  assert.deepEqual(normalizePlatformSelection("Meta + Google"), ["meta", "google"]);
});

test("normalizePlatformSelection: invalid, empty or unknown values sanitize to an empty array", () => {
  assert.deepEqual(normalizePlatformSelection(""), []);
  assert.deepEqual(normalizePlatformSelection(null), []);
  assert.deepEqual(normalizePlatformSelection(undefined), []);
  assert.deepEqual(normalizePlatformSelection("bilinmeyen-deger"), []);
});

test("normalizePlatformSelection: 'Sosyal Medya' legacy label maps to social-media", () => {
  assert.deepEqual(normalizePlatformSelection("Sosyal Medya"), ["social-media"]);
});

test("isAllPlatformsSelected / toggleAllPlatforms: selecting all three activates Hepsi, toggling again clears", () => {
  assert.equal(isAllPlatformsSelected(["meta", "google", "social-media"]), true);
  assert.equal(isAllPlatformsSelected(["meta", "google"]), false);
  assert.deepEqual(toggleAllPlatforms(["meta", "google"]), ALL_PLATFORM_KEYS);
  assert.deepEqual(toggleAllPlatforms(["meta", "google", "social-media"]), []);
});

test("togglePlatform: adds when absent, removes when present, keeps canonical order", () => {
  assert.deepEqual(togglePlatform([], "google"), ["google"]);
  assert.deepEqual(togglePlatform(["meta"], "google"), ["meta", "google"]);
  assert.deepEqual(togglePlatform(["meta", "google"], "meta"), ["google"]);
});

test("deselecting one option after selecting all deactivates Hepsi", () => {
  const afterSelectAll = toggleAllPlatforms([]);
  const afterDeselectGoogle = togglePlatform(afterSelectAll, "google");
  assert.equal(isAllPlatformsSelected(afterDeselectGoogle), false);
});

test("platformSelectionLabel / platformSelectionReadableList reflect only the selected services", () => {
  assert.equal(platformSelectionLabel(["meta", "google"]), "Meta, Google");
  assert.equal(platformSelectionReadableList(["meta", "google"]), "- Meta Ads\n- Google Ads");
  assert.equal(platformSelectionReadableList(["meta", "google"]).includes("Sosyal"), false);
});

test("recommendation engine: Meta + Google does not pull in Social Media Management", () => {
  const split = getPlatformBudgetSplit(["meta", "google"]);
  const labels = split.map((item) => item.label).join(" ");
  assert.equal(labels.includes("Sosyal"), false);
  assert.ok(labels.includes("Meta") && labels.includes("Google"));
});

test("recommendation engine: Meta + Sosyal Medya includes both Meta ads and social content, not Google", () => {
  const split = getPlatformBudgetSplit(["meta", "social-media"]);
  const labels = split.map((item) => item.label).join(" ");
  assert.ok(labels.includes("Meta"));
  assert.ok(labels.includes("Sosyal"));
  assert.equal(labels.includes("Google"), false);
});

test("recommendation engine: Google + Sosyal Medya includes both, not Meta", () => {
  const split = getPlatformBudgetSplit(["google", "social-media"]);
  const labels = split.map((item) => item.label).join(" ");
  assert.ok(labels.includes("Google"));
  assert.ok(labels.includes("Sosyal"));
  assert.equal(labels.includes("Meta"), false);
});

test("recommendation engine: only recommends the full mix when all three are actually selected", () => {
  const twoSelected = getPlatformBudgetSplit(["meta", "google"]);
  const allSelected = getPlatformBudgetSplit(["meta", "google", "social-media"]);
  assert.notDeepEqual(twoSelected, allSelected);
  assert.ok(allSelected.map((item) => item.label).join(" ").includes("Sosyal"));
});

test("recommendServicePackage: respects the selected combination and stays within the real package catalog", () => {
  const result = recommendServicePackage({ platform: ["meta", "google"], goal: "Daha Fazla Satış", budget: "20000" });
  assert.equal(result.recommended.category, "combined_ads");
  assert.ok(result.reason.includes("Meta"));
  assert.ok(result.reason.includes("Google"));
});

test("recommendServicePackage: a single legacy platform string still resolves (backward compatibility)", () => {
  const result = recommendServicePackage({ platform: "Google", goal: "Daha Fazla Mesaj", budget: "10000" });
  assert.equal(result.recommended.category, "google_ads");
});

test("estimateAdBudget: accepts the canonical array without throwing and returns a platform split", () => {
  const estimate = estimateAdBudget({ platform: ["meta", "google", "social-media"], goal: "Büyüme", budget: "60000" });
  assert.ok(estimate.platformSplit.length > 0);
  assert.ok(estimate.minimumRange[0] > 0);
});
