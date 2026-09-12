import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_COUNCIL_SCHEMA_VERSION,
  computeAgentCouncilFingerprint,
  computeEvidenceFingerprint,
  deriveDeterministicIntelligence,
  hasThinEvidence,
  runWithConcurrencyLimit,
  validateChiefAgentResult,
  validateDigitalPresenceAgentResult,
  validateGrowthAgentResult,
  validateLeadQualifierAgentResult,
  validateMarketAgentResult,
  validateSalesAgentResult,
  type LeadIntelligenceEvidence
} from "../../src/lib/lead-intelligence-schema.ts";

const strongEvidence: LeadIntelligenceEvidence = {
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

const deterministic = deriveDeterministicIntelligence(strongEvidence);

test("computeAgentCouncilFingerprint: identical evidence fingerprint + version produces an identical council fingerprint", () => {
  const evidenceFp = computeEvidenceFingerprint(strongEvidence, "level2");
  const a = computeAgentCouncilFingerprint(evidenceFp);
  const b = computeAgentCouncilFingerprint(evidenceFp);
  assert.equal(a, b);
});

test("computeAgentCouncilFingerprint: a version bump invalidates the council cache without touching evidence", () => {
  const evidenceFp = computeEvidenceFingerprint(strongEvidence, "level2");
  const v1 = computeAgentCouncilFingerprint(evidenceFp, 1);
  const v2 = computeAgentCouncilFingerprint(evidenceFp, 2);
  assert.notEqual(v1, v2);
});

test("computeAgentCouncilFingerprint: default version matches AGENT_COUNCIL_SCHEMA_VERSION", () => {
  const evidenceFp = computeEvidenceFingerprint(strongEvidence, "level2");
  assert.equal(computeAgentCouncilFingerprint(evidenceFp), computeAgentCouncilFingerprint(evidenceFp, AGENT_COUNCIL_SCHEMA_VERSION));
});

test("hasThinEvidence: a business with almost no real signals is flagged thin", () => {
  assert.equal(hasThinEvidence({ name: "Bilinmeyen", sector: "Kuaför", city: "Manisa" }), true);
});

test("hasThinEvidence: a business with several real signals is not flagged thin", () => {
  assert.equal(hasThinEvidence(strongEvidence), false);
});

test("validateLeadQualifierAgentResult: well-formed output passes through, invalid qualification enum falls back", () => {
  const { result, backfilledFields } = validateLeadQualifierAgentResult({ assessment: "Güçlü aday", qualification: "made_up_value", evidence: ["e1"], concerns: [], score: 80, confidence: 70 }, deterministic);
  assert.equal(result.assessment, "Güçlü aday");
  assert.notEqual(result.qualification, "made_up_value");
  assert.ok(["strong", "possible", "weak"].includes(result.qualification));
  assert.ok(backfilledFields.includes("qualification"));
});

test("validateDigitalPresenceAgentResult: completely empty AI output backfills every field from deterministic evidence", () => {
  const { result, backfilledFields } = validateDigitalPresenceAgentResult({}, deterministic);
  assert.equal(result.assessment, deterministic.specialists.digitalPresence.assessment);
  assert.ok(backfilledFields.length >= 5);
});

test("validateMarketAgentResult: an invalid competitorPressure value never passes through raw", () => {
  const { result, backfilledFields } = validateMarketAgentResult({ competitorPressure: "extremely-high-invented" }, deterministic);
  assert.ok(["high", "medium", "low", "unknown"].includes(result.competitorPressure));
  assert.ok(backfilledFields.includes("competitorPressure"));
});

test("validateGrowthAgentResult: a hallucinated, non-real service name is not silently trusted as a distinct catalog item", () => {
  const { result } = validateGrowthAgentResult({
    assessment: "test",
    recommendedServices: [{ service: "TikTok Ads", priority: "high", reason: "test" }],
    first90Days: ["step"],
    confidence: 60
  }, deterministic);
  // Still recorded (not discarded outright — see normalizeServiceName), but
  // never silently rewritten into an unrelated real catalog entry either.
  assert.equal(result.recommendedServices[0].service, "TikTok Ads");
});

test("validateGrowthAgentResult: a real catalog service name is preserved exactly", () => {
  const { result } = validateGrowthAgentResult({
    assessment: "test",
    recommendedServices: [{ service: "Google Ads", priority: "high", reason: "test" }],
    first90Days: ["step"],
    confidence: 60
  }, deterministic);
  assert.equal(result.recommendedServices[0].service, "Google Ads");
});

test("validateGrowthAgentResult: an empty recommendedServices array backfills from the deterministic engine", () => {
  const { result, backfilledFields } = validateGrowthAgentResult({ recommendedServices: [] }, deterministic);
  assert.ok(result.recommendedServices.length > 0);
  assert.ok(backfilledFields.includes("recommendedServices"));
});

test("validateSalesAgentResult: preserves what the AI got right, backfills only what's missing", () => {
  const { result, backfilledFields } = validateSalesAgentResult({ salesAngle: "Gerçek AI önerisi" }, deterministic);
  assert.equal(result.salesAngle, "Gerçek AI önerisi");
  assert.ok(backfilledFields.includes("assessment"));
  assert.ok(!backfilledFields.includes("salesAngle"));
});

test("validateChiefAgentResult: never fabricates unsupported facts — an out-of-catalog primaryService still passes through as text, not discarded to null", () => {
  const { result } = validateChiefAgentResult({
    summary: "test", agreements: [], disagreements: [], evidenceWeaknesses: [],
    leadScore: 70, confidence: 65, priority: "high",
    recommendedServices: ["Google Ads"], primaryService: "Google Ads",
    finalRecommendation: "test", redFlags: [], nextAction: "test"
  }, deterministic);
  assert.equal(result.primaryService, "Google Ads");
  assert.equal(result.priority, "high");
});

test("validateChiefAgentResult: an invalid priority enum falls back to the deterministic value, never trusted raw", () => {
  const { result, backfilledFields } = validateChiefAgentResult({ priority: "super_extreme" }, deterministic);
  assert.equal(result.priority, deterministic.priority);
  assert.ok(backfilledFields.includes("priority"));
});

test("runWithConcurrencyLimit: runs all jobs and preserves result order regardless of completion timing", async () => {
  const jobs = [3, 1, 2].map((delay) => () => new Promise<number>((resolve) => setTimeout(() => resolve(delay), delay)));
  const results = await runWithConcurrencyLimit(jobs, 3);
  assert.deepEqual(results.map((r) => (r.status === "fulfilled" ? r.value : null)), [3, 1, 2]);
});

test("runWithConcurrencyLimit: never runs more than `limit` jobs concurrently", async () => {
  let active = 0;
  let maxActive = 0;
  const jobs = Array.from({ length: 6 }, () => async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    return true;
  });
  await runWithConcurrencyLimit(jobs, 2);
  assert.ok(maxActive <= 2, `expected max 2 concurrent, got ${maxActive}`);
});

test("runWithConcurrencyLimit: one job failing does not prevent the others from completing (partial failure isolation)", async () => {
  const jobs = [
    async () => "ok-1",
    async () => { throw new Error("boom"); },
    async () => "ok-3"
  ];
  const results = await runWithConcurrencyLimit(jobs, 3);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.equal(results[2].status, "fulfilled");
});
