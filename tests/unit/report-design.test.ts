import test from "node:test";
import assert from "node:assert/strict";
import { displayReportTitle, fitLogo, formatAxisValue, formatCurrencyTr, formatDateTr, formatPercentTr, niceAxisMax, sanitizeChartData, splitMetaLine } from "../../src/lib/report-design.ts";

test("Turkish number formatting: 1.250,50 TL / %12,5 / 15 Ekim 2026", () => {
  assert.equal(formatCurrencyTr(1250.5), "1.250,50 TL");
  assert.equal(formatPercentTr(12.5), "%12,5");
  assert.equal(formatDateTr("2026-10-15"), "15 Ekim 2026");
  assert.equal(formatDateTr("not a date"), "");
  assert.equal(formatAxisValue(12500, "currency"), "12,5 B TL");
});

test("charts: missing values are dropped, never zero-filled; too few points or negatives -> no chart", () => {
  assert.deepEqual(sanitizeChartData([{ label: "A", value: 10 }, { label: "B", value: null }, { label: "C", value: 5 }], "bar"), [{ label: "A", value: 10 }, { label: "C", value: 5 }]);
  assert.equal(sanitizeChartData([{ label: "A", value: 10 }, { label: "B", value: null }], "bar"), null);
  assert.equal(sanitizeChartData([{ label: "A", value: 10 }, { label: "B", value: -2 }], "bar"), null);
  assert.equal(sanitizeChartData([{ label: "A", value: 0 }, { label: "B", value: 0 }], "donut"), null);
  assert.equal(sanitizeChartData([{ label: "A", value: 1 }, { label: "B", value: 2 }], "line"), null, "a trend needs at least 3 points");
});

test("axis always starts at zero and rounds up to a readable maximum", () => {
  assert.equal(niceAxisMax(53), 60);
  assert.equal(niceAxisMax(4820.5), 6000);
  assert.ok(niceAxisMax(0) > 0);
});

test("logo fitting preserves the aspect ratio and balances wide vs square logos", () => {
  const wide = fitLogo(960, 220, 140, 60);
  const square = fitLogo(400, 400, 140, 60);
  assert.ok(Math.abs(wide.width / wide.height - 960 / 220) < 0.01, "no stretching");
  assert.ok(Math.abs(square.width / square.height - 1) < 0.01, "no stretching");
  assert.ok(wide.width <= 140 && wide.height <= 60 && square.width <= 140 && square.height <= 60, "never exceeds the box (never cropped)");
  const area = (s: { width: number; height: number }) => s.width * s.height;
  assert.ok(area(wide) / area(square) < 2.2 && area(square) / area(wide) < 2.2, "visual weight stays comparable");
  assert.deepEqual(fitLogo(0, 10, 100, 50), { width: 0, height: 0 });
});

test("cover helpers", () => {
  assert.deepEqual(splitMetaLine("Rapor Tarihi: 15 Ekim 2026 14:30"), { label: "Rapor Tarihi", value: "15 Ekim 2026 14:30" });
  assert.deepEqual(splitMetaLine("Hazırlayan HK Dijital"), { label: "", value: "Hazırlayan HK Dijital" });
  assert.equal(displayReportTitle("HK Dijital — Ön İnceleme Raporu"), "Ön İnceleme Raporu");
  assert.equal(displayReportTitle("Reklam Performans Raporu"), "Reklam Performans Raporu");
});
