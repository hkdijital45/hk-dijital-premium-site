"use client";

// HK Admin Dashboard V3 — pixel-close rebuild of the Genel Bakış content
// against a supplied reference screenshot: header (title/subtitle + date +
// period selector), 5 stat cards, "Bugün Yapılacaklar" task table with
// status counters, and a 3x2 light-themed chart grid. This REPLACES
// MissionControl's old rendered body for this view (see MissionControl.tsx
// — legacy widgets are no longer rendered here, their components/APIs are
// untouched and still used elsewhere). Reuses the app's only chart
// primitives (analytics/charts.tsx, now theme="light"-capable — see that
// file) and the shared admin-period-filter date-range convention; no new
// chart library, no new dependency.
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Calendar } from "lucide-react";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { adminPeriodOptions, resolveAdminPeriodRange, type AdminPeriodKey } from "@/lib/admin-period-filter";
import { AnalyticsBarChart, AnalyticsDonutChart, AnalyticsLineChart, type SeriesPoint } from "@/components/admin/analytics/charts";
import { istanbulDateString } from "@/lib/analytics-time";
import { dateOnly, monthKey, monthLabel, monthBuckets, taskSource, relatedRecordLabel, assignedUserLabel, assignedUserInitials, taskDateTimeLabel } from "@/lib/dashboard-overview-helpers";
import { useProposalStatusCounts } from "./useProposalStatusCounts";
import type { NavigateFn } from "./types";

export type DashboardStatCard = { label: string; value: ReactNode; trend: { direction: "up" | "down"; percent: number } | null; neutralHint: string; icon: ReactNode; tone: "info" | "success" | "warning" | "danger"; target: string };

const LEAD_SOURCE_OPTIONS = ["İletişim Formu", "Teklif Formu", "Teklif Sihirbazı", "Müşteri Bulucu", "Meta Analiz", "Google Ads Analiz", "Instagram", "WhatsApp", "Referans", "Manuel Giriş", "Diğer"];
const DONUT_PALETTE = ["#1673F9", "#0AA66A", "#F4B400", "#E53935", "#7c3aed", "#64748b", "#0d9488", "#ca8a04", "#4f46e5", "#db2777", "#2563eb"];
const TONE_BG: Record<string, string> = { info: "bg-blue-50 text-blue-700", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700", danger: "bg-red-50 text-red-700" };

function priorityTone(priority?: string): AdminStatusTone {
  if (priority === "Kritik") return "danger";
  if (priority === "Yüksek") return "warning";
  return "neutral";
}

function statusTone(status?: string): AdminStatusTone {
  if (status === "Tamamlandı") return "success";
  if (status === "İptal") return "neutral";
  if (status === "Devam Ediyor") return "info";
  return "warning";
}

// --- Header: title/subtitle (left) + date + global period selector (right) ---

function DashboardHeaderBar({ periodKey, onPeriodChange }: { periodKey: AdminPeriodKey; onPeriodChange: (key: AdminPeriodKey) => void }) {
  const today = useMemo(() => new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "long", year: "numeric" }).format(new Date()), []);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black" style={{ color: "var(--admin-text-primary)" }}>Genel Bakış</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>Bugünkü işleriniz, performansınız ve önemli istatistikler</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="admin-card flex items-center gap-2 rounded-[10px] px-3 py-2 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}><Calendar size={14} /> {today}</span>
        <select
          value={periodKey}
          onChange={(event) => onPeriodChange(event.target.value as AdminPeriodKey)}
          className="admin-card min-h-9 rounded-[10px] px-3 text-xs font-bold"
          style={{ color: "var(--admin-text-secondary)" }}
          aria-label="Raporlama dönemi"
        >
          {adminPeriodOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
      </div>
    </div>
  );
}

// --- 5 stat cards -----------------------------------------------------

