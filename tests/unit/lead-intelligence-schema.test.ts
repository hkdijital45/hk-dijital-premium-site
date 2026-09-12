import test from "node:test";
import assert from "node:assert/strict";
import {
  computeBusinessFingerprint,
  computeEvidenceFingerprint,
  deriveDeterministicIntelligence,
  parseLeadIntelligenceJson,
  priorityLabel,
  validateLeadIntelligenceResult,
  type LeadIntelligenceEvidence,
  type LeadIntelligenceResult
} from "../../src/lib/lead-intelligence-schema.ts";

const strongEvidence: LeadIntelligenceEvidence = {
  name: "Öztürk Diş Kliniği",
  sector: "Diş Kliniği",
  city: "Manisa",
  district: "Yunusemre",
  website: undefined,
  phone: "05551234567",
  googleRating: 4.6,
  reviewCount: 120,
  googlePlaceId: "place-123",
  metaAdsStatus: "no_signal_detected",
  googleAdsStatus: "no_signal_detected"
};

test("computeBusinessFingerprint: prefers the real Google Place ID when available", () => {
  const fp = computeBusinessFingerprint(strongEvidence);
  assert.equal(fp, "place:place-123");
});

test("computeBusinessFingerprint: falls back to a normalized name+phone+city+district hash with no place ID", () => {
  const fp1 = computeBusinessFingerprint({ name: "Ayşe Kuaför", phone: "0532 111 22 33", city: "Manisa", district: "Şehzadeler" });
  const fp2 = computeBusinessFingerprint({ name: "ayşe kuaför", phone: "05321112233", city: "manisa", district: "şehzadeler" });
  assert.equal(fp1, fp2, "case/whitespace/formatting differences must not change the identity key");
  assert.match(fp1, /^hash:[0-9a-f]{24}$/);
});

test("computeBusinessFingerprint: different businesses get different fingerprints", () => {
  const a = computeBusinessFingerprint({ name: "A İşletmesi", phone: "111", city: "Manisa", district: "" });
  const b = computeBusinessFingerprint({ name: "B İşletmesi", phone: "222", city: "Manisa", district: "" });
  assert.notEqual(a, b);
});

test("computeEvidenceFingerprint: identical evidence produces an identical fingerprint (cache hit path)", () => {
  const fp1 = computeEvidenceFingerprint(strongEvidence, "level1");
  const fp2 = computeEvidenceFingerprint({ ...strongEvidence }, "level1");
  assert.equal(fp1, fp2);
});

test("computeEvidenceFingerprint: a real evidence change (new review count) changes the fingerprint (staleness detection)", () => {
  const fp1 = computeEvidenceFingerprint(strongEvidence, "level1");
  const fp2 = computeEvidenceFingerprint({ ...strongEvidence, reviewCount: 200 }, "level1");
  assert.notEqual(fp1, fp2);
});

test("computeEvidenceFingerprint: level1 vs level2 for the same business are distinct cache entries", () => {
  const fp1 = computeEvidenceFingerprint(strongEvidence, "level1");
  const fp2 = computeEvidenceFingerprint(strongEvidence, "level2");
  assert.notEqual(fp1, fp2);
});

test("deriveDeterministicIntelligence: never fabricates — unknown fields are explicitly marked, not invented", () => {
  const result = deriveDeterministicIntelligence({ name: "Bilinmeyen İşletme", sector: "Kuaför", city: "Manisa" });
  const text = JSON.stringify(result).toLocaleLowerCase("tr-TR");
  // No fabricated ad spend, engagement rate, or conversion rate claims.
  assert.doesNotMatch(text, /₺\d|%\s?\d+(\.\d+)?\s?(engagement|dönüşüm|etkileşim)/);
  assert.ok(result.specialists.digitalPresence.unknowns.length > 0, "missing evidence must surface as an explicit unknown");
});

test("deriveDeterministicIntelligence: a business with no website scores a real, explainable digital gap", () => {
  const result = deriveDeterministicIntelligence(strongEvidence);
  assert.ok(result.specialists.digitalPresence.weaknesses.some((w) => w.includes("Web sitesi")));
  assert.ok(result.specialists.growth.recommendedServices.includes("Web Sitesi / Açılış Sayfası"));
});

test("deriveDeterministicIntelligence: priority is derived from the real 0-100 score, not invented", () => {
  const result = deriveDeterministicIntelligence(strongEvidence);
  assert.ok(["very_high", "high", "medium", "low"].includes(result.priority));
  assert.equal(typeof priorityLabel(result.priority), "string");
});

