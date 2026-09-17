import test from "node:test";
import assert from "node:assert/strict";
import { titleSimilarity, findSimilarContent } from "../../src/lib/content-plan/similarity.ts";
import type { ContentPlanItem } from "../../src/lib/content-plan/types.ts";

function item(overrides: Partial<ContentPlanItem> = {}): ContentPlanItem {
  return {
    id: "1",
    workspace_id: "hk-dijital",
    scheduled_date: "2026-08-01",
    platforms: [],
    theme: "SEO / GEO",
    content_title: "SEO ölmedi, arama şekli değişti.",
    content_format: "static",
    notes: "",
    is_published: true,
    published_at: "2026-08-01T00:00:00Z",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides
  };
}

test("titleSimilarity: identical titles score 1", () => {
  assert.equal(titleSimilarity("SEO ölmedi", "SEO ölmedi"), 1);
});

test("titleSimilarity: unrelated titles score low", () => {
  assert.ok(titleSimilarity("Google Ads kampanya optimizasyonu", "Yeni ofis açılışı duyurusu") < 0.3);
});

test("titleSimilarity: is case and diacritic tolerant", () => {
  assert.ok(titleSimilarity("SEO Ölmedi Arama Değişti", "seo olmedi arama degisti") > 0.8);
});

test("findSimilarContent: flags a near-duplicate title with correct daysAgo", () => {
  const past = item({ id: "past", scheduled_date: "2026-08-24", content_title: "SEO ölmedi, arama şekli değişti." });
  const result = findSimilarContent("SEO ölmedi arama şekli değişti", [past]);
  assert.ok(result);
  assert.equal(result?.item.id, "past");
});

test("findSimilarContent: does not flag unrelated content", () => {
  const past = item({ id: "past", content_title: "Instagram Reels ile marka bilinirliği" });
  const result = findSimilarContent("Google Ads bütçe optimizasyonu ipuçları", [past]);
  assert.equal(result, null);
});

test("findSimilarContent: ignores the item's own record when editing", () => {
  const self = item({ id: "self", content_title: "SEO ölmedi, arama şekli değişti." });
  const result = findSimilarContent("SEO ölmedi, arama şekli değişti.", [self], "self");
  assert.equal(result, null);
});

test("findSimilarContent: skips very short titles to avoid false positives", () => {
  const past = item({ content_title: "SEO" });
  const result = findSimilarContent("SEO", [past]);
  assert.equal(result, null);
});
