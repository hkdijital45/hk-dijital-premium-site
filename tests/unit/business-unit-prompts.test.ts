import test from "node:test";
import assert from "node:assert/strict";
import { buildCandidateEvaluationPrompt, buildClaudePrompt } from "../../src/lib/pre-audit/lead-prompts.ts";

const LEAD = { id: "11111111-1111-4111-8111-111111111111", company: "Ana Akademi", instagram: "@anaakademi", website: "https://ana.example", city: "Manisa" };
const BRAND = { businessUnitId: "33333333-3333-4333-8333-333333333333", name: "Bağlı Robotik", instagram: "@bagli", website: "https://bagli.example" };

test("pre-audit prompt for a related brand uses the brand's identity and businessUnitId, never the main Instagram", () => {
  const prompt = buildClaudePrompt(LEAD, BRAND);
  assert.match(prompt, /Firma: Bağlı Robotik/);
  assert.match(prompt, /Instagram: @bagli/);
  assert.doesNotMatch(prompt, /Instagram: @anaakademi/);
  assert.equal((prompt.match(/businessUnitId="33333333-3333-4333-8333-333333333333"/g) || []).length, 2); // context + save
  assert.match(prompt, /Ana Akademi için DEĞİL/);
});

test("candidate evaluation prompt for a related brand saves with businessUnitId", () => {
  const prompt = buildCandidateEvaluationPrompt(LEAD, BRAND);
  assert.match(prompt, /save_candidate_evaluation aracını leadId="11111111-1111-4111-8111-111111111111", businessUnitId="33333333/);
});

test("without a selected business the prompts are unchanged (main business, no businessUnitId)", () => {
  assert.doesNotMatch(buildClaudePrompt(LEAD), /businessUnitId/);
  assert.equal(buildClaudePrompt(LEAD), buildClaudePrompt(LEAD, null));
  assert.match(buildCandidateEvaluationPrompt(LEAD), /Firma: Ana Akademi/);
});
