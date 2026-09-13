import test from "node:test";
import assert from "node:assert/strict";
import { runAgentCouncil, aggregateTokenUsage, type ExecuteAiTaskFn } from "../../src/lib/server/agent-council-runner.ts";
import { deriveDeterministicIntelligence, type LeadIntelligenceEvidence } from "../../src/lib/lead-intelligence-schema.ts";
import type { AiRouterResult } from "../../src/lib/server/ai-router.ts";

const evidence: LeadIntelligenceEvidence = {
  name: "Öztürk Diş Kliniği",
  sector: "Diş Kliniği",
  city: "Manisa",
  district: "Yunusemre",
  phone: "05551234567",
  googleRating: 4.6,
  reviewCount: 120,
  metaAdsStatus: "no_signal_detected",
  googleAdsStatus: "no_signal_detected"
};
const deterministic = deriveDeterministicIntelligence(evidence);

function fakeResult(text: string, overrides: Partial<AiRouterResult> = {}): AiRouterResult {
  return {
    text,
    taskType: "strategy",
    provider: "gemini",
    providerLabel: "Gemini",
    model: "gemini-test",
    mode: "Canlı",
    fallbackUsed: false,
    providerChain: ["gemini"],
    notice: null,
    responseTimeMs: 120,
    tokensUsed: 0,
    failureDetails: [],
    ...overrides
  };
}

// Well-formed JSON bodies matching each agent's schema, so validators pass
// the AI's own values through rather than backfilling from deterministic.
const WELL_FORMED_BY_MODULE: Record<string, string> = {
  "lead-intelligence-council-lead-qualifier": JSON.stringify({ assessment: "Güçlü aday", qualification: "strong", evidence: ["e1"], concerns: [], score: 80, confidence: 70 }),
  "lead-intelligence-council-digital-presence": JSON.stringify({ assessment: "İyi", strengths: ["s1"], weaknesses: [], unknowns: [], opportunities: [], confidence: 60 }),
  "lead-intelligence-council-market": JSON.stringify({ assessment: "Orta", competitorPressure: "medium", evidence: [], opportunities: [], risks: [], confidence: 55 }),
  "lead-intelligence-council-growth": JSON.stringify({ assessment: "Odaklan", recommendedServices: [{ service: "Google Ads", priority: "high", reason: "kanıt" }], first90Days: ["adım"], confidence: 65 }),
  "lead-intelligence-council-sales": JSON.stringify({ assessment: "Hazır", salesAngle: "angle", firstContact: "contact", discoveryQuestions: ["q"], likelyObjections: ["o"], nextAction: "action", confidence: 60 }),
  "lead-intelligence-council-chief": JSON.stringify({ summary: "Özet", agreements: ["a"], disagreements: [], evidenceWeaknesses: [], leadScore: 75, confidence: 70, priority: "high", recommendedServices: ["Google Ads"], primaryService: "Google Ads", finalRecommendation: "final", redFlags: [], nextAction: "next" })
};

function allSucceedExecutor(overrides: Partial<AiRouterResult> = {}): { fn: ExecuteAiTaskFn; calls: string[] } {
  const calls: string[] = [];
  const fn: ExecuteAiTaskFn = async (input) => {
    calls.push(input.module || "");
    return fakeResult(WELL_FORMED_BY_MODULE[input.module || ""] || "{}", overrides);
  };
  return { fn, calls };
}

test("runAgentCouncil: a fully successful run makes exactly 6 logical AI calls (5 specialists + 1 Chief), never more", async () => {
  const { fn, calls } = allSucceedExecutor();
  const outcome = await runAgentCouncil({ evidence, deterministic, createdBy: "qa@hkdijital.com" }, fn);
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    assert.equal(outcome.logicalAiCallCount, 6);
    assert.equal(outcome.chief.status, "completed");
  }
  assert.equal(calls.length, 6);
  assert.equal(new Set(calls).size, 6, "each of the 6 calls must be a distinct logical task, never a repeated/retried module");
});

test("runAgentCouncil: every specialist's real AI values pass through into its own richer per-role result (not the combined V1 shape)", async () => {
  const { fn } = allSucceedExecutor();
  const outcome = await runAgentCouncil({ evidence, deterministic, createdBy: null }, fn);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.specialists.leadQualifier.result?.qualification, "strong");
  assert.equal(outcome.specialists.growth.result?.recommendedServices[0]?.service, "Google Ads");
  assert.equal(outcome.chief.result?.primaryService, "Google Ads");
});

