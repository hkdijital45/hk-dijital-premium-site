// Manuel Değerlendirme PDF/DOCX payload builder — date-only regression.
// Run via --conditions=react-server --import tsx (the module is
// "server-only"); not picked up by the flat test:unit/test:security
// scripts, only by the recursive tests/unit/**/*.test.ts suite.
import test from "node:test";
import assert from "node:assert/strict";
import { buildManualEvaluationDocumentPayload } from "../../../src/lib/manual-evaluation-document.ts";
import type { ManualEvaluationRecord } from "../../../src/lib/manual-evaluations-shared.ts";

function fakeEvaluation(overrides: Partial<ManualEvaluationRecord> = {}): ManualEvaluationRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    module: "instagram",
    company_id: null,
    lead_id: "22222222-2222-4222-8222-222222222222",
    target_label: "Test İşletmesi",
    title: "Test Değerlendirmesi",
    status: "submitted",
    data: { businessName: "Test İşletmesi" },
    derived_metrics: {},
    source: "manual",
    claude_import: null,
    notes: "",
    created_by: null,
    created_at: "2026-10-02T21:30:00Z", // 00:30 the next day in Europe/Istanbul
    updated_at: "2026-10-02T21:30:00Z",
    ...overrides
  } as ManualEvaluationRecord;
}

test("buildManualEvaluationDocumentPayload: internal 'Oluşturulma' row is date-only (Europe/Istanbul), never a time-of-day", () => {
  const evaluation = fakeEvaluation();
  const payload = buildManualEvaluationDocumentPayload("Test İşletmesi", evaluation, "internal");
  const table = payload.sections.find((s) => s.title === "Veri Güvenilirliği")?.table;
  const row = table?.rows.find((r) => r[0] === "Oluşturulma");
  assert.ok(row, "Oluşturulma row must exist in the internal Veri Güvenilirliği table");
  assert.equal(row![1], "03.10.2026", "must use the real Europe/Istanbul calendar day (21:30 UTC = 00:30 next day in Istanbul), not the UTC day");
  assert.doesNotMatch(String(row![1]), /:/, "must never include a time-of-day");
});

test("buildManualEvaluationDocumentPayload: cover 'period' falls back to the date-only created_at when no analysis date range is entered", () => {
  const evaluation = fakeEvaluation();
  const payload = buildManualEvaluationDocumentPayload("Test İşletmesi", evaluation, "client");
  assert.equal(payload.period, "03.10.2026");
  assert.doesNotMatch(String(payload.period), /:/);
});

test("buildManualEvaluationDocumentPayload: cover 'period' still uses the entered analysis date range when present, unaffected by this fix", () => {
  const evaluation = fakeEvaluation({ data: { businessName: "Test İşletmesi", analysisStartDate: "2026-09-01", analysisEndDate: "2026-09-30" } });
  const payload = buildManualEvaluationDocumentPayload("Test İşletmesi", evaluation, "client");
  assert.equal(payload.period, "2026-09-01 – 2026-09-30");
});
