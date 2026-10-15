import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBusinessScope, normalizeServiceLines } from "../../../src/lib/proposals/business-scope.ts";
import { calculateProposalFinancials, financialsFromQuestionnaire } from "../../../src/lib/proposals/financials.ts";

// Isolated fixtures — not real customer ids or prices.
const MAIN = "lead:11111111-1111-4111-8111-111111111111";
const BRAND = "unit:33333333-3333-4333-8333-333333333333";
const SCOPE = [{ key: MAIN, name: "Ana İşletme", role: "main" as const }, { key: BRAND, name: "Bağlı Marka", role: "related_brand" as const }];

test("scope: malformed and duplicate entries are dropped, order kept", () => {
  const scope = normalizeBusinessScope([SCOPE[0], { key: "bad", name: "x" }, SCOPE[1], SCOPE[0], null]);
  assert.deepEqual(scope.map((s) => s.key), [MAIN, BRAND]);
  assert.deepEqual(normalizeBusinessScope(undefined), []);
});

test("legacy single-business proposal: no scope/lines -> financials identical to before", () => {
  const base = { adBudgets: [{ platform: "Meta Ads", monthlyBudget: 8000 }], agencyMonthlyFee: 12000, setupFee: 5000, contractMonths: 3 };
  const before = calculateProposalFinancials(base);
  const after = calculateProposalFinancials({ ...base, serviceLines: [] });
  assert.equal(after.firstMonthTotalExclVat, before.firstMonthTotalExclVat);
  assert.equal(after.subsequentMonthTotalInclVat, before.subsequentMonthTotalInclVat);
  assert.equal(after.contractTotalInclVat, before.contractTotalInclVat);
  assert.equal(after.serviceLines.length, 0);
});

test("multi-business: price comes only from explicit service lines, never multiplied by business count", () => {
  const { lines } = normalizeServiceLines([{ businessKey: BRAND, description: "Instagram yönetimi", monthlyFee: 4000, setupFee: 1000 }], SCOPE);
  const result = calculateProposalFinancials({ adBudgets: [], agencyMonthlyFee: 12000, setupFee: 5000, serviceLines: lines });
  assert.equal(result.firstMonthTotalExclVat, 12000 + 5000 + 4000 + 1000);
  assert.equal(result.subsequentMonthTotalExclVat, 12000 + 4000);
  // Two businesses in scope with no lines: agency fee is NOT doubled.
  const noLines = calculateProposalFinancials({ adBudgets: [], agencyMonthlyFee: 12000, setupFee: 0, serviceLines: normalizeServiceLines([], SCOPE).lines });
  assert.equal(noLines.subsequentMonthTotalExclVat, 12000);
});

test("same service for the same business is billed once; unchecked business lines don't count", () => {
  const lines = [
    { businessKey: BRAND, description: "Instagram yönetimi", monthlyFee: 4000, setupFee: 0 },
    { businessKey: BRAND, description: "  instagram   YÖNETİMİ ", monthlyFee: 4000, setupFee: 0 },
    { businessKey: MAIN, description: "Instagram yönetimi", monthlyFee: 3000, setupFee: 0 },
    { businessKey: "unit:44444444-4444-4444-8444-444444444444", description: "Kapsam dışı", monthlyFee: 9999, setupFee: 0 },
    { businessKey: BRAND, description: "", monthlyFee: 500, setupFee: 0 },
    { businessKey: BRAND, description: "Negatif", monthlyFee: -50, setupFee: 0 }
  ];
  const result = normalizeServiceLines(lines, SCOPE);
  assert.equal(result.duplicatesIgnored, 1);
  assert.deepEqual(result.lines.map((l) => [l.businessName, l.monthlyFee]), [["Bağlı Marka", 4000], ["Ana İşletme", 3000]]);
});

test("ad budget stays separate and untaxed; service lines are taxed like agency fees", () => {
  const { lines } = normalizeServiceLines([{ businessKey: BRAND, description: "SEO", monthlyFee: 1000, setupFee: 0 }], SCOPE);
  const result = calculateProposalFinancials({ adBudgets: [{ platform: "Google Ads", monthlyBudget: 10000 }], agencyMonthlyFee: 0, setupFee: 0, serviceLines: lines, vatRate: 0.2 });
  assert.equal(result.totalMonthlyAdBudget, 10000);
  assert.equal(result.serviceLinesMonthlyInclVat, 1200);
  assert.equal(result.subsequentMonthTotalInclVat, 10000 + 1200);
});

test("server-side financials are derived from the saved questionnaire (proposal reopen/PDF use the same numbers)", () => {
  const q = {
    platforms: ["Google Ads", "Meta Ads", "SEO"],
    budget: { googleAllocation: 12000, metaAllocation: 8000 },
    fees: { monthlyManagementFee: 12000, setupFee: 5000, contractDurationMonths: 1 },
    businessScope: SCOPE,
    businessServiceLines: [{ businessKey: BRAND, description: "Reels üretimi", monthlyFee: 2000, setupFee: 0 }]
  };
  const result = financialsFromQuestionnaire(q);
  assert.equal(result.firstMonthTotalExclVat, 12000 + 8000 + 12000 + 5000 + 2000);
  assert.equal(result.serviceLines[0].businessName, "Bağlı Marka");
  // Removing the brand from scope drops its line from the total.
  assert.equal(financialsFromQuestionnaire({ ...q, businessScope: [SCOPE[0]] }).firstMonthTotalExclVat, 37000);
});
