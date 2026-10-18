// Shared report-creation-timestamp formatter — ONE helper reused by
// Rapor Merkezi (ReportCenterPanel.tsx), Reklam Doktoru Pro
// (AdEvaluationPanel.tsx), and the PDF/DOCX renderer
// (ad-evaluation-document.ts). Deterministic regardless of the
// machine/process running it (explicit Europe/Istanbul timeZone, never
// the ambient local timezone) — proven live: the real production bug
// this fixes rendered 2026-10-02T16:20:20Z as "02.10.2026 16:20"
// (raw UTC mislabeled as local) instead of the correct "19:20".
import test from "node:test";
import assert from "node:assert/strict";
import { formatReportTimestamp, formatReportDate, compareByTimestampDesc } from "../../../src/lib/report-timestamp.ts";

test("formatReportTimestamp: UTC -> Europe/Istanbul, DD.MM.YYYY HH:mm, matches the proven production case exactly", () => {
  assert.equal(formatReportTimestamp("2026-10-02T16:20:20Z"), "02.10.2026 19:20");
});

test("formatReportTimestamp: deterministic regardless of the ambient process timezone (explicit Intl timeZone, never process.env.TZ)", () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "America/New_York";
    assert.equal(formatReportTimestamp("2026-10-02T16:20:20Z"), "02.10.2026 19:20");
    process.env.TZ = "Asia/Tokyo";
    assert.equal(formatReportTimestamp("2026-10-02T16:20:20Z"), "02.10.2026 19:20");
  } finally {
    if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
  }
});

test("formatReportTimestamp: never shows seconds, never a raw ISO/UTC string", () => {
  const result = formatReportTimestamp("2026-10-02T16:20:20Z");
  assert.doesNotMatch(result, /:\d{2}:\d{2}/, "no seconds");
  assert.doesNotMatch(result, /\dT\d{2}:\d{2}/, "no raw ISO T-separator");
  assert.doesNotMatch(result, /Z$/, "no trailing Z");
});

test("formatReportTimestamp: null/undefined/invalid input is handled safely, never throws, never fabricates a date", () => {
  assert.equal(formatReportTimestamp(null), "Tarih bilgisi yok");
  assert.equal(formatReportTimestamp(undefined), "Tarih bilgisi yok");
  assert.equal(formatReportTimestamp("not-a-real-date"), "Tarih bilgisi yok");
  assert.equal(formatReportTimestamp(""), "Tarih bilgisi yok");
});

test("formatReportTimestamp: accepts a real Date object, not only an ISO string", () => {
  assert.equal(formatReportTimestamp(new Date("2026-10-02T16:20:20Z")), "02.10.2026 19:20");
});

// formatReportDate — the date-only half of formatReportTimestamp, used
// by exported PDF/DOCX reports (which must never show a time-of-day; see
// the "PDF rapor oluşturma" brief) while HK Admin's own UI keeps the full
// date+time via formatReportTimestamp, unchanged.
test("formatReportDate: UTC -> Europe/Istanbul, DD.MM.YYYY, never a time-of-day", () => {
  assert.equal(formatReportDate("2026-10-02T16:20:20Z"), "02.10.2026");
});

test("formatReportDate: never contains a colon/time component, even for a timestamp near the Europe/Istanbul day boundary", () => {
  // 21:30 UTC = 00:30 the NEXT day in Europe/Istanbul (UTC+3) — proves the
  // date half is computed from the real Istanbul calendar day, not UTC's.
  const result = formatReportDate("2026-10-02T21:30:00Z");
  assert.equal(result, "03.10.2026");
  assert.doesNotMatch(result, /:/);
});

test("formatReportDate: deterministic regardless of the ambient process timezone", () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "America/New_York";
    assert.equal(formatReportDate("2026-10-02T16:20:20Z"), "02.10.2026");
    process.env.TZ = "Asia/Tokyo";
    assert.equal(formatReportDate("2026-10-02T16:20:20Z"), "02.10.2026");
  } finally {
    if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
  }
});

test("formatReportDate: null/undefined/invalid input is handled safely, never throws, never fabricates a date", () => {
  assert.equal(formatReportDate(null), "Tarih bilgisi yok");
  assert.equal(formatReportDate(undefined), "Tarih bilgisi yok");
  assert.equal(formatReportDate("not-a-real-date"), "Tarih bilgisi yok");
  assert.equal(formatReportDate(""), "Tarih bilgisi yok");
});

test("formatReportDate: is exactly the date half of formatReportTimestamp — the two can never drift apart, since the latter is built from the former", () => {
  const value = "2026-10-02T16:20:20Z";
  assert.ok(formatReportTimestamp(value).startsWith(formatReportDate(value)));
});

test("compareByTimestampDesc: sorts newest first", () => {
  const items = ["2026-10-01T10:00:00Z", "2026-10-02T16:20:20Z", "2026-09-30T08:00:00Z"];
  assert.deepEqual([...items].sort(compareByTimestampDesc), ["2026-10-02T16:20:20Z", "2026-10-01T10:00:00Z", "2026-09-30T08:00:00Z"]);
});

test("compareByTimestampDesc: a missing/invalid timestamp sorts as oldest, never crashes the sort", () => {
  const items: Array<string | null> = ["2026-10-01T10:00:00Z", null, "invalid", "2026-10-02T16:20:20Z"];
  const sorted = [...items].sort(compareByTimestampDesc);
  assert.equal(sorted[0], "2026-10-02T16:20:20Z");
  assert.equal(sorted[1], "2026-10-01T10:00:00Z");
  assert.ok(sorted.slice(2).every((v) => v === null || v === "invalid"));
});
