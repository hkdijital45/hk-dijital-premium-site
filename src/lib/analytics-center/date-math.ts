// Pure date/comparison math — deliberately has no "server-only" import and
// no Supabase/fetch dependency, unlike the rest of this module, so it can
// be unit-tested directly (see tests/unit/analytics-center.test.ts) and
// safely imported from either server or client code if ever needed.
import type { DateRange } from "./types";

export function previousRange(range: DateRange): DateRange {
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);
  const lengthDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (lengthDays - 1) * 86400000);
  return { startDate: prevStart.toISOString().slice(0, 10), endDate: prevEnd.toISOString().slice(0, 10) };
}

export function comparisonPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (!previous && !current) return 0;
  if (!previous) return current > 0 ? 100 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
