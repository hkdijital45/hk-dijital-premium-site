import test from "node:test";
import assert from "node:assert/strict";
import { resolveHkAiRoute, HK_AI_MODELS } from "../../src/lib/hk-ai-router.ts";

// Pure, deterministic router — no network calls, safe to run unlimited
// times (spec section 32).

test("routing test matrix (spec section 31)", () => {
  const cases: Array<[string, string]> = [
    ["lead-score", HK_AI_MODELS.FAST],
    ["short-summary", HK_AI_MODELS.FAST],
    ["crm-note", HK_AI_MODELS.FAST],
    ["social-media-strategy", HK_AI_MODELS.DEFAULT],
    ["meta-ads-analysis", HK_AI_MODELS.DEFAULT],
    ["google-ads-analysis", HK_AI_MODELS.DEFAULT],
    ["seo-analysis", HK_AI_MODELS.DEFAULT],
    ["monthly-report", HK_AI_MODELS.DEFAULT],
    ["normal-ai-chat", HK_AI_MODELS.DEFAULT],
    ["ai-strategist", HK_AI_MODELS.POWERFUL],
    ["ads-doctor-pro", HK_AI_MODELS.POWERFUL],
    ["90-day-strategy", HK_AI_MODELS.POWERFUL],
    ["deep-cross-channel-analysis", HK_AI_MODELS.POWERFUL],
    ["some-completely-unknown-action", HK_AI_MODELS.DEFAULT]
  ];
  for (const [action, expectedModel] of cases) {
    const route = resolveHkAiRoute({ action });
    assert.equal(route.model, expectedModel, `${action} should route to ${expectedModel}, got ${route.model}`);
  }
});

test("no action/taskType at all defaults to Terra (spec section 9)", () => {
  assert.equal(resolveHkAiRoute({}).model, HK_AI_MODELS.DEFAULT);
});

test("Luna never receives medium+ reasoning", () => {
  assert.equal(resolveHkAiRoute({ action: "lead-score", complexity: "simple" }).reasoning, "none");
  assert.equal(resolveHkAiRoute({ action: "lead-score", complexity: "normal" }).reasoning, "low");
  assert.equal(resolveHkAiRoute({ action: "lead-score", complexity: "critical" }).reasoning, "low");
});

test("Sol never auto-selects xhigh/max/pro reasoning", () => {
  const route = resolveHkAiRoute({ action: "ai-strategist", complexity: "critical" });
  assert.equal(route.reasoning, "high");
});

test("multiStep escalates a Terra task to Sol (spec section 11)", () => {
  const route = resolveHkAiRoute({ action: "social-media-strategy", multiStep: true });
  assert.equal(route.model, HK_AI_MODELS.POWERFUL);
});

test("toolCount alone does NOT escalate to Sol (spec section 11)", () => {
  const route = resolveHkAiRoute({ action: "social-media-strategy", toolCount: 5 });
  assert.equal(route.model, HK_AI_MODELS.DEFAULT);
});

test("escalation never demotes Luna to Sol", () => {
  const route = resolveHkAiRoute({ action: "lead-score", multiStep: true, complexity: "critical" });
  assert.equal(route.model, HK_AI_MODELS.FAST);
});

test("free-chat escalation keywords route normal-ai-chat to Sol", () => {
  const route = resolveHkAiRoute({ action: "normal-ai-chat", prompt: "Bütün verileri birleştirerek 90 günlük strateji hazırlar mısın?" });
  assert.equal(route.model, HK_AI_MODELS.POWERFUL);
});

test("web search stays off by default for non-research tasks", () => {
  assert.equal(resolveHkAiRoute({ action: "social-media-strategy" }).allowWeb, false);
  assert.equal(resolveHkAiRoute({ action: "crm-note" }).allowWeb, false);
});

test("web search opens automatically for inherently research task types", () => {
  assert.equal(resolveHkAiRoute({ taskType: "deep_research" }).allowWeb, true);
  assert.equal(resolveHkAiRoute({ taskType: "competitor_research" }).allowWeb, true);
});

test("output budgets stay within the spec's rough guides (section 14C)", () => {
  const luna = resolveHkAiRoute({ action: "lead-score", expectedOutputSize: "long" });
  const terra = resolveHkAiRoute({ action: "normal-ai-chat", expectedOutputSize: "medium" });
  const sol = resolveHkAiRoute({ action: "ai-strategist", expectedOutputSize: "long" });
  assert.ok(luna.maxOutputTokens >= 300 && luna.maxOutputTokens <= 1000);
  assert.ok(terra.maxOutputTokens >= 1000 && terra.maxOutputTokens <= 3000);
  assert.ok(sol.maxOutputTokens >= 2000 && sol.maxOutputTokens <= 6000);
});
