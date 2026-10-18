// Run via --conditions=react-server --import tsx — report.ts's own
// relative imports (e.g. "./types") lack explicit extensions, which the
// base --experimental-strip-types runner's stricter ESM resolution
// cannot resolve; not picked up by the flat test:unit/test:security
// scripts, only by the recursive tests/unit/**/*.test.ts suite.
import test from "node:test";
import assert from "node:assert/strict";
import { buildGeminiVisibilityReportPayload } from "../../../src/lib/gemini-visibility/report.ts";
import type { GeminiVisibilityProfile, GeminiVisibilityScan, GeminiVisibilityAnswer } from "../../../src/lib/gemini-visibility/types.ts";

function fakeProfile(overrides: Partial<GeminiVisibilityProfile> = {}): GeminiVisibilityProfile {
  return {
    id: "p1", company_id: "c1", business_name: "Test İşletmesi", alternate_names: [],
    sector: null, city: null, district: null, website: null, service_summary: null, tracking_enabled: true,
    ...overrides
  };
}

function fakeScan(overrides: Partial<GeminiVisibilityScan> = {}): GeminiVisibilityScan {
  return {
    id: "s1", profile_id: "p1", company_id: "c1", status: "completed", model: "gemini-3.5-flash-lite",
    questions_total: 5, questions_completed: 5, questions_failed: 0, scoring_version: "1",
    score: 72, score_breakdown: {} as GeminiVisibilityScan["score_breakdown"], score_level: "strong",
    unmeasured_components: [], previous_scan_id: null, score_change: null, triggered_by: "manual",
    forced_refresh: false, usage_json: {}, error: null,
    started_at: "2026-10-02T21:30:00Z", // 00:30 the next day in Europe/Istanbul
    finished_at: "2026-10-02T21:35:00Z",
    ...overrides
  };
}

// PDF date-only regression — buildGeminiVisibilityReportPayload's `period`
// field used to be a full date+time string (new Date(...).toLocaleString)
// which the cover renderer (premium-pdf.ts's coverDetails) shows verbatim
// as "DÖNEM" whenever it differs from the report date line — a real leak
// of a time-of-day into the exported AI Görünürlük Raporu PDF.
test("buildGeminiVisibilityReportPayload: period is date-only (Europe/Istanbul), never a time-of-day", () => {
  const payload = buildGeminiVisibilityReportPayload("Test İşletmesi", fakeProfile(), fakeScan(), [] as GeminiVisibilityAnswer[]);
  assert.equal(payload.period, "03.10.2026", "must use the real Europe/Istanbul calendar day (21:30 UTC = 00:30 next day in Istanbul)");
  assert.doesNotMatch(String(payload.period), /:/, "must never include a time-of-day");
});
