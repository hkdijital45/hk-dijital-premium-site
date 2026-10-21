// Pure, framework-free helpers for HK Admin Dashboard V2
// (DashboardOverviewV2.tsx) — split out so they're testable under plain
// `node --test` without pulling in React/the chart components.

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
  if (item.company_id) return companies.find((c) => c.id === item.company_id)?.name || "Müşteri";
  if (item.lead_id) return leads.find((l) => l.id === item.lead_id)?.company || leads.find((l) => l.id === item.lead_id)?.name || "Lead";
  return "Dahili";
}

export function assignedUserLabel(item: { assigned_user_id?: string | null }, users: Array<{ id: string; full_name?: string; email?: string }>): string {
  if (!item.assigned_user_id) return "Atanmadı";
  const user = users.find((u) => u.id === item.assigned_user_id);
  return user?.full_name || user?.email || "Atanmadı";
}
