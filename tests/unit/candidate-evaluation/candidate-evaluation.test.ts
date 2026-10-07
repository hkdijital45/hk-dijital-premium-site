import test from "node:test";
import assert from "node:assert/strict";

// Run via `npm run test:candidate-evaluation` (needs the react-server
// condition for @/ imports). Covers the business-rule-critical pieces:
// Adayı Değerlendir and Ön İnceleme must never cross-wire (TEST5/TEST6/
// TEST7 from the brief), and validateCandidateEvaluation must enforce the
// same "exactly one of company_id/lead_id" rule as Ön İnceleme.

const { validateCandidateEvaluation, CandidateEvaluationValidationError } = await import("../../../src/lib/candidate-evaluation/reports.ts");
const { buildClaudePrompt, buildCandidateEvaluationPrompt } = await import("../../../src/lib/pre-audit/lead-prompts.ts");

const SAMPLE_LEAD = {
  id: "lead-123", company: "Test İşletme", name: null, sector: "Güzellik Salonu", business_type: null,
  city: "Manisa", district: "Şehzadeler", website: "https://example.com", phone: "05551234567",
  instagram: "testisletme", status: "Yeni", rejection_reason: null, rejected_at: null,
  notes: "Instagram'dan bulundu, aktif paylaşım yapıyor.", google_place_id: "abc", source: "Google Maps", created_at: "2026-10-08T00:00:00.000Z"
};

test("validateCandidateEvaluation: requires exactly one of company_id/lead_id, same rule as Ön İnceleme", () => {
  assert.throws(() => validateCandidateEvaluation({}), CandidateEvaluationValidationError);
  assert.throws(() => validateCandidateEvaluation({ company_id: "c1", lead_id: "l1" }), CandidateEvaluationValidationError);
  assert.doesNotThrow(() => validateCandidateEvaluation({ lead_id: "l1" }));
  assert.doesNotThrow(() => validateCandidateEvaluation({ company_id: "c1" }));
});

test("buildCandidateEvaluationPrompt and buildClaudePrompt (Ön İnceleme) are never accidentally identical", () => {
  const candidatePrompt = buildCandidateEvaluationPrompt(SAMPLE_LEAD as any);
  const preAuditPrompt = buildClaudePrompt(SAMPLE_LEAD as any);
  assert.notEqual(candidatePrompt, preAuditPrompt);
});

test("buildCandidateEvaluationPrompt explicitly identifies itself as MÜŞTERİ ADAYI DEĞERLENDİRME, verifies via get_candidate_evaluation_context, and explicitly instructs never calling save_pre_audit_report", () => {
  const prompt = buildCandidateEvaluationPrompt(SAMPLE_LEAD as any);
  assert.match(prompt, /MÜŞTERİ ADAYI DEĞERLENDİRME/);
  assert.match(prompt, /get_candidate_evaluation_context/);
  assert.match(prompt, /save_candidate_evaluation aracını/);
  assert.match(prompt, /ASLA save_pre_audit_report'u çağırmaz/);
  assert.doesNotMatch(prompt, /get_pre_audit_context/);
});

test("buildClaudePrompt (Ön İnceleme) verifies via get_pre_audit_context and saves via save_pre_audit_report, never the candidate-evaluation tools", () => {
  const prompt = buildClaudePrompt(SAMPLE_LEAD as any);
  assert.match(prompt, /get_pre_audit_context/);
  assert.match(prompt, /save_pre_audit_report aracını/);
  assert.doesNotMatch(prompt, /get_candidate_evaluation_context/);
  assert.doesNotMatch(prompt, /save_candidate_evaluation/);
});

test("buildCandidateEvaluationPrompt never fabricates missing optional data — renders a dash, not undefined/null, and never crashes", () => {
  const minimalLead = { ...SAMPLE_LEAD, website: null, instagram: null, notes: null, source: null, sector: null, business_type: null, district: null, city: null };
  const prompt = buildCandidateEvaluationPrompt(minimalLead as any);
  assert.doesNotMatch(prompt, /undefined/);
  assert.doesNotMatch(prompt, /\bnull\b/);
});
