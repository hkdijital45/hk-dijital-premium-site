import test from "node:test";
import assert from "node:assert/strict";
import { validateHkProposalV1, parseProposalJson, HK_PROPOSAL_SCHEMA_VERSION } from "../../../src/lib/proposals/schema.ts";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: HK_PROPOSAL_SCHEMA_VERSION,
    business: { name: "Abdulmalik Beyaz Eşya Teknik Servis" },
    market_analysis: {},
    competitors: [],
    google_ads_strategy: {},
    meta_ads_strategy: {},
    audience_strategy: {},
    budget_scenarios: [{ name: "Başlangıç", monthlyBudget: 10000, objective: "Tamir çağrısı" }],
    recommended_services: ["Meta Ads"],
    implementation_plan: [],
    roadmap_90_days: [],
    risks: [],
    assumptions: [],
    sources: [],
    customer_proposal: {},
    internal_recommendations: {},
    ...overrides
  };
}

test("validateHkProposalV1: accepts a fully valid payload", () => {
  const result = validateHkProposalV1(validPayload());
  assert.equal(result.ok, true);
});

test("validateHkProposalV1: rejects non-object input safely (never throws)", () => {
  assert.equal(validateHkProposalV1(null).ok, false);
  assert.equal(validateHkProposalV1("a string").ok, false);
  assert.equal(validateHkProposalV1([1, 2, 3]).ok, false);
});

test("validateHkProposalV1: rejects an incompatible schema_version", () => {
  const result = validateHkProposalV1(validPayload({ schema_version: "HK_PROPOSAL_V2" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors[0], /Şema sürümü uyumsuz/);
});

test("validateHkProposalV1: reports every missing required top-level field, not just the first", () => {
  const { schema_version, business } = validPayload();
  const result = validateHkProposalV1({ schema_version, business });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.length >= 10, `expected many missing-field errors, got ${result.errors.length}`);
});

test("validateHkProposalV1: rejects a competitor with no name (never a fabricated competitor placeholder)", () => {
  const result = validateHkProposalV1(validPayload({ competitors: [{ verified: false }] }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes("competitors[0].name")));
});

test("validateHkProposalV1: a competitor claiming verified:true must carry a sourceUrl", () => {
  const result = validateHkProposalV1(validPayload({ competitors: [{ name: "Rakip A", verified: true }] }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes("sourceUrl")));
});

test("validateHkProposalV1: verified:false with no sourceUrl is fine (an honest estimate, not a fabricated fact)", () => {
  const result = validateHkProposalV1(validPayload({ competitors: [{ name: "Rakip A", verified: false, notes: "Tahmini gözlem" }] }));
  assert.equal(result.ok, true);
});

test("validateHkProposalV1: rejects a budget scenario missing its required name/objective", () => {
  const result = validateHkProposalV1(validPayload({ budget_scenarios: [{ monthlyBudget: 5000 }] }));
  assert.equal(result.ok, false);
});

test("validateHkProposalV1: rejects a malformed source URL", () => {
  const result = validateHkProposalV1(validPayload({ sources: [{ url: "not-a-url", note: "test" }] }));
  assert.equal(result.ok, false);
});

test("parseProposalJson: valid JSON parses, invalid JSON returns a Turkish error without throwing", () => {
  const ok = parseProposalJson('{"a":1}');
  assert.equal(ok.ok, true);
  const bad = parseProposalJson("{not valid json");
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /Geçersiz JSON/);
});
