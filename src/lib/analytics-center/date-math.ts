// Pure date/comparison math — deliberately has no "server-only" import and
// no Supabase/fetch dependency, unlike the rest of this module, so it can
// be unit-tested directly (see tests/unit/analytics-center.test.ts) and
// safely imported from either server or client code if ever needed.
import type { DateRange } from "./types";

export type ComparisonMode = "previous_period" | "previous_month" | "previous_year" | "off";

// Parses a "YYYY-MM-DD" string into UTC-anchored components and formats it
// back the same way — deliberately never uses new Date(isoString) together
// with LOCAL getters (getFullYear/getMonth/getDate): that combination
// parses the string as UTC midnight but reads it back in the server's
// local timezone, silently shifting the date by a day whenever local time
// is behind UTC (the same class of bug already flagged elsewhere in this
// app — see AdminDashboard.tsx's formatDate comment). Date.UTC(...) +
// getUTCFullYear/getUTCMonth/getUTCDate keeps every step in the same
// timezone throughout.
function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// "previous_period" (default): immediately preceding range of equal
// length — always well-defined regardless of period length.
// "previous_month"/"previous_year": shift the exact same range back one
// calendar month/year — a real, distinct comparison an agency actually
// asks for ("geçen ay", "geçen yıl aynı dönem"), not just a relabeled
// previous_period.
export function previousRange(range: DateRange, mode: ComparisonMode = "previous_period"): DateRange {
  const start = parseIsoDate(range.startDate);
  const end = parseIsoDate(range.endDate);
  if (mode === "previous_month") {
    const shift = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, d.getUTCDate()));
    return { startDate: formatIsoDate(shift(start)), endDate: formatIsoDate(shift(end)) };
  }
  if (mode === "previous_year") {
    const shift = (d: Date) => new Date(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate()));
    return { startDate: formatIsoDate(shift(start)), endDate: formatIsoDate(shift(end)) };
  }
  const lengthDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (lengthDays - 1) * 86400000);
  return { startDate: formatIsoDate(prevStart), endDate: formatIsoDate(prevEnd) };
}

export function comparisonPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (!previous && !current) return 0;
  if (!previous) return current > 0 ? 100 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
