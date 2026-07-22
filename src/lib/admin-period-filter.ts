// Shared "quick period" resolver for the finance workspaces (Tahsilat,
// Finans/Muhasebe, Kârlılık). Centralized here so all three modules apply
// identical timezone/boundary rules instead of three separate ad-hoc
// implementations. Dates are compared as plain YYYY-MM-DD strings (matching
// how the rest of the app already stores/filters payment_records.due_date
// and agency_expenses.expense_date), so there is no UTC/local-timezone
// conversion drift — "today" means the server's local calendar day.

export type AdminPeriodKey = "today" | "this_week" | "this_month" | "last_30" | "this_year" | "custom";

export const adminPeriodOptions: { key: AdminPeriodKey; label: string }[] = [
  { key: "today", label: "Bugün" },
  { key: "this_week", label: "Bu Hafta" },
  { key: "this_month", label: "Bu Ay" },
  { key: "last_30", label: "Son 30 Gün" },
  { key: "this_year", label: "Bu Yıl" },
  { key: "custom", label: "Özel Aralık" }
];

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Monday-start week, matching Turkish locale convention.
function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(start.getDate() - diff);
  return start;
}

// Payment/expense date fields in this app are sometimes stored at
// month-granularity ("service_period" = "YYYY-MM") and sometimes at
// day-granularity ("YYYY-MM-DD"). A plain string comparison against a
// day-level range boundary silently mis-ranks month-only values (e.g.
// "2026-07" < "2026-07-01" lexicographically, even though July includes
// July 1st onward) — this helper normalizes both shapes before comparing so
// every finance module applies the exact same inclusive-boundary rule.
export function isDateWithinAdminPeriod(dateValue: unknown, startDate: string, endDate: string): boolean {
  const raw = String(dateValue || "");
  if (!raw) return false;
  const startComparable = raw.length === 7 ? `${raw}-01` : raw.slice(0, 10);
  if (startDate && startComparable < startDate) return false;
  // Conservative upper bound for month-only values: every month has at
  // least 28 days, so comparing against day 28 never excludes a month that
  // genuinely overlaps the requested end date.
  const endComparable = raw.length === 7 ? `${raw}-28` : raw.slice(0, 10);
  if (endDate && endComparable > endDate) return false;
  return true;
}

export function resolveAdminPeriodRange(
  key: AdminPeriodKey,
  customStart = "",
  customEnd = "",
  now: Date = new Date()
): { startDate: string; endDate: string } {
  const today = toDateOnly(now);
  switch (key) {
    case "today":
      return { startDate: today, endDate: today };
    case "this_week":
      return { startDate: toDateOnly(startOfWeek(now)), endDate: today };
    case "this_month":
      return { startDate: `${now.toISOString().slice(0, 7)}-01`, endDate: today };
    case "last_30": {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return { startDate: toDateOnly(start), endDate: today };
    }
    case "this_year":
      return { startDate: `${now.getFullYear()}-01-01`, endDate: today };
    case "custom":
    default:
      return { startDate: customStart || "", endDate: customEnd || "" };
  }
}
