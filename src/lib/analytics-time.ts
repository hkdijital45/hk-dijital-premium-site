// Pure date-range math for the Web Site Analitiği dashboard, kept dependency
// -free (no Supabase/env imports) so it can be unit-tested directly.
//
// Turkey has used a fixed UTC+3 offset (no DST) since 2016, so a plain
// "+03:00" suffix is always correct here — no IANA DST table needed.

export function istanbulDateString(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function istanbulMidnightUtc(dateStr: string) {
  return new Date(`${dateStr}T00:00:00+03:00`);
}

export type AnalyticsRangeInput = { days?: 1 | 7 | 30; start?: string; end?: string };

export function resolveRange(range: AnalyticsRangeInput, now = new Date()) {
  const todayStart = istanbulMidnightUtc(istanbulDateString(now));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  if (range.start && range.end) {
    const start = istanbulMidnightUtc(range.start);
    const endExclusive = new Date(istanbulMidnightUtc(range.end).getTime() + 24 * 60 * 60 * 1000);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(endExclusive.getTime()) && start < endExclusive) {
      return { start, end: endExclusive, todayStart, tomorrowStart };
    }
  }
  const days = range.days || 7;
  return { start: new Date(tomorrowStart.getTime() - days * 24 * 60 * 60 * 1000), end: tomorrowStart, todayStart, tomorrowStart };
}
