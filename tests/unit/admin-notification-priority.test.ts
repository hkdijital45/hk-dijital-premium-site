import test from "node:test";
import assert from "node:assert/strict";
import { isLeadKind, matchesFilter, normalizeNotificationPriority, notificationSummary, sortForAttention } from "../../src/lib/admin-notification-priority.ts";

const newLead = { id: "new-lead-1", kind: "lead_new" as const, priority: normalizeNotificationPriority("high") };
const teamMessage = { id: "agency-1", kind: "operations" as const, priority: normalizeNotificationPriority("normal") };
const campaign = { id: "ending-campaigns-1", kind: "operations" as const, priority: normalizeNotificationPriority("normal") };
const olderHighLead = { id: "lead-follow-up-1", kind: "lead_followup" as const, priority: normalizeNotificationPriority("yüksek") };

test("a new lead is high priority and is never classified as critical", () => {
  assert.equal(newLead.priority, "high");
  assert.equal(isLeadKind(newLead.kind), true);
});

test("a routine team message and a campaign ending notice are not high priority", () => {
  assert.equal(teamMessage.priority, "normal");
  assert.equal(campaign.priority, "normal");
  assert.equal(matchesFilter(teamMessage, "priority"), false);
  assert.equal(matchesFilter(campaign, "priority"), false);
});

test("unread high priority sorts above routine unread items, and read state drops emphasis", () => {
  const ordered = sortForAttention([teamMessage, campaign, newLead], []);
  assert.equal(ordered[0].id, "new-lead-1");
  const readLead = sortForAttention([newLead, teamMessage], ["new-lead-1"]);
  assert.equal(readLead[0].id, "agency-1", "a read lead no longer outranks unread routine items");
});

test("ordering keeps source order within the same group", () => {
  const ordered = sortForAttention([teamMessage, campaign], []);
  assert.deepEqual(ordered.map((item) => item.id), ["agency-1", "ending-campaigns-1"]);
});

test("the Öncelikli and Leadler filters surface the expected items", () => {
  assert.equal(matchesFilter(newLead, "priority"), true);
  assert.equal(matchesFilter(olderHighLead, "priority"), true);
  assert.equal(matchesFilter(newLead, "leads"), true);
  assert.equal(matchesFilter(campaign, "leads"), false);
  assert.equal(matchesFilter(campaign, "operations"), true);
  assert.equal(matchesFilter(newLead, "all"), true);
});

test("summary counts are computed from the real list and read state only", () => {
  const summary = notificationSummary([newLead, teamMessage, campaign], ["agency-1"]);
  assert.deepEqual(summary, { unread: 2, highPriorityUnread: 1, priority: 1 });
  assert.deepEqual(notificationSummary([], []), { unread: 0, highPriorityUnread: 0, priority: 0 });
});

test("unknown or missing priority values fall back to normal, never to critical", () => {
  assert.equal(normalizeNotificationPriority(undefined), "normal");
  assert.equal(normalizeNotificationPriority(""), "normal");
  assert.equal(normalizeNotificationPriority("kritik"), "critical");
});

import { classifyNotification } from "../../src/lib/admin-notification-priority.ts";

test("classifyNotification: new leads are high, overdue/today follow-ups high, campaign endings normal", () => {
  assert.deepEqual(classifyNotification("new-lead-abc"), { kind: "lead_new", priority: "high" });
  assert.deepEqual(classifyNotification("lead-follow-up-2-x"), { kind: "lead_followup", priority: "high" });
  assert.deepEqual(classifyNotification("ending-campaigns-c1"), { kind: "operations", priority: "normal" });
  assert.deepEqual(classifyNotification("today-tasks-2026-10-06-1"), { kind: "operations", priority: "normal" });
});

test("classifyNotification: only a critical source severity produces a critical competitor signal", () => {
  assert.equal(classifyNotification("competitor-signal-1", "critical").priority, "critical");
  assert.equal(classifyNotification("competitor-signal-1", "warning").priority, "normal");
});

test("classifyNotification: a routine team message is never a lead-styled item", () => {
  const team = classifyNotification("agency-notification-7", "normal");
  assert.equal(team.kind, "operations");
  assert.equal(team.priority, "normal");
});