function StatCardsRow({ cards, onNavigate }: { cards: DashboardStatCard[]; onNavigate: NavigateFn }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <button type="button" key={card.label} onClick={() => onNavigate(card.target)} className="admin-card rounded-[14px] p-4 text-left transition hover:shadow-md">
          <span className={`grid size-10 place-items-center rounded-[10px] ${TONE_BG[card.tone]}`}>{card.icon}</span>
          <p className="mt-3 text-[13px] font-bold" style={{ color: "var(--admin-text-secondary)" }}>{card.label}</p>
          <p className="text-2xl font-black leading-tight" style={{ color: "var(--admin-text-primary)" }}>{card.value}</p>
          {card.trend ? (
            <p className={`mt-1.5 flex items-center gap-1 text-xs font-black ${card.trend.direction === "up" ? "text-emerald-600" : "text-red-600"}`}>
              {card.trend.direction === "up" ? "↑" : "↓"} %{card.trend.percent}
              <span className="font-bold" style={{ color: "var(--admin-text-muted)" }}>Geçen aya göre</span>
            </p>
          ) : (
            <p className="mt-1.5 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{card.neutralHint}</p>
          )}
        </button>
      ))}
    </div>
  );
}

// --- "Bugün Yapılacaklar" task table -----------------------------------

type TaskFilter = "all" | "overdue" | "pending" | "done";