test("runAgentCouncil: when exactly 2 of 5 specialists fail, the Chief still runs (>=3 succeeded) and the call count is 6", async () => {
  const fn: ExecuteAiTaskFn = async (input) => {
    if (input.module === "lead-intelligence-council-market" || input.module === "lead-intelligence-council-sales") {
      throw new Error("simulated provider outage");
    }
    return fakeResult(WELL_FORMED_BY_MODULE[input.module || ""] || "{}");
  };
  const outcome = await runAgentCouncil({ evidence, deterministic, createdBy: null }, fn);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.logicalAiCallCount, 6);
  assert.equal(outcome.specialists.market.status, "failed");
  assert.equal(outcome.specialists.sales.status, "failed");
  assert.equal(outcome.specialists.leadQualifier.status, "completed");
  assert.equal(outcome.chief.status, "completed");
});

test("runAgentCouncil: when 3 of 5 specialists fail (only 2 succeed), the Chief never runs, the call count is 5, and a recoverable Turkish error is returned — never a fabricated confident result", async () => {
  const fn: ExecuteAiTaskFn = async (input) => {
    if (["lead-intelligence-council-market", "lead-intelligence-council-sales", "lead-intelligence-council-growth"].includes(input.module || "")) {
      throw new Error("simulated provider outage");
    }
    return fakeResult(WELL_FORMED_BY_MODULE[input.module || ""] || "{}");
  };
  const outcome = await runAgentCouncil({ evidence, deterministic, createdBy: null }, fn);
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.logicalAiCallCount, 5, "the Chief must not be counted — it was never actually invoked");
  assert.match(outcome.error, /Ajan Kurulu tamamlanamadı/);
  assert.match(outcome.error, /2'si başarıyla sonuçlandı/);
});

test("runAgentCouncil: a malformed (non-JSON) specialist response is backfilled from the deterministic engine and still counts as completed, not failed", async () => {
  const fn: ExecuteAiTaskFn = async (input) => {
    if (input.module === "lead-intelligence-council-market") return fakeResult("this is not json at all");
    return fakeResult(WELL_FORMED_BY_MODULE[input.module || ""] || "{}");
  };
  const outcome = await runAgentCouncil({ evidence, deterministic, createdBy: null }, fn);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.specialists.market.status, "completed");
  assert.equal(outcome.specialists.market.result?.assessment, deterministic.specialists.market.assessment);
});

test("runAgentCouncil: if the Chief call itself fails, specialists remain completed but the Chief is marked failed with a Turkish error — never fabricated", async () => {
  const fn: ExecuteAiTaskFn = async (input) => {
    if (input.module === "lead-intelligence-council-chief") throw new Error("chief provider down");
    return fakeResult(WELL_FORMED_BY_MODULE[input.module || ""] || "{}");
  };
  const outcome = await runAgentCouncil({ evidence, deterministic, createdBy: null }, fn);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.logicalAiCallCount, 6, "the Chief call still counts as a logical call even though it failed — it was genuinely invoked");
  assert.equal(outcome.chief.status, "failed");
  assert.equal(outcome.chief.result, null);
  assert.match(outcome.chief.error || "", /Baş Stratejist/);
  assert.equal(outcome.specialists.leadQualifier.status, "completed");
});

test("runAgentCouncil: never runs more than 3 specialists concurrently (bounded concurrency, never Promise.all over all 5)", async () => {
  let active = 0;
  let maxActive = 0;
  const fn: ExecuteAiTaskFn = async (input) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 15));
    active -= 1;
    return fakeResult(WELL_FORMED_BY_MODULE[input.module || ""] || "{}");
  };
  await runAgentCouncil({ evidence, deterministic, createdBy: null }, fn);
  assert.ok(maxActive <= 3, `expected at most 3 concurrent specialist calls, saw ${maxActive}`);
});

test("aggregateTokenUsage: sums real reported values across calls", () => {
  const usage = aggregateTokenUsage([
    { ...fakeResult(""), inputTokens: 100, outputTokens: 40 },
    { ...fakeResult(""), inputTokens: 50, outputTokens: 10, thinkingTokens: 5 }
  ]);
  assert.deepEqual(usage, { inputTokens: 150, outputTokens: 55, totalTokens: 205 });
});

test("aggregateTokenUsage: returns null (never a fabricated 0) when nothing reported any token field", () => {
  const usage = aggregateTokenUsage([fakeResult(""), fakeResult("")]);
  assert.equal(usage, null);
});

