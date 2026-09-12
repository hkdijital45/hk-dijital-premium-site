import test from "node:test";
import assert from "node:assert/strict";
import { classifyMeetingSegment } from "../../src/lib/lead-meeting-status.ts";

const TODAY = "2026-09-15";

test("classifyMeetingSegment: meeting_at today (exact date match) is 'today'", () => {
  assert.equal(classifyMeetingSegment("2026-09-15", TODAY), "today");
});

test("classifyMeetingSegment: meeting_at today with a time component is still 'today'", () => {
  assert.equal(classifyMeetingSegment("2026-09-15T14:30:00.000Z", TODAY), "today");
});

test("classifyMeetingSegment: meeting_at in the future is 'upcoming'", () => {
  assert.equal(classifyMeetingSegment("2026-09-20", TODAY), "upcoming");
});

test("classifyMeetingSegment: meeting_at in the past is 'overdue'", () => {
  assert.equal(classifyMeetingSegment("2026-09-01", TODAY), "overdue");
});

test("classifyMeetingSegment: null meeting_at is 'none'", () => {
  assert.equal(classifyMeetingSegment(null, TODAY), "none");
});

test("classifyMeetingSegment: undefined and empty-string meeting_at are also 'none'", () => {
  assert.equal(classifyMeetingSegment(undefined, TODAY), "none");
  assert.equal(classifyMeetingSegment("", TODAY), "none");
});

test("classifyMeetingSegment: defaults 'today' to the real current date when not supplied", () => {
  const now = new Date().toISOString().slice(0, 10);
  assert.equal(classifyMeetingSegment(now), "today");
});
