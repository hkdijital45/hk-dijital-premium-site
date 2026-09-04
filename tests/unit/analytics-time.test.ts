import test from "node:test";
import assert from "node:assert/strict";
import { istanbulDateString, istanbulMidnightUtc, resolveRange } from "../../src/lib/analytics-time.ts";

test("istanbulDateString: a late-evening UTC instant is already the next Istanbul calendar day", () => {
  // 22:30 UTC + 3h = 01:30 the next day in Istanbul.
  assert.equal(istanbulDateString(new Date("2026-03-10T22:30:00.000Z")), "2026-03-11");
});

test("istanbulDateString: an early-morning UTC instant is still the same Istanbul day", () => {
  assert.equal(istanbulDateString(new Date("2026-03-10T05:00:00.000Z")), "2026-03-10");
});

test("istanbulMidnightUtc: Istanbul midnight is 21:00 UTC the previous day", () => {
  const midnight = istanbulMidnightUtc("2026-03-11");
  assert.equal(midnight.toISOString(), "2026-03-10T21:00:00.000Z");
});

test("resolveRange: 'today' window is exactly the current Istanbul calendar day", () => {
  const now = new Date("2026-03-11T10:00:00.000Z"); // 13:00 Istanbul
  const { start, end } = resolveRange({ days: 1 }, now);
  assert.equal(start.toISOString(), "2026-03-10T21:00:00.000Z");
  assert.equal(end.toISOString(), "2026-03-11T21:00:00.000Z");
});

test("resolveRange: 7-day window ends at the start of tomorrow (Istanbul), spans exactly 7 days", () => {
  const now = new Date("2026-03-11T10:00:00.000Z");
  const { start, end } = resolveRange({ days: 7 }, now);
  const spanDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  assert.equal(spanDays, 7);
  assert.equal(end.toISOString(), "2026-03-11T21:00:00.000Z");
});

test("resolveRange: explicit custom start/end is inclusive of the whole end day", () => {
  const { start, end } = resolveRange({ start: "2026-01-01", end: "2026-01-03" });
  assert.equal(start.toISOString(), "2025-12-31T21:00:00.000Z");
  assert.equal(end.toISOString(), "2026-01-03T21:00:00.000Z");
});

test("resolveRange: an invalid custom range (end before start) falls back to the days window", () => {
  const now = new Date("2026-03-11T10:00:00.000Z");
  const { start, end } = resolveRange({ start: "2026-01-05", end: "2026-01-01", days: 7 }, now);
  const spanDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  assert.equal(spanDays, 7);
});
