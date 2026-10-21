// Pure, framework-free helpers for HK Admin Dashboard V2
// (DashboardOverviewV2.tsx) — split out so they're testable under plain
// `node --test` without pulling in React/the chart components.

/** Real month-over-month trend for a stat card — returns null (never a
 * fabricated/divide-by-zero percentage) when the previous month has no
 * baseline to compare against, per the "only show a percentage when
 * reliable historical data exists" requirement. */
export function monthOverMonthTrend(current: number, previous: number): { direction: "up" | "down"; percent: number } | null {
  if (!previous) return null;
  const percent = Math.round(Math.abs(((current - previous) / previous) * 100));
  return { direction: current >= previous ? "up" : "down", percent };
}

export function dateOnly(value: unknown): string {
  return value ? String(value).slice(0, 10) : "";
}

export function monthKey(value: unknown): string {
  const raw = dateOnly(value);
  return raw ? raw.slice(0, 7) : "";
}

const MONTH_NAMES_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const index = Number(month) - 1;
  return `${MONTH_NAMES_TR[index] ?? month} ${year.slice(2)}`;
}

/** One bucket per calendar month overlapping [startDate,endDate], oldest
 * first, capped at 24 so a "Bu Yıl"/wide custom range never renders an
 * unbounded number of bars. */
export function monthBuckets(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(`${endDate.slice(0, 7)}-01T00:00:00Z`);
  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && keys.length < 24) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys.length ? keys : [startDate.slice(0, 7)];
}

/** Mirrors AdminDashboard.tsx's AgencyTasksCenter taskSource() exactly —
 * company_id must win over lead_id (a converted lead can carry both;
 * company_id means a real, current customer relationship — see that
 * file's own MY CAKE 45 classification-bug comment). */
export function taskSource(item: { company_id?: string | null; lead_id?: string | null }): "customer" | "lead" | "internal" {
  return item.company_id ? "customer" : item.lead_id ? "lead" : "internal";
}

export function relatedRecordLabel(
  item: { company_id?: string | null; lead_id?: string | null },
  companies: Array<{ id: string; name?: string }>,
  leads: Array<{ id: string; company?: string; name?: string }>
): string {
  if (item.company_id) {
    const name = companies.find((c) => c.id === item.company_id)?.name;
    return name ? `${name} (Müşteri)` : "Müşteri";
  }
  if (item.lead_id) {
    const name = leads.find((l) => l.id === item.lead_id)?.company || leads.find((l) => l.id === item.lead_id)?.name;
    return name ? `${name} (Lead)` : "Lead";
  }
  return "Bağlantısız görev";
}

export function assignedUserLabel(item: { assigned_user_id?: string | null }, users: Array<{ id: string; full_name?: string; email?: string }>): string {
  if (!item.assigned_user_id) return "Atanmadı";
  const user = users.find((u) => u.id === item.assigned_user_id);
  return user?.full_name || user?.email || "Atanmadı";
}

/** 2-letter avatar initials for the "Atanan" column — falls back to "HK"
 * (this app's own brand initials) when unassigned, matching the single
 * real admin user's own "HK" avatar used throughout HK Admin. */
export function assignedUserInitials(item: { assigned_user_id?: string | null }, users: Array<{ id: string; full_name?: string; email?: string }>): string {
  const label = assignedUserLabel(item, users);
  if (label === "Atanmadı") return "HK";
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : label.slice(0, 2);
  return initials.toLocaleUpperCase("tr");
}

const SHORT_MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** "21 Eki" (date-only) or "21 Eki 09:00" when a real time exists —
 * reminder_at (a real timestamptz column on agency_tasks) supplies the
 * time-of-day ONLY when its own date matches due_date (so an unrelated
 * reminder set for a different day never gets attached to this due date).
 * due_date itself is a bare DATE column with no time component, and a
 * task with no due_date at all is never treated as having a date. */
export function taskDateTimeLabel(item: { due_date?: string | null; reminder_at?: string | null }): string {
  if (!item.due_date) return "Tarih yok";
  const [, month, day] = dateOnly(item.due_date).split("-");
  const dateLabel = `${Number(day)} ${SHORT_MONTHS_TR[Number(month) - 1] ?? month}`;
  if (item.reminder_at && dateOnly(item.reminder_at) === dateOnly(item.due_date)) {
    const time = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(item.reminder_at));
    return `${dateLabel} ${time}`;
  }
  return dateLabel;
}
