import assert from "node:assert/strict";
import test from "node:test";
import { filterPlannerTasks, formatTrDate, isValidIsoDate, istanbulToday, plannerCounts, sortPlannerTasks, validateTaskDraft } from "../../src/lib/task-planner.ts";

test("istanbulToday uses Europe/Istanbul calendar day", () => {
  assert.equal(istanbulToday(new Date("2026-11-24T21:30:00Z")), "2026-11-25");
  assert.equal(istanbulToday(new Date("2026-11-24T20:59:00Z")), "2026-11-24");
});

test("date helpers", () => {
  assert.equal(formatTrDate("2026-11-27"), "27.11.2026");
  assert.equal(formatTrDate(null), "Tarih yok");
  assert.equal(isValidIsoDate("2026-02-30"), false);
  assert.equal(isValidIsoDate("2026-11-27"), true);
});

const tasks = [
  { id: "1", company_id: "a", due_date: "2026-11-27", status: "Yapılacak", created_at: "1" },
  { id: "2", company_id: "b", due_date: "2026-11-27", status: "Tamamlandı", created_at: "2" },
  { id: "3", company_id: "a", due_date: "2026-11-25", status: "Yapılacak", created_at: "3" },
  { id: "4", company_id: "a", due_date: "2026-11-27", status: "Yapılacak", archived_at: "x" },
  { id: "5", company_id: "a", due_date: "2026-11-27", status: "İptal" },
  { id: "6", company_id: "a", due_date: "2026-11-27", status: "Yapılacak", _draft: true }
];

test("customer + date filters combine; archived/draft/cancelled hidden", () => {
  assert.deepEqual(filterPlannerTasks(tasks, { companyId: "a", from: "2026-11-27", to: "2026-11-27" }).map((t) => t.id), ["1"]);
  assert.deepEqual(filterPlannerTasks(tasks, { from: "2026-11-27", to: "2026-11-27" }).map((t) => t.id), ["1", "2"]);
  assert.deepEqual(filterPlannerTasks(tasks, {}).map((t) => t.id), ["1", "2", "3"]);
});

test("sort: date, pending first; counts", () => {
  const sorted = sortPlannerTasks(filterPlannerTasks(tasks, {}));
  assert.deepEqual(sorted.map((t) => t.id), ["3", "1", "2"]);
  assert.deepEqual(plannerCounts(sorted), { total: 3, done: 1, pending: 2 });
});

test("validateTaskDraft", () => {
  const ok = { company_id: "a", title: "İş", due_date: "2026-11-27" };
  assert.equal(validateTaskDraft(ok), null);
  assert.equal(validateTaskDraft({ ...ok, title: "   " }), "title");
  assert.equal(validateTaskDraft({ ...ok, company_id: "" }), "company");
  assert.equal(validateTaskDraft({ ...ok, due_date: "" }), "date");
  assert.equal(validateTaskDraft({ ...ok, description: "x".repeat(2001) }), "noteLength");
});
