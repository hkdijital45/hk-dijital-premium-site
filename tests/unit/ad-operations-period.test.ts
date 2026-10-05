import test from "node:test";
import assert from "node:assert/strict";
import { customPeriodLabel, formatCustomPeriodDisplay, periodDisplayLabel, syncRangeForPeriod, validateCustomPeriod, parseCustomPeriodLabel } from "../../src/lib/ad-operations-period.ts";

const TODAY = "2026-10-05";

test("CASE 1-3: presets keep their existing sync mapping", () => {
  assert.deepEqual(syncRangeForPeriod("Bugün"), { rangePreset: "today" });
  assert.deepEqual(syncRangeForPeriod("Son 7 Gün"), { rangePreset: "last_7d" });
  assert.deepEqual(syncRangeForPeriod("Son 30 Gün"), { rangePreset: "last_30d" });
});

test("CASE 4: a single custom date resolves to startDate === endDate", () => {
  const result = validateCustomPeriod("2026-10-03", "", TODAY);
  assert.deepEqual(result, { ok: true, start: "2026-10-03", end: "2026-10-03" });
  assert.deepEqual(syncRangeForPeriod(customPeriodLabel("2026-10-03", "2026-10-03")), { rangePreset: "custom", dateFrom: "2026-10-03", dateTo: "2026-10-03" });
});

test("CASE 5/6: a custom range resolves to exactly those dates and is what the sync receives", () => {
  const result = validateCustomPeriod("2026-10-01", "2026-10-05", TODAY);
  assert.deepEqual(result, { ok: true, start: "2026-10-01", end: "2026-10-05" });
  assert.deepEqual(syncRangeForPeriod(customPeriodLabel("2026-10-01", "2026-10-05")), { rangePreset: "custom", dateFrom: "2026-10-01", dateTo: "2026-10-05" });
});

test("CASE 7: leaving a custom range for a preset drops the custom dates entirely", () => {
  assert.deepEqual(syncRangeForPeriod("Son 7 Gün"), { rangePreset: "last_7d" });
});

test("CASE 9: an invalid reversed range is rejected before any data request", () => {
  const result = validateCustomPeriod("2026-10-05", "2026-10-01", TODAY);
  assert.equal(result.ok, false);
});

test("future dates are rejected", () => {
  assert.equal(validateCustomPeriod("2026-10-06", "2026-10-06", TODAY).ok, false);
  assert.equal(validateCustomPeriod("2026-10-01", "2026-10-09", TODAY).ok, false);
});

test("malformed or missing start is rejected", () => {
  assert.equal(validateCustomPeriod("", "", TODAY).ok, false);
  assert.equal(validateCustomPeriod("2026-02-30", "", TODAY).ok, false);
});

test("the label round-trips and display uses numeric Turkish dates", () => {
  assert.deepEqual(parseCustomPeriodLabel("2026-10-01 - 2026-10-05"), { start: "2026-10-01", end: "2026-10-05" });
  assert.equal(parseCustomPeriodLabel("Son 30 Gün"), null);
  assert.equal(formatCustomPeriodDisplay("2026-10-01", "2026-10-05"), "01.10.2026 – 05.10.2026");
  assert.equal(formatCustomPeriodDisplay("2026-10-03", "2026-10-03"), "03.10.2026");
  assert.equal(periodDisplayLabel("2026-10-01 - 2026-10-05"), "01.10.2026 – 05.10.2026");
  assert.equal(periodDisplayLabel("Son 7 Gün"), "Son 7 Gün");
});

test("CASE 10 input: custom labels match the server's own date_range_label format", () => {
  assert.equal(customPeriodLabel("2026-10-01", "2026-10-05"), "2026-10-01 - 2026-10-05");
});