test("deriveDeterministicIntelligence: real peer/market data is used when present, honestly labeled as unavailable when absent", () => {
  const withPeers = deriveDeterministicIntelligence({ ...strongEvidence, peers: { count: 5, averageRating: 4.1, averageReviewCount: 40, withWebsiteRatio: 0.8 } });
  assert.match(withPeers.specialists.market.assessment, /5 işletme/);
  const withoutPeers = deriveDeterministicIntelligence(strongEvidence);
  assert.match(withoutPeers.specialists.market.assessment, /Veri.*yok|yeterli sayıda/i);
});

test("parseLeadIntelligenceJson: parses a clean JSON response", () => {
  const parsed = parseLeadIntelligenceJson('{"summary":"test"}');
  assert.deepEqual(parsed, { summary: "test" });
});

test("parseLeadIntelligenceJson: extracts JSON even when wrapped in prose/markdown fences", () => {
  const parsed = parseLeadIntelligenceJson('Here is the analysis:\n```json\n{"summary":"wrapped"}\n```\nHope this helps.');
  assert.deepEqual(parsed, { summary: "wrapped" });
});

test("parseLeadIntelligenceJson: returns null (never throws) for unparseable text", () => {
  assert.equal(parseLeadIntelligenceJson("not json at all"), null);
});

test("validateLeadIntelligenceResult: a well-formed AI response passes through unchanged", () => {
  const fallback = deriveDeterministicIntelligence(strongEvidence);
  const wellFormed: LeadIntelligenceResult = {
    summary: "AI summary",
    confidence: 80,
    priority: "high",
    specialists: {
      leadQualifier: { assessment: "a", evidence: ["e1"], concerns: ["c1"] },
      digitalPresence: { assessment: "b", strengths: ["s1"], weaknesses: ["w1"], unknowns: ["u1"] },
      market: { assessment: "c", competitorPressure: "d", opportunities: ["o1"] },
      growth: { recommendedServices: ["Google Ads"], first90Days: ["step1"] },
      sales: { salesAngle: "angle", firstContact: "contact", discoveryQuestions: ["q1"], likelyObjections: ["obj1"], nextAction: "next" }
    },
    finalRecommendation: "final",
    redFlags: []
  };
  const { result, backfilledFields } = validateLeadIntelligenceResult(wellFormed, fallback);
  assert.deepEqual(result, wellFormed);
  assert.deepEqual(backfilledFields, []);
});

test("validateLeadIntelligenceResult: a completely empty/malformed AI response backfills every field from real deterministic data, never fabricates", () => {
  const fallback = deriveDeterministicIntelligence(strongEvidence);
  const { result, backfilledFields } = validateLeadIntelligenceResult({}, fallback);
  assert.deepEqual(result, fallback);
  assert.ok(backfilledFields.length > 10);
});

test("validateLeadIntelligenceResult: partial AI response keeps what the AI got right, backfills only what's missing", () => {
  const fallback = deriveDeterministicIntelligence(strongEvidence);
  const partial = { summary: "Real AI summary", specialists: { sales: { salesAngle: "Real AI angle" } } };
  const { result, backfilledFields } = validateLeadIntelligenceResult(partial, fallback);
  assert.equal(result.summary, "Real AI summary");
  assert.equal(result.specialists.sales.salesAngle, "Real AI angle");
  assert.equal(result.specialists.leadQualifier.assessment, fallback.specialists.leadQualifier.assessment);
  assert.ok(backfilledFields.includes("specialists.leadQualifier.assessment"));
  assert.ok(!backfilledFields.includes("summary"));
});

test("validateLeadIntelligenceResult: an out-of-range confidence number is clamped, not trusted blindly", () => {
  const fallback = deriveDeterministicIntelligence(strongEvidence);
  const { result } = validateLeadIntelligenceResult({ confidence: 250 }, fallback);
  assert.ok(result.confidence <= 100);
});

test("validateLeadIntelligenceResult: an invalid priority value falls back to the deterministic one, never passed through raw", () => {
  const fallback = deriveDeterministicIntelligence(strongEvidence);
  const { result, backfilledFields } = validateLeadIntelligenceResult({ priority: "super_high" }, fallback);
  assert.equal(result.priority, fallback.priority);
  assert.ok(backfilledFields.includes("priority"));
});
