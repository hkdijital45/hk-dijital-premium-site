import test from "node:test";
import assert from "node:assert/strict";
import {
  dateOnly, monthKey, monthLabel, monthBuckets, taskSource, relatedRecordLabel, assignedUserLabel,
  assignedUserInitials, taskDateTimeLabel, monthOverMonthTrend
} from "../../src/lib/dashboard-overview-helpers.ts";

test("dateOnly: slices a timestamp down to its date, empty/undefined stays empty", () => {
  assert.equal(dateOnly("2026-10-15T09:30:00Z"), "2026-10-15");
  assert.equal(dateOnly(""), "");
  assert.equal(dateOnly(null), "");
  assert.equal(dateOnly(undefined), "");
});

test("monthKey: extracts YYYY-MM from a date/timestamp", () => {
  assert.equal(monthKey("2026-10-15"), "2026-10");
  assert.equal(monthKey("2026-10-15T09:30:00Z"), "2026-10");
  assert.equal(monthKey(""), "");
});

test("monthLabel: Turkish 3-letter month abbreviation + 2-digit year", () => {
  assert.equal(monthLabel("2026-01"), "Oca 26");
  assert.equal(monthLabel("2026-10"), "Eki 26");
  assert.equal(monthLabel("2026-12"), "Ara 26");
});

test("monthBuckets: one bucket per calendar month, oldest first, inclusive of both ends", () => {
  assert.deepEqual(monthBuckets("2026-08-01", "2026-10-31"), ["2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(monthBuckets("2026-10-05", "2026-10-28"), ["2026-10"], "same-month range is exactly one bucket");
});

test("monthBuckets: empty start/end never crashes, returns an empty list", () => {
  assert.deepEqual(monthBuckets("", ""), []);
  assert.deepEqual(monthBuckets("2026-01-01", ""), []);
});

test("monthBuckets: never produces more than 24 buckets even for a very wide range", () => {
  const buckets = monthBuckets("2010-01-01", "2026-12-31");
  assert.ok(buckets.length <= 24, `expected <=24, got ${buckets.length}`);
});

// taskSource: company_id must win over lead_id — mirrors AdminDashboard.tsx's
// AgencyTasksCenter classification exactly (a converted lead can carry both;
// company_id means a real, current customer relationship — the real MY CAKE
// 45 production bug this order fixed).
test("taskSource: company_id wins over lead_id when both are present", () => {
  assert.equal(taskSource({ company_id: "c1", lead_id: "l1" }), "customer");
});

test("taskSource: lead_id alone classifies as lead, neither classifies as internal", () => {
  assert.equal(taskSource({ lead_id: "l1" }), "lead");
  assert.equal(taskSource({}), "internal");
});

test("relatedRecordLabel: resolves the real company/lead name with its (Müşteri)/(Lead) tag, never the raw id", () => {
  const companies = [{ id: "c1", name: "MY CAKE 45" }];
  const leads = [{ id: "l1", company: "Zirve Akademi" }];
  assert.equal(relatedRecordLabel({ company_id: "c1" }, companies, leads), "MY CAKE 45 (Müşteri)");
  assert.equal(relatedRecordLabel({ lead_id: "l1" }, companies, leads), "Zirve Akademi (Lead)");
  assert.equal(relatedRecordLabel({}, companies, leads), "Bağlantısız görev");
});

test("relatedRecordLabel: an id that doesn't resolve to a real record falls back to a generic label, never crashes", () => {
  assert.equal(relatedRecordLabel({ company_id: "missing" }, [], []), "Müşteri");
  assert.equal(relatedRecordLabel({ lead_id: "missing" }, [], []), "Lead");
});

test("assignedUserLabel: resolves full_name, falls back to email, then 'Atanmadı'", () => {
  const users = [{ id: "u1", full_name: "Ayşe Yılmaz", email: "ayse@hkdijital.com" }, { id: "u2", email: "u2@hkdijital.com" }];
  assert.equal(assignedUserLabel({ assigned_user_id: "u1" }, users), "Ayşe Yılmaz");
  assert.equal(assignedUserLabel({ assigned_user_id: "u2" }, users), "u2@hkdijital.com");
  assert.equal(assignedUserLabel({ assigned_user_id: "missing" }, users), "Atanmadı");
  assert.equal(assignedUserLabel({}, users), "Atanmadı");
});

test("assignedUserInitials: real two-word name becomes two initials, unassigned falls back to the HK brand initials", () => {
  const users = [{ id: "u1", full_name: "Ayşe Yılmaz" }];
  assert.equal(assignedUserInitials({ assigned_user_id: "u1" }, users), "AY");
  assert.equal(assignedUserInitials({}, users), "HK");
  assert.equal(assignedUserInitials({ assigned_user_id: "missing" }, users), "HK");
});

test("taskDateTimeLabel: date-only when due_date has no matching reminder_at time, 'Tarih yok' when due_date is missing", () => {
  assert.equal(taskDateTimeLabel({ due_date: "2026-10-21" }), "21 Eki");
  assert.equal(taskDateTimeLabel({}), "Tarih yok");
});

test("taskDateTimeLabel: appends HH:mm (Europe/Istanbul) only when reminder_at falls on the SAME calendar day as due_date", () => {
  assert.equal(taskDateTimeLabel({ due_date: "2026-10-21", reminder_at: "2026-10-21T06:00:00Z" }), "21 Eki 09:00");
  // A reminder set for a different day must never be attached to this due_date.
  assert.equal(taskDateTimeLabel({ due_date: "2026-10-21", reminder_at: "2026-10-20T06:00:00Z" }), "21 Eki");
});

test("monthOverMonthTrend: real percentage change, up/down direction, rounded", () => {
  assert.deepEqual(monthOverMonthTrend(32, 27), { direction: "up", percent: 19 });
  assert.deepEqual(monthOverMonthTrend(6, 7), { direction: "down", percent: 14 });
  assert.deepEqual(monthOverMonthTrend(5, 5), { direction: "up", percent: 0 });
});

test("monthOverMonthTrend: null (never a fabricated/divide-by-zero percentage) when there is no previous-month baseline", () => {
  assert.equal(monthOverMonthTrend(5, 0), null);
});
