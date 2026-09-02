import test from "node:test";
import assert from "node:assert/strict";
import { computeGeminiVisibilityScore } from "../../src/lib/gemini-visibility/scoring.ts";
import { normalizeBusinessNameText, textMentionsAnyName, textMentionsName } from "../../src/lib/gemini-visibility/name-matching.ts";
import { validateQuestionText } from "../../src/lib/gemini-visibility/validation.ts";
import { allowedQuestionCount, buildQuotaStatus } from "../../src/lib/gemini-visibility/quota-math.ts";
import type { GeminiVisibilityAnswer } from "../../src/lib/gemini-visibility/types.ts";

function answer(overrides: Partial<GeminiVisibilityAnswer> = {}): GeminiVisibilityAnswer {
  return {
    id: "a", scan_id: "s", question_id: "q", question_text_snapshot: "soru", category: "discovery",
    model: "gemini-3.5-flash-lite", status: "completed", raw_response: "yanit", brand_mentioned: false,
    alternate_name_mentioned: false, recommended: false, position: null, competitors_mentioned: [],
    citation: null, sentiment: null, error: null, response_ms: 100, input_tokens: 10, output_tokens: 10,
    cached: false, ...overrides
  };
}

test("computeGeminiVisibilityScore: no completed answers -> score 0, critical, everything unmeasured", () => {
  const result = computeGeminiVisibilityScore([answer({ status: "failed", raw_response: null })]);
  assert.equal(result.score, 0);
  assert.equal(result.level, "critical");
  assert.deepEqual(result.breakdown, {});
  assert.ok(result.unmeasuredComponents.length > 0);
});

test("computeGeminiVisibilityScore: perfect visibility across every component scores near 100", () => {
  const answers = [1, 2, 3, 4].map(() => answer({
    brand_mentioned: true, recommended: true, position: 1, sentiment: "positive", citation: "https://example.com"
  }));
  const result = computeGeminiVisibilityScore(answers);
  assert.equal(result.score, 100);
  assert.equal(result.level, "excellent");
  assert.deepEqual(result.unmeasuredComponents, []);
});

test("computeGeminiVisibilityScore: zero mentions across all answers scores 0 for measurable components", () => {
  const answers = [1, 2, 3].map(() => answer({ brand_mentioned: false, alternate_name_mentioned: false, recommended: false }));
  const result = computeGeminiVisibilityScore(answers);
  assert.equal(result.score, 0);
  assert.equal(result.level, "critical");
  // competitor_share/citation/position/sentiment are unmeasurable when the
  // business is never mentioned at all — never fabricated as 0.
  assert.ok(result.unmeasuredComponents.includes("competitor_share"));
  assert.ok(result.unmeasuredComponents.includes("citation_presence"));
  assert.ok(result.unmeasuredComponents.includes("sentiment"));
});

test("computeGeminiVisibilityScore: unmeasurable position component is excluded and remaining weights rescale to 100", () => {
  const answers = [1, 2].map(() => answer({ brand_mentioned: true, recommended: true, position: null, sentiment: "positive", citation: "x" }));
  const result = computeGeminiVisibilityScore(answers);
  assert.ok(result.unmeasuredComponents.includes("recommendation_position"));
  assert.equal(result.score, 100, "remaining 5 components are all maxed, rescaled weight should still reach 100");
});

test("computeGeminiVisibilityScore: more mentions/recommendations strictly increases the score", () => {
  const scoreFor = (mentionedFraction: number) => {
    const total = 20;
    const mentioned = Math.round(total * mentionedFraction);
    const answers = Array.from({ length: total }, (_, index) => answer({ brand_mentioned: index < mentioned, recommended: index < mentioned, sentiment: index < mentioned ? "positive" : null }));
    return computeGeminiVisibilityScore(answers).score;
  };
  assert.ok(scoreFor(0) < scoreFor(0.5));
  assert.ok(scoreFor(0.5) < scoreFor(1));
});

test("computeGeminiVisibilityScore: level thresholds are applied correctly at known scores", () => {
  assert.equal(computeGeminiVisibilityScore([answer({ brand_mentioned: false })]).level, "critical");
  assert.equal(computeGeminiVisibilityScore([answer({ brand_mentioned: true, recommended: true, position: 1, sentiment: "positive", citation: "x" })]).level, "excellent");
});

test("normalizeBusinessNameText / textMentionsName: case and punctuation-insensitive Turkish matching", () => {
  assert.ok(textMentionsName("Burada HK Dijital'in şubesi var.", "HK Dijital"));
  assert.ok(textMentionsName("hk dijital öneriyorum", "HK Dijital"));
  assert.ok(!textMentionsName("Farklı bir işletmeden bahsediyorum", "HK Dijital"));
  assert.equal(normalizeBusinessNameText("İstanbul"), normalizeBusinessNameText("istanbul"));
});

test("textMentionsAnyName: matches if any alternate name is present", () => {
  assert.ok(textMentionsAnyName("Acme Diş Kliniği harika", ["HK Dijital", "Acme Diş Kliniği"]));
  assert.ok(!textMentionsAnyName("alakasız metin", ["HK Dijital", "Acme Diş Kliniği"]));
});

test("validateQuestionText: rejects business name leaking into a non-branded question", () => {
  const profile = { business_name: "HK Dijital", alternate_names: ["HK Digital"] };
  assert.match(validateQuestionText("HK Dijital güvenilir mi?", "discovery", profile) || "", /branded/);
  assert.equal(validateQuestionText("Bu bölgede güvenilir dijital ajanslar hangileri?", "discovery", profile), null);
});

test("validateQuestionText: branded category may use the business name", () => {
  const profile = { business_name: "HK Dijital", alternate_names: [] };
  assert.equal(validateQuestionText("HK Dijital güvenilir mi?", "branded", profile), null);
});

test("validateQuestionText: rejects empty and over-length questions", () => {
  const profile = { business_name: "HK Dijital", alternate_names: [] };
  assert.ok(validateQuestionText("   ", "discovery", profile));
  assert.ok(validateQuestionText("a".repeat(501), "discovery", profile));
});

test("quota-math: buildQuotaStatus flags exceeded when either the customer or global budget hits zero", () => {
  assert.equal(buildQuotaStatus(200, 200, 10, 2000).exceeded, true);
  assert.equal(buildQuotaStatus(10, 200, 2000, 2000).exceeded, true);
  assert.equal(buildQuotaStatus(10, 200, 10, 2000).exceeded, false);
});

test("quota-math: allowedQuestionCount never exceeds the smaller of requested/customer/global remaining", () => {
  const quota = buildQuotaStatus(195, 200, 1990, 2000);
  assert.equal(allowedQuestionCount(15, quota), 5);
  assert.equal(allowedQuestionCount(3, quota), 3);
});
