// Canonical classification for a lead's real leads.meeting_at column
// (timestamptz, see supabase/migrations/20260624_sales_pipeline_phase2.sql).
// Previously Takip Merkezi's "meeting" bucket used a plain-text search over
// lead.next_action/notes for the word "toplantı" — it ignored meeting_at
// entirely, so a scheduled meeting with no matching note text never showed
// up, and a stale note mentioning a long-past meeting stayed forever.
//
// Dates are compared as plain YYYY-MM-DD strings, matching the rest of the
// app's convention (see admin-period-filter.ts): no Date-object parsing, no
// hardcoded timezone. "Today" is whatever the caller's own
// `new Date().toISOString().slice(0, 10)` resolves to — the same value
// every other admin dashboard module already uses for "today".
export type MeetingSegment = "today" | "upcoming" | "overdue" | "none";

function dateOnly(value: unknown): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function classifyMeetingSegment(meetingAt: unknown, today: string = new Date().toISOString().slice(0, 10)): MeetingSegment {
  const date = dateOnly(meetingAt);
  if (!date) return "none";
  if (date === today) return "today";
  if (date > today) return "upcoming";
  return "overdue";
}
