// Bugünün Planı yardımcıları. Tarihler takvim günü (YYYY-MM-DD) olarak Europe/Istanbul saatine göre hesaplanır.

const TZ = "Europe/Istanbul";
export const TASK_TITLE_MAX = 200;
export const TASK_NOTE_MAX = 2000;
export const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function istanbulToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !isoDatePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** YYYY-MM-DD -> GG.AA.YYYY */
export function formatTrDate(value?: string | null): string {
  if (!value || !isoDatePattern.test(String(value).slice(0, 10))) return "Tarih yok";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

export type PlannerTask = {
  id: string;
  company_id?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  parent_task_id?: string | null;
  _draft?: boolean;
};

export const isDoneStatus = (status?: string | null) => status === "Tamamlandı";

/** Panelde gösterilecek görevler: arşivlenmemiş, alt görev olmayan, iptal edilmemiş. */
export function isPlannerVisible(task: PlannerTask): boolean {
  return !task._draft && !task.archived_at && !task.deleted_at && !task.parent_task_id && task.status !== "İptal";
}

export function filterPlannerTasks(tasks: PlannerTask[], filters: { companyId?: string; from?: string; to?: string }): PlannerTask[] {
  const { companyId = "", from = "", to = "" } = filters;
  return (tasks || []).filter((task) => {
    if (!isPlannerVisible(task)) return false;
    if (companyId && task.company_id !== companyId) return false;
    const date = String(task.due_date || "").slice(0, 10);
    if (from && (!date || date < from)) return false;
    if (to && (!date || date > to)) return false;
    return true;
  });
}

/** Tarih, sonra bekleyenler önce, sonra oluşturulma sırası. */
export function sortPlannerTasks<T extends PlannerTask>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) =>
    String(a.due_date || "9999-99-99").localeCompare(String(b.due_date || "9999-99-99"))
    || Number(isDoneStatus(a.status)) - Number(isDoneStatus(b.status))
    || String(a.created_at || "").localeCompare(String(b.created_at || ""))
  );
}

export function plannerCounts(tasks: PlannerTask[]) {
  const done = tasks.filter((task) => isDoneStatus(task.status)).length;
  return { total: tasks.length, done, pending: tasks.length - done };
}

export type TaskDraftError = "title" | "titleLength" | "noteLength" | "date" | "company";

export function validateTaskDraft(draft: { company_id?: string; title?: string; description?: string; due_date?: string }): TaskDraftError | null {
  if (!draft.company_id) return "company";
  const title = String(draft.title || "").trim();
  if (!title) return "title";
  if (title.length > TASK_TITLE_MAX) return "titleLength";
  if (String(draft.description || "").length > TASK_NOTE_MAX) return "noteLength";
  if (!isValidIsoDate(draft.due_date)) return "date";
  return null;
}

export const taskDraftMessages: Record<TaskDraftError, string> = {
  company: "Müşteri seçmelisiniz.",
  title: "Yapılacak iş boş bırakılamaz.",
  titleLength: `Yapılacak iş en fazla ${TASK_TITLE_MAX} karakter olabilir.`,
  noteLength: `Açıklama en fazla ${TASK_NOTE_MAX} karakter olabilir.`,
  date: "Geçerli bir görev tarihi seçmelisiniz."
};
