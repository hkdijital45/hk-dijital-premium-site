import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAbTest } from "../../src/lib/ab-testing.ts";

test("evaluateAbTest: below minimum sample size reports insufficient data, never picks a winner", () => {
  const result = evaluateAbTest({ variantA: { impressions: 50, conversions: 10 }, variantB: { impressions: 50, conversions: 5 } });
  assert.equal(result.status, "insufficient_data");
  assert.equal(result.winner, null);
});

test("evaluateAbTest: clear conversion-rate difference with enough sample picks the better variant", () => {
  const result = evaluateAbTest({ variantA: { impressions: 1000, conversions: 100 }, variantB: { impressions: 1000, conversions: 50 } });
  assert.equal(result.status, "completed");
  assert.equal(result.winner, "a");
});

test("evaluateAbTest: near-identical rates with enough sample are inconclusive, not a fake winner", () => {
  const result = evaluateAbTest({ variantA: { impressions: 1000, conversions: 100 }, variantB: { impressions: 1000, conversions: 98 } });
  assert.equal(result.status, "completed");
  assert.equal(result.winner, "inconclusive");
});

test("evaluateAbTest: only one variant below threshold still reports insufficient data", () => {
  const result = evaluateAbTest({ variantA: { impressions: 1000, conversions: 100 }, variantB: { impressions: 100, conversions: 5 } });
  assert.equal(result.status, "insufficient_data");
});
