import test from "node:test";
import assert from "node:assert/strict";
import { calculateProposalFinancials } from "../../../src/lib/proposals/financials.ts";

// Mirrors the brief's own worked example exactly (test values, not real
// customer prices): Google Ads 12.000 + Meta Ads 8.000 + Agency Fee
// 12.000 + Setup Fee 5.000 = 37.000 first month (excl. VAT); 32.000
// subsequent month (excl. VAT, no setup fee repeat).
test("calculateProposalFinancials: matches the brief's worked example exactly (excl. VAT)", () => {
  const result = calculateProposalFinancials({
    adBudgets: [{ platform: "Google Ads", monthlyBudget: 12000 }, { platform: "Meta Ads", monthlyBudget: 8000 }],
    agencyMonthlyFee: 12000,
    setupFee: 5000
  });
  assert.equal(result.totalMonthlyAdBudget, 20000);
  assert.equal(result.firstMonthTotalExclVat, 37000);
  assert.equal(result.subsequentMonthTotalExclVat, 32000);
});

test("calculateProposalFinancials: ad spend is never taxed, only the agency's own fees are", () => {
  const result = calculateProposalFinancials({
    adBudgets: [{ platform: "Google Ads", monthlyBudget: 10000 }],
    agencyMonthlyFee: 1000,
    setupFee: 0,
    vatRate: 0.2
  });
  // Ad budget contributes 10000 untaxed; agency fee contributes 1000*1.2=1200 taxed.
  assert.equal(result.firstMonthTotalInclVat, 10000 + 1200);
  assert.equal(result.agencyMonthlyFeeInclVat, 1200);
});

test("calculateProposalFinancials: contract total correctly compounds (first month + (months-1) subsequent months)", () => {
  const result = calculateProposalFinancials({
    adBudgets: [{ platform: "Google Ads", monthlyBudget: 12000 }, { platform: "Meta Ads", monthlyBudget: 8000 }],
    agencyMonthlyFee: 12000,
    setupFee: 5000,
    contractMonths: 3
  });
  // 37000 (month 1) + 32000*2 (months 2-3) = 101000
  assert.equal(result.contractTotalExclVat, 37000 + 32000 * 2);
});

test("calculateProposalFinancials: zero/missing ad budgets never fabricate a non-zero total", () => {
  const result = calculateProposalFinancials({ adBudgets: [], agencyMonthlyFee: 5000, setupFee: 0 });
  assert.equal(result.totalMonthlyAdBudget, 0);
  assert.equal(result.adBudgetsByPlatform.length, 0);
});

test("calculateProposalFinancials: no contractMonths means no contract total (null, not fabricated)", () => {
  const result = calculateProposalFinancials({ adBudgets: [], agencyMonthlyFee: 1000, setupFee: 0 });
  assert.equal(result.contractMonths, null);
  assert.equal(result.contractTotalExclVat, null);
  assert.equal(result.formatted.contractTotalInclVat, null);
});

test("calculateProposalFinancials: never double-counts a platform (Instagram/Facebook must be passed as one Meta Ads line, not added separately by this function)", () => {
  const result = calculateProposalFinancials({
    adBudgets: [{ platform: "Meta Ads (Instagram + Facebook)", monthlyBudget: 8000 }],
    agencyMonthlyFee: 0,
    setupFee: 0
  });
  assert.equal(result.totalMonthlyAdBudget, 8000);
});
