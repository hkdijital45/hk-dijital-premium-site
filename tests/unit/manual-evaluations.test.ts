import test from "node:test";
import assert from "node:assert/strict";
import {
  validateManualEvaluationInput,
  calculateAdDoctorMetrics,
  calculateInstagramMetrics,
  calculateDerivedMetrics,
  MODULE_FIELD_GROUPS,
  MANUAL_EVALUATION_MODULES
} from "../../src/lib/manual-evaluations-shared.ts";

test("MODULE_FIELD_GROUPS: every module in MANUAL_EVALUATION_MODULES has a non-empty field-group config", () => {
  for (const module of MANUAL_EVALUATION_MODULES) {
    const groups = MODULE_FIELD_GROUPS[module];
    assert.ok(groups.length > 0, `${module} should have at least one field group`);
    assert.ok(groups.every((g) => g.fields.length > 0), `${module}'s groups should all have fields`);
  }
});

test("validateManualEvaluationInput: all fields optional — empty input is valid", () => {
  assert.equal(validateManualEvaluationInput("ad-doctor", {}), null);
});

test("validateManualEvaluationInput: rejects an unrecognized field (defense against a stale/forged client payload)", () => {
  assert.match(validateManualEvaluationInput("ad-doctor", { notARealField: 1 }) ?? "", /Tanınmayan alan/);
});

test("validateManualEvaluationInput: rejects a non-numeric value for a number field", () => {
  assert.match(validateManualEvaluationInput("ad-doctor", { spend: "abc" }) ?? "", /sayısal/);
});

test("validateManualEvaluationInput: rejects an invalid date", () => {
  assert.match(validateManualEvaluationInput("ad-doctor", { startDate: "not-a-date" }) ?? "", /tarih/);
});

test("validateManualEvaluationInput: rejects a value outside a select field's options", () => {
  assert.match(validateManualEvaluationInput("ad-doctor", { platform: "Snapchat" }) ?? "", /geçersiz seçim/);
});

test("validateManualEvaluationInput: accepts a valid, fully-populated payload", () => {
  assert.equal(validateManualEvaluationInput("ad-doctor", { platform: "Meta", spend: 1000, startDate: "2026-01-01" }), null);
});

// Phase 5 — derived metrics only ever computed when BOTH the numerator and
// a non-zero denominator are present; never a fabricated 0 for missing data.
test("calculateAdDoctorMetrics: CTR/CPC/CPM/ROAS computed when inputs present", () => {
  const metrics = calculateAdDoctorMetrics({ spend: 1000, impressions: 100000, clicks: 500, revenue: 4000 });
  assert.equal(metrics.ctr.value, 0.5); // 500/100000*100
  assert.equal(metrics.cpc.value, 2); // 1000/500
  assert.equal(metrics.cpm.value, 10); // 1000/100000*1000
  assert.equal(metrics.roas.value, 4); // 4000/1000
});

test("calculateAdDoctorMetrics: a missing denominator yields no entry for that metric (never a fabricated 0)", () => {
  const metrics = calculateAdDoctorMetrics({ spend: 1000 });
  assert.equal(metrics.ctr, undefined);
  assert.equal(metrics.cpc, undefined);
  assert.equal(metrics.roas, undefined);
});

test("calculateAdDoctorMetrics: a zero denominator yields no entry (division-by-zero guarded, not Infinity)", () => {
  const metrics = calculateAdDoctorMetrics({ spend: 1000, impressions: 0, clicks: 0 });
  assert.equal(metrics.ctr, undefined);
  assert.equal(metrics.cpc, undefined);
  assert.equal(metrics.cpm, undefined);
});

test("calculateInstagramMetrics: all five Phase 5 formulas computed when inputs present", () => {
  const metrics = calculateInstagramMetrics({
    accountsReached: 10000,
    totalInteractions: 500,
    profileVisits: 300,
    websiteClicks: 30,
    newFollowers: 50,
    startingFollowers: 1000,
    leads: 10
  });
  assert.equal(metrics.engagementRateByReach.value, 5); // 500/10000*100
  assert.equal(metrics.profileVisitRate.value, 3); // 300/10000*100
  assert.equal(metrics.websiteClickRate.value, 10); // 30/300*100
  assert.equal(metrics.followerGrowthRate.value, 5); // 50/1000*100
  assert.ok(Math.abs(metrics.profileToLeadRate.value - (10 / 300) * 100) < 1e-9); // 10/300*100
});

test("calculateInstagramMetrics: incompatible/missing data never fabricates a metric", () => {
  const metrics = calculateInstagramMetrics({ accountsReached: 10000 });
  assert.equal(Object.keys(metrics).length, 0);
});

test("calculateDerivedMetrics: routes to the correct formula set per module, empty object for modules with no formulas defined", () => {
  assert.ok("ctr" in calculateDerivedMetrics("ad-doctor", { spend: 10, impressions: 100, clicks: 5 }));
  assert.ok("engagementRateByReach" in calculateDerivedMetrics("instagram", { accountsReached: 100, totalInteractions: 10 }));
  assert.deepEqual(calculateDerivedMetrics("candidate-evaluation", { spend: 10 }), {});
});