function TodayTasksTable({
  tasks, companies, leads, users, completingIds, onCompleteTask, onNavigate
}: {
  tasks: any[]; companies: any[]; leads: any[]; users: any[];
  completingIds: Set<string>; onCompleteTask: (id: string) => void; onNavigate: NavigateFn;
}) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const counts = useMemo(() => ({
    all: tasks.length,
    overdue: tasks.filter((t) => t.__overdue).length,
    pending: tasks.filter((t) => !t.__overdue && t.status !== "Tamamlandı").length,
    done: tasks.filter((t) => t.status === "Tamamlandı").length
  }), [tasks]);
  const visible = filter === "all" ? tasks : filter === "overdue" ? tasks.filter((t) => t.__overdue) : filter === "pending" ? tasks.filter((t) => !t.__overdue && t.status !== "Tamamlandı") : tasks.filter((t) => t.status === "Tamamlandı");

  const pill = (key: TaskFilter, label: string, tone: string) => (
    <button
      type="button"
      key={key}
      onClick={() => setFilter(key)}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition ${filter === key ? tone : "border"}`}
      style={filter === key ? undefined : { borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}
    >
      {label} <span className={filter === key ? "" : "rounded-full px-1.5"} style={filter === key ? undefined : { background: "var(--admin-surface-soft)" }}>{counts[key]}</span>
    </button>
  );

  return (
    <div className="admin-card rounded-[16px] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[10px] bg-blue-50 text-blue-700"><Calendar size={18} /></span>
          <div>
            <h2 className="text-base font-black" style={{ color: "var(--admin-text-primary)" }}>Bugün Yapılacaklar</h2>
            <p className="text-xs" style={{ color: "var(--admin-text-secondary)" }}>Bugünkü ve gecikmiş görevleriniz</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pill("all", "Tümü", "bg-blue-600 text-white")}
          {pill("overdue", "Geciken", "bg-red-600 text-white")}
          {pill("pending", "Bekleyen", "bg-amber-500 text-white")}
          {pill("done", "Yapılan", "bg-emerald-600 text-white")}
          <button type="button" onClick={() => onNavigate("Görevler")} className="ml-1 flex items-center gap-1 text-xs font-black text-blue-700">Tüm görevleri görüntüle <ArrowRight size={13} /></button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 rounded-[14px] border border-dashed p-6 text-center text-sm" style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-muted)" }}>
          Bu filtrede görev yok.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>
                <th className="p-2 w-8"></th>
                <th className="p-2">Yapılacak İş</th>
                <th className="p-2">İlgili Kayıt</th>
                <th className="p-2">Atanan</th>
                <th className="p-2">Tarih</th>
                <th className="p-2">Öncelik</th>
                <th className="p-2">Durum</th>
                <th className="p-2 w-14">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const id = item.id || item.title;
                const done = item.status === "Tamamlandı";
                const overdue = !done && item.__overdue;
                const rowBg = done ? "bg-emerald-50" : overdue ? "bg-red-50" : "bg-amber-50";
                return (
                  <tr key={id} className={`${rowBg} border-t`} style={{ borderColor: "var(--admin-border)" }}>
                    <td className="p-2.5 align-middle">
                      <input type="checkbox" checked={done} disabled={done || completingIds.has(id)} onChange={() => !done && onCompleteTask(id)} aria-label={`${item.title || "Görev"} tamamlandı olarak işaretle`} />
                    </td>
                    <td className="p-2.5 align-middle font-bold" style={{ color: "var(--admin-text-primary)" }}>{item.title || "Görev"}</td>
                    <td className="p-2.5 align-middle" style={{ color: "var(--admin-text-secondary)" }}>{relatedRecordLabel(item, companies, leads)}</td>
                    <td className="p-2.5 align-middle">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="grid size-6 place-items-center rounded-full bg-blue-600 text-[10px] font-black text-white">{assignedUserInitials(item, users)}</span>
                      </span>
                    </td>
                    <td className="p-2.5 align-middle whitespace-nowrap" style={{ color: "var(--admin-text-secondary)" }}>{taskDateTimeLabel(item)}</td>
                    <td className="p-2.5 align-middle"><AdminStatusBadge tone={priorityTone(item.priority)}>{item.priority || "Normal"}</AdminStatusBadge></td>
                    <td className="p-2.5 align-middle">
                      <AdminStatusBadge tone={overdue ? "danger" : statusTone(item.status)}>{overdue ? "Gecikti" : done ? "Tamamlandı" : "Bekliyor"}</AdminStatusBadge>
                    </td>
                    <td className="p-2.5 align-middle">
                      <button type="button" onClick={() => onNavigate(taskSource(item) === "customer" ? "Müşteriler" : taskSource(item) === "lead" ? "Lead Merkezi" : "Görevler")} className="text-base font-black" style={{ color: "var(--admin-text-muted)" }} aria-label="Görevi aç">⋯</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- One 3x2 chart grid card wrapper with its own period select -------

// resetSignal: changing the header's global period selector reseeds every
// per-chart selector below it to match (its initial/only value on first
// render too) — each can still be individually overridden afterward (the
// header sets a shared default, not a lock).
function usePeriod(resetSignal: AdminPeriodKey) {
  const [key, setKey] = useState<AdminPeriodKey>(resetSignal);
  // React's own sanctioned "adjust state during render" pattern (not an
  // effect — see "You Might Not Need An Effect") for resetting derived
  // state when a prop changes: setState called conditionally, synchronously
  // in the render body, React re-renders immediately before committing.
  const [prevResetSignal, setPrevResetSignal] = useState(resetSignal);
  if (resetSignal !== prevResetSignal) {
    setPrevResetSignal(resetSignal);
    setKey(resetSignal);
  }
  const range = useMemo(() => resolveAdminPeriodRange(key), [key]);
  const select = (
    <select value={key} onChange={(e) => setKey(e.target.value as AdminPeriodKey)} className="rounded-[8px] border bg-transparent px-2 py-1 text-[11px] font-bold" style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }} aria-label="Grafik dönemi">
      {adminPeriodOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
    </select>
  );
  return { ...range, select };
}

export function DashboardOverviewV2({
  statCards, tasks, companies, leads, users, onNavigate, onCompleteTask, completingIds
}: {
  statCards: DashboardStatCard[];
  tasks: any[];
  companies: any[];
  leads: any[];
  users: any[];
  onNavigate: NavigateFn;
  onCompleteTask: (id: string) => void;
  completingIds: Set<string>;
}) {
  const [headerPeriod, setHeaderPeriod] = useState<AdminPeriodKey>("last_30");
  const istanbulToday = useMemo(() => istanbulDateString(new Date()), []);

  const todayTasks = useMemo(() => {
    const mark = (item: any, overdue: boolean) => ({ ...item, __overdue: overdue });
    const overdue = tasks.filter((t) => t.due_date && dateOnly(t.due_date) < istanbulToday && !["Tamamlandı", "İptal"].includes(t.status)).map((t) => mark(t, true));
    const duePending = tasks.filter((t) => t.due_date && dateOnly(t.due_date) === istanbulToday && !["Tamamlandı", "İptal"].includes(t.status)).map((t) => mark(t, false));
    const dueDone = tasks.filter((t) => t.due_date && dateOnly(t.due_date) === istanbulToday && t.status === "Tamamlandı").map((t) => mark(t, false));
    return [...overdue, ...duePending, ...dueDone];
  }, [tasks, istanbulToday]);

  // Charts 1/2: monthly bucketing only makes sense over several months —
  // fixed "Son 6 ay" window (not user-editable), independent of the other
  // 4 charts' own per-chart period selector.
  const months = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setMonth(start.getMonth() - 5);
    return monthBuckets(monthKey(start.toISOString()), monthKey(end.toISOString()));
  }, []);

  const leadMonthlyBar: SeriesPoint[] = useMemo(() => months.map((key) => ({ label: monthLabel(key), value: leads.filter((l) => monthKey(l.created_at) === key).length })), [months, leads]);
  const customerMonthlyBar: SeriesPoint[] = useMemo(() => months.map((key) => ({ label: monthLabel(key), value: companies.filter((c) => c.status === "Aktif" && monthKey(c.created_at) === key).length })), [months, companies]);
  const growthLine: SeriesPoint[] = useMemo(() => {
    const leadBefore = leads.filter((l) => l.created_at && monthKey(l.created_at) < (months[0] || "")).length;
    const customerBefore = companies.filter((c) => c.status === "Aktif" && c.created_at && monthKey(c.created_at) < (months[0] || "")).length;
    const points: SeriesPoint[] = [];
    months.reduce((acc, key) => {
      const leadRunning = acc.leadRunning + leads.filter((l) => monthKey(l.created_at) === key).length;
      const customerRunning = acc.customerRunning + companies.filter((c) => c.status === "Aktif" && monthKey(c.created_at) === key).length;
      points.push({ label: monthLabel(key), value: leadRunning, compareValue: customerRunning });
      return { leadRunning, customerRunning };
    }, { leadRunning: leadBefore, customerRunning: customerBefore });
    return points;
  }, [months, leads, companies]);

  const taskStatusPeriod = usePeriod(headerPeriod);
  const taskStatusDonut = useMemo(() => {
    const inRange = tasks.filter((t) => { const key = dateOnly(t.due_date || t.created_at); return key && key >= taskStatusPeriod.startDate && key <= taskStatusPeriod.endDate; });
    const completed = inRange.filter((t) => t.status === "Tamamlandı").length;
    const overdue = inRange.filter((t) => t.status !== "Tamamlandı" && t.status !== "İptal" && t.due_date && dateOnly(t.due_date) < istanbulToday).length;
    const inProgress = inRange.filter((t) => t.status === "Devam Ediyor" && !(t.due_date && dateOnly(t.due_date) < istanbulToday)).length;
    const pending = inRange.filter((t) => ["Yapılacak", "Beklemede"].includes(t.status || "Yapılacak") && !(t.due_date && dateOnly(t.due_date) < istanbulToday)).length;
    return [
      { label: "Tamamlandı", value: completed, color: "#0AA66A" },
      { label: "Bekliyor", value: pending, color: "#F4B400" },
      { label: "Gecikti", value: overdue, color: "#E53935" },
      { label: "Devam Ediyor", value: inProgress, color: "#1673F9" }
    ];
  }, [tasks, taskStatusPeriod.startDate, taskStatusPeriod.endDate, istanbulToday]);

  const leadSourcePeriod = usePeriod(headerPeriod);
  const leadSourceDonut = useMemo(() => {
    const inRange = leads.filter((l) => { const key = dateOnly(l.created_at); return key && key >= leadSourcePeriod.startDate && key <= leadSourcePeriod.endDate; });
    return LEAD_SOURCE_OPTIONS.map((source, index) => ({
      label: source,
      value: inRange.filter((l) => (l.source || "Diğer") === source || (source === "Diğer" && !LEAD_SOURCE_OPTIONS.includes(l.source))).length,
      color: DONUT_PALETTE[index % DONUT_PALETTE.length]
    })).filter((d) => d.value > 0);
  }, [leads, leadSourcePeriod.startDate, leadSourcePeriod.endDate]);

  const tasksByUserPeriod = usePeriod(headerPeriod);
  const tasksByUserBar: SeriesPoint[] = useMemo(() => {
    const completed = tasks.filter((t) => t.status === "Tamamlandı" && t.completed_at && dateOnly(t.completed_at) >= tasksByUserPeriod.startDate && dateOnly(t.completed_at) <= tasksByUserPeriod.endDate);
    const byUser = new Map<string, number>();
    for (const task of completed) { const label = assignedUserLabel(task, users); byUser.set(label, (byUser.get(label) || 0) + 1); }
    return Array.from(byUser.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [tasks, users, tasksByUserPeriod.startDate, tasksByUserPeriod.endDate]);

  const proposalPeriod = usePeriod(headerPeriod);
  const proposalDonut = useProposalStatusCounts(proposalPeriod.startDate, proposalPeriod.endDate);

  return (
    <div className="grid gap-5">
      <DashboardHeaderBar periodKey={headerPeriod} onPeriodChange={setHeaderPeriod} />
      <StatCardsRow cards={statCards} onNavigate={onNavigate} />
      <TodayTasksTable tasks={todayTasks} companies={companies} leads={leads} users={users} completingIds={completingIds} onCompleteTask={onCompleteTask} onNavigate={onNavigate} />

      <div className="grid gap-4 lg:grid-cols-3">
        <AnalyticsBarChart
          theme="light" height={240} title="Aylık Lead ve Müşteri Sayıları"
          action={<span className="rounded-[8px] border px-2 py-1 text-[11px] font-bold" style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-muted)" }}>Son 6 ay</span>}
          data={leadMonthlyBar} color="#1673F9" label="Yeni Lead"
          compareData={customerMonthlyBar} compareColor="#0AA66A" compareLabel="Kazanılan Müşteri"
        />
        <AnalyticsLineChart theme="light" height={240} title="Müşteri Büyüme Eğilimi" data={growthLine} color="#1673F9"
          action={<span className="rounded-[8px] border px-2 py-1 text-[11px] font-bold" style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-muted)" }}>Son 6 ay</span>}
        />
        <AnalyticsDonutChart theme="light" height={240} title="Görev Durumları" centerLabel="Toplam Görev" data={taskStatusDonut} action={taskStatusPeriod.select} />
        <AnalyticsDonutChart theme="light" height={240} title="Lead Kaynakları" centerLabel="Toplam Lead" data={leadSourceDonut} action={leadSourcePeriod.select} />
        <AnalyticsBarChart theme="light" height={240} title="Kullanıcılara Göre Tamamlanan Görevler" data={tasksByUserBar} color="#1673F9" action={tasksByUserPeriod.select} />
        <AnalyticsDonutChart theme="light" height={240} title="Teklif Durumları" centerLabel="Toplam Teklif" data={proposalDonut.data} loading={proposalDonut.loading} action={proposalPeriod.select} />
      </div>
    </div>
  );
}