test("runAgentCouncil: a completed agent that used a real provider is marked aiUsed=true with its real provider/model — never a single global guess", async () => {
  const { fn } = allSucceedExecutor({ provider: "gemini", model: "gemini-3.6-flash" });
  const outcome = await runAgentCouncil({ evidence, deterministic, createdBy: null }, fn);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.specialists.leadQualifier.aiUsed, true);
  assert.equal(outcome.specialists.leadQualifier.provider, "gemini");
  assert.equal(outcome.specialists.leadQualifier.model, "gemini-3.6-flash");
  assert.equal(outcome.chief.aiUsed, true);
  assert.equal(outcome.chief.provider, "gemini");
});

test("runAgentCouncil: a completed agent that fell back to the demo provider is honestly marked aiUsed=false, even while other agents in the same run used a real provider", async () => {
  const fn: ExecuteAiTaskFn = async (input) => {
    const moduleName = input.module || "";
    const overrides: Partial<AiRouterResult> = moduleName === "lead-intelligence-council-market"
      ? { provider: "demo", model: "local-rules" }
      : { provider: "gemini", model: "gemini-3.6-flash" };
    return fakeResult(WELL_FORMED_BY_MODULE[moduleName] || "{}", overrides);
  };
  const outcome = await runAgentCouncil({ evidence, deterministic, createdBy: null }, fn);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  // The one agent that fell back must be honestly flagged...
  assert.equal(outcome.specialists.market.status, "completed");
  assert.equal(outcome.specialists.market.aiUsed, false);
  assert.equal(outcome.specialists.market.provider, "demo");
  // ...while the others that genuinely used a real provider are not
  // dragged down to a false "everything is fallback" reading.
  assert.equal(outcome.specialists.leadQualifier.aiUsed, true);
  assert.equal(outcome.specialists.digitalPresence.aiUsed, true);
  assert.equal(outcome.chief.aiUsed, true);
});

test("runAgentCouncil: every specialist call and the Chief call pass a real, role-appropriate `action` hint (never the bare unlabeled strategy default)", async () => {
  const seenActions: Record<string, string | undefined> = {};
  const fn: ExecuteAiTaskFn = async (input) => {
    seenActions[input.module || ""] = input.action;
    return fakeResult(WELL_FORMED_BY_MODULE[input.module || ""] || "{}");
  };
  await runAgentCouncil({ evidence, deterministic, createdBy: null }, fn);
  assert.equal(seenActions["lead-intelligence-council-lead-qualifier"], "sales-opportunity-assessment");
  assert.equal(seenActions["lead-intelligence-council-digital-presence"], "digital-status-assessment");
  assert.equal(seenActions["lead-intelligence-council-market"], "competitor-analysis");
  assert.equal(seenActions["lead-intelligence-council-growth"], "package-recommendation");
  assert.equal(seenActions["lead-intelligence-council-sales"], "proposal-support");
  // Chief must NOT route through the slow POWERFUL tier ("ai-strategist")
  // — production evidence showed that was the one call in the whole
  // council that reliably fell back to demo. It only synthesizes five
  // already-validated compact results, which needs no more capability
  // than the specialists' own proven-fast DEFAULT-tier action.
  assert.notEqual(seenActions["lead-intelligence-council-chief"], "ai-strategist");
  assert.equal(seenActions["lead-intelligence-council-chief"], "customer-report");
});

test("runAgentCouncil: specialist timeouts are raised to match the DEFAULT tier's real expected latency (25s), not the old under-provisioned 18s", async () => {
  const seenTimeouts: number[] = [];
  const fn: ExecuteAiTaskFn = async (input, options) => {
    if (input.module !== "lead-intelligence-council-chief") seenTimeouts.push(options?.timeoutMs || 0);
    return fakeResult(WELL_FORMED_BY_MODULE[input.module || ""] || "{}");
  };
  await runAgentCouncil({ evidence, deterministic, createdBy: null }, fn);
  assert.ok(seenTimeouts.every((timeout) => timeout >= 25_000), `expected every specialist timeout >= 25000ms, saw ${JSON.stringify(seenTimeouts)}`);
});

test("runAgentCouncil: Chief's timeout matches the DEFAULT tier's real budget (25s), not an inflated POWERFUL-oriented value", async () => {
  let chiefTimeout: number | undefined;
  const fn: ExecuteAiTaskFn = async (input, options) => {
    if (input.module === "lead-intelligence-council-chief") chiefTimeout = options?.timeoutMs;
    return fakeResult(WELL_FORMED_BY_MODULE[input.module || ""] || "{}");
  };
  await runAgentCouncil({ evidence, deterministic, createdBy: null }, fn);
  assert.equal(chiefTimeout, 25_000);
});
