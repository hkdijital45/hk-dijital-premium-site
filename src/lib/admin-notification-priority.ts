// Business-priority model for the admin Bildirim Merkezi. Priority is derived
// from each notification's kind and source severity, never from decorative
// color, so the UI can rank items without an error-dashboard look.
export type NotificationPriority = "critical" | "high" | "normal" | "low";
export type NotificationKind = "lead_new" | "lead_followup" | "lead" | "operations" | "system";
export type NotificationFilter = "all" | "priority" | "leads" | "operations";

export type AttentionNotification = {
  id: string;
  kind: NotificationKind;
  priority: NotificationPriority;
};

const RANK: Record<NotificationPriority, number> = { critical: 4, high: 3, normal: 2, low: 1 };

export function normalizeNotificationPriority(value: unknown): NotificationPriority {
  const key = String(value ?? "").trim().toLocaleLowerCase("tr");
  if (["critical", "kritik"].includes(key)) return "critical";
  if (["high", "yüksek", "yuksek", "warning", "uyarı", "uyari"].includes(key)) return "high";
  if (["low", "düşük", "dusuk", "bilgi", "info"].includes(key)) return "low";
  return "normal";
}

export function priorityLabel(priority: NotificationPriority): string {
  return { critical: "Kritik", high: "Yüksek", normal: "Normal", low: "Düşük" }[priority];
}

export function isLeadKind(kind: NotificationKind): boolean {
  return kind === "lead_new" || kind === "lead_followup" || kind === "lead";
}

export function isHighPriority(item: { priority: NotificationPriority }): boolean {
  return RANK[item.priority] >= RANK.high;
}

// Unread first, then higher priority; original (newest-first source) order is
// kept within each group because Array.prototype.sort is stable.
export function sortForAttention<T extends AttentionNotification>(items: T[], readIds: string[]): T[] {
  const read = new Set(readIds);
  return [...items].sort((a, b) => {
    const unreadDelta = Number(read.has(a.id)) - Number(read.has(b.id));
    if (unreadDelta !== 0) return unreadDelta;
    return RANK[b.priority] - RANK[a.priority];
  });
}

export function matchesFilter<T extends AttentionNotification>(item: T, filter: NotificationFilter): boolean {
  if (filter === "priority") return isHighPriority(item);
  if (filter === "leads") return isLeadKind(item.kind);
  if (filter === "operations") return !isLeadKind(item.kind);
  return true;
}

export function notificationSummary<T extends AttentionNotification>(items: T[], readIds: string[]) {
  const read = new Set(readIds);
  const unread = items.filter((item) => !read.has(item.id));
  return {
    unread: unread.length,
    highPriorityUnread: unread.filter(isHighPriority).length,
    priority: items.filter(isHighPriority).length
  };
}

// Maps a derived notification id to its business kind and priority. Overdue
// lead follow-ups and today's follow-ups are high; upcoming or routine items
// stay normal/low, and only a source-reported critical severity is critical.
export function classifyNotification(id: string, sourcePriority?: unknown): { kind: NotificationKind; priority: NotificationPriority } {
  if (id.startsWith("new-lead-")) return { kind: "lead_new", priority: "high" };
  if (id.startsWith("new-requests-more-")) return { kind: "lead", priority: "normal" };
  if (id.startsWith("lead-follow-up-")) return { kind: "lead_followup", priority: "high" };
  if (id.startsWith("proposal-follow-up-")) return { kind: "lead", priority: "normal" };
  if (id.startsWith("overdue-payments-") || id.startsWith("critical-tasks-")) return { kind: "operations", priority: "high" };
  if (id.startsWith("today-tasks-") || id.startsWith("ending-campaigns-")) return { kind: "operations", priority: "normal" };
  if (id.startsWith("system-health-")) return { kind: "system", priority: "low" };
  if (id.startsWith("competitor-signal-")) return { kind: "operations", priority: normalizeNotificationPriority(sourcePriority) === "critical" ? "critical" : "normal" };
  return { kind: "operations", priority: normalizeNotificationPriority(sourcePriority) };
}
