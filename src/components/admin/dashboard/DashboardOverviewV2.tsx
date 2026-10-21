"use client";

// HK Admin Dashboard V2 — stat cards, "Bugün Yapılacaklar" task table and
// the 6-chart analytics section. Additive: rendered as a new top section
// inside MissionControl (see MissionControl.tsx), every existing widget
// below it is untouched. Reuses the app's only chart primitives
// (src/components/admin/analytics/charts.tsx — hand-rolled SVG, no new
// charting dependency) and the shared AdminPeriodFilter/admin-period-filter
// date-range convention already used by the finance workspaces.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { AdminPeriodFilter } from "@/components/admin/ui/AdminPeriodFilter";
import { resolveAdminPeriodRange, type AdminPeriodKey } from "@/lib/admin-period-filter";
import { AnalyticsBarChart, AnalyticsDonutChart, AnalyticsLineChart, type SeriesPoint } from "@/components/admin/analytics/charts";
import { formatReportDate } from "@/lib/report-timestamp";
import { istanbulDateString } from "@/lib/analytics-time";
import { dateOnly, monthKey, monthLabel, monthBuckets, taskSource, relatedRecordLabel, assignedUserLabel } from "@/lib/dashboard-overview-helpers";
import type { NavigateFn } from "./types";

export type DashboardStatCard = { label: string; value: ReactNode; hint: string; icon: ReactNode; tone: string; target: string };

// Mirrors AdminDashboard.tsx's own leadSourceOptions (not exported from
// that file) — kept as a literal here rather than forcing an export-only
// refactor of an unrelated ~16,000-line component for one shared array.
const LEAD_SOURCE_OPTIONS = ["İletişim Formu", "Teklif Formu", "Teklif Sihirbazı", "Müşteri Bulucu", "Meta Analiz", "Google Ads Analiz", "Instagram", "WhatsApp", "Referans", "Manuel Giriş", "Diğer"];
const DONUT_PALETTE = ["#0891b2", "#059669", "#d97706", "#dc2626", "#7c3aed", "#2563eb", "#64748b", "#db2777", "#0d9488", "#ca8a04", "#4f46e5"];

function priorityTone(priority?: string): AdminStatusTone {
  if (priority === "Kritik") return "danger";
  if (priority === "Yüksek") return "warning";
  return "info";
}

function statusTone(status?: string): AdminStatusTone {
  if (status === "Tamamlandı") return "success";
  if (status === "İptal") return "neutral";
  if (status === "Devam Ediyor") return "info";
  if (status === "Beklemede") return "warning";
  return "neutral";
}

// --- 5 stat cards -----------------------------------------------------

function StatCardsRow({ cards, onNavigate }: { cards: DashboardStatCard[]; onNavigate: NavigateFn }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <button
          type="button"
          key={card.label}
          onClick={() => onNavigate(card.target)}
          className="admin-card rounded-[16px] p-4 text-left transition hover:shadow-lg"
          style={{ borderColor: "var(--admin-border)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`grid size-9 place-items-center rounded-[10px] ${
              card.tone === "danger" ? "bg-red-50 text-red-700" : card.tone === "warning" ? "bg-amber-50 text-amber-700" : card.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-cyan-50 text-cyan-700"
            }`}>{card.icon}</span>
          </div>
          <p className="mt-3 text-2xl font-black" style={{ color: "var(--admin-text-primary)" }}>{card.value}</p>
          <p className="mt-0.5 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-secondary)" }}>{card.label}</p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--admin-text-muted)" }}>{card.hint}</p>
        </button>
      ))}
    </div>
  );
}

// --- "Bugün Yapılacaklar" task table -----------------------------------

function TodayTasksTable({
  tasks, companies, leads, users, completingIds, onCompleteTask, onNavigate
}: {
  tasks: any[]; companies: any[]; leads: any[]; users: any[];
  completingIds: Set<string>; onCompleteTask: (id: string) => void; onNavigate: NavigateFn;
}) {
  return (
    <div className="admin-card rounded-[20px] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black" style={{ color: "var(--admin-text-primary)" }}>Bugün Yapılacaklar</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>Geciken görevler en üstte, ardından bugün bekleyenler ve bugün tamamlananlar.</p>
        </div>
        <button type="button" onClick={() => onNavigate("Görevler")} className="hk-button hk-button-compact hk-button-info">Tüm Görevleri Görüntüle <ArrowRight size={14} /></button>
      </div>

      {tasks.length === 0 ? (
        <p className="mt-4 rounded-[14px] border border-dashed p-5 text-center text-sm" style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-muted)" }}>
          Bugün için bekleyen veya geciken görev yok.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>
                <th className="p-2 w-10"></th>
                <th className="p-2">Yapılacak İş</th>
                <th className="p-2">İlgili Kayıt</th>
                <th className="p-2">Atanan Kullanıcı</th>
                <th className="p-2">Tarih</th>
                <th className="p-2">Öncelik</th>
                <th className="p-2">Durum</th>
                <th className="p-2">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((item) => {
                const id = item.id || item.title;
                const done = item.status === "Tamamlandı";
                const overdue = !done && item.__overdue;
                const rowClass = done
                  ? "bg-emerald-50"
                  : overdue
                    ? "bg-red-50"
                    : "bg-amber-50";
                return (
                  <tr key={id} className={`${rowClass} border-t`} style={{ borderColor: "var(--admin-border)" }}>
                    <td className="p-2 align-top">
                      <input
                        type="checkbox"
                        checked={done}
                        disabled={done || completingIds.has(id)}
                        onChange={() => !done && onCompleteTask(id)}
                        aria-label={`${item.title || "Görev"} tamamlandı olarak işaretle`}
                      />
                    </td>
                    <td className="p-2 align-top font-bold" style={{ color: "var(--admin-text-primary)" }}>{item.title || "Görev"}</td>
                    <td className="p-2 align-top" style={{ color: "var(--admin-text-secondary)" }}>{relatedRecordLabel(item, companies, leads)}</td>
                    <td className="p-2 align-top" style={{ color: "var(--admin-text-secondary)" }}>{assignedUserLabel(item, users)}</td>
                    <td className="p-2 align-top" style={{ color: "var(--admin-text-secondary)" }}>{item.due_date ? formatReportDate(item.due_date) : "Tarih yok"}</td>
                    <td className="p-2 align-top"><AdminStatusBadge tone={priorityTone(item.priority)}>{item.priority || "Orta"}</AdminStatusBadge></td>
                    <td className="p-2 align-top">
                      <AdminStatusBadge tone={overdue ? "danger" : statusTone(item.status)}>{overdue ? "Gecikti" : (item.status || "Yapılacak")}</AdminStatusBadge>
                    </td>
                    <td className="p-2 align-top">
                      <button
                        type="button"
                        onClick={() => onNavigate(taskSource(item) === "customer" ? "Müşteriler" : taskSource(item) === "lead" ? "Lead Merkezi" : "Görevler")}
                        className="hk-button hk-button-compact hk-button-neutral"
                      >
                        Aç
                      </button>
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

// --- "Teklif Durumları" donut — the only chart not already covered by
// Overview()'s own aggregated content (the real, persisted proposals
// table isn't part of the big content blob fetched in admin-page-data.ts;
// self-fetching here, exactly like MissionControl.tsx's existing
// AiTeamWidget pattern, avoids threading a new table through the whole
// admin data pipeline for one chart). Four small count-only requests
// (limit=1, real PROPOSAL_STATUSES filters) — never a full record dump. ---
function ProposalStatusDonut({ createdFrom, createdTo }: { createdFrom: string; createdTo: string }) {
  // Loading state is `counts === null` (reset to null at the top of the
  // effect's async work, not via a separate setLoading(true) call in the
  // effect body) — same fetch-on-mount convention already established by
  // MissionControl.tsx's AiTeamWidget.
  const [counts, setCounts] = useState<{ won: number; lost: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const qs = (extra: string) => {
      const params = new URLSearchParams({ limit: "1" });
      if (createdFrom) params.set("createdFrom", createdFrom);
      if (createdTo) params.set("createdTo", createdTo);
      return `/api/admin/proposals/v2?${params.toString()}${extra}`;
    };
    Promise.all([
      fetch(qs("")).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(qs("&status=Kabul%20Edildi")).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(qs("&status=Reddedildi")).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(qs("&status=S%C3%BCresi%20Doldu")).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    ]).then(([all, won, rejected, expired]) => {
      if (cancelled || !all) return;
      setCounts({
        total: Number(all.total || 0),
        won: Number(won?.total || 0),
        lost: Number(rejected?.total || 0) + Number(expired?.total || 0)
      });
    });
    return () => { cancelled = true; };
  }, [createdFrom, createdTo]);

  const loading = counts === null;
  const data = counts ? [
    { label: "Kazanıldı", value: counts.won, color: "#059669" },
    { label: "Bekliyor", value: Math.max(0, counts.total - counts.won - counts.lost), color: "#d97706" },
    { label: "Kaybedildi", value: counts.lost, color: "#dc2626" }
  ] : [];

  return <AnalyticsDonutChart title="Teklif Durumları" subtitle="Seçili dönemde oluşturulan teklifler" data={data} loading={loading} height={260} />;
}

// --- Main export --------------------------------------------------------

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
  const [periodKey, setPeriodKey] = useState<AdminPeriodKey>("last_30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const { startDate, endDate } = useMemo(() => resolveAdminPeriodRange(periodKey, customStart, customEnd), [periodKey, customStart, customEnd]);

  const istanbulToday = useMemo(() => istanbulDateString(new Date()), []);

  const todayTasks = useMemo(() => {
    const mark = (item: any, overdue: boolean) => ({ ...item, __overdue: overdue });
    const overdue = tasks.filter((t) => t.due_date && dateOnly(t.due_date) < istanbulToday && !["Tamamlandı", "İptal"].includes(t.status)).map((t) => mark(t, true));
    const duePending = tasks.filter((t) => t.due_date && dateOnly(t.due_date) === istanbulToday && !["Tamamlandı", "İptal"].includes(t.status)).map((t) => mark(t, false));
    const dueDone = tasks.filter((t) => t.due_date && dateOnly(t.due_date) === istanbulToday && t.status === "Tamamlandı").map((t) => mark(t, false));
    return [...overdue, ...duePending, ...dueDone];
  }, [tasks, istanbulToday]);

  const months = useMemo(() => monthBuckets(startDate, endDate), [startDate, endDate]);

  // Chart 1 — Aylık Lead ve Müşteri Sayıları (yeni lead / kazanılan müşteri, ayrı ayrı).
  const leadMonthlyBar: SeriesPoint[] = useMemo(() => months.map((key) => ({
    label: monthLabel(key),
    value: leads.filter((l) => monthKey(l.created_at) === key).length
  })), [months, leads]);
  const customerMonthlyBar: SeriesPoint[] = useMemo(() => months.map((key) => ({
    label: monthLabel(key),
    value: companies.filter((c) => c.status === "Aktif" && monthKey(c.created_at) === key).length
  })), [months, companies]);

  // Chart 2 — Müşteri Büyüme Eğilimi (kümülatif toplam lead / aktif müşteri).
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

  // Chart 3 — Görev Durumları: 4 gerçek kategori (Yeşil/Sarı/Kırmızı/Mavi).
  const taskStatusDonut = useMemo(() => {
    const inRange = tasks.filter((t) => {
      const key = dateOnly(t.due_date || t.created_at);
      return key && key >= startDate && key <= endDate;
    });
    const completed = inRange.filter((t) => t.status === "Tamamlandı").length;
    const overdue = inRange.filter((t) => t.status !== "Tamamlandı" && t.status !== "İptal" && t.due_date && dateOnly(t.due_date) < istanbulToday).length;
    const inProgress = inRange.filter((t) => t.status === "Devam Ediyor" && !(t.due_date && dateOnly(t.due_date) < istanbulToday)).length;
    const pending = inRange.filter((t) => ["Yapılacak", "Beklemede"].includes(t.status || "Yapılacak") && !(t.due_date && dateOnly(t.due_date) < istanbulToday)).length;
    return [
      { label: "Tamamlanan", value: completed, color: "#059669" },
      { label: "Bekleyen", value: pending, color: "#d97706" },
      { label: "Geciken", value: overdue, color: "#dc2626" },
      { label: "Devam Eden", value: inProgress, color: "#2563eb" }
    ];
  }, [tasks, startDate, endDate, istanbulToday]);

  // Chart 4 — Lead Kaynakları.
  const leadSourceDonut = useMemo(() => {
    const inRange = leads.filter((l) => { const key = dateOnly(l.created_at); return key && key >= startDate && key <= endDate; });
    return LEAD_SOURCE_OPTIONS.map((source, index) => ({
      label: source,
      value: inRange.filter((l) => (l.source || "Diğer") === source || (source === "Diğer" && !LEAD_SOURCE_OPTIONS.includes(l.source))).length,
      color: DONUT_PALETTE[index % DONUT_PALETTE.length]
    })).filter((d) => d.value > 0);
  }, [leads, startDate, endDate]);

  // Chart 5 — Kullanıcılara Göre Tamamlanan Görevler.
  const tasksByUserBar: SeriesPoint[] = useMemo(() => {
    const completed = tasks.filter((t) => t.status === "Tamamlandı" && t.completed_at && dateOnly(t.completed_at) >= startDate && dateOnly(t.completed_at) <= endDate);
    const byUser = new Map<string, number>();
    for (const task of completed) {
      const label = assignedUserLabel(task, users);
      byUser.set(label, (byUser.get(label) || 0) + 1);
    }
    return Array.from(byUser.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [tasks, users, startDate, endDate]);

  return (
    <div className="grid gap-5">
      <StatCardsRow cards={statCards} onNavigate={onNavigate} />
      <TodayTasksTable tasks={todayTasks} companies={companies} leads={leads} users={users} completingIds={completingIds} onCompleteTask={onCompleteTask} onNavigate={onNavigate} />

      <div className="admin-card rounded-[20px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black" style={{ color: "var(--admin-text-primary)" }}>Analitik Özet</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>Seçili tarih aralığına göre lead, müşteri, görev ve teklif eğilimleri.</p>
          </div>
          <AdminPeriodFilter value={periodKey} onChange={setPeriodKey} customStart={customStart} customEnd={customEnd} onCustomStartChange={setCustomStart} onCustomEndChange={setCustomEnd} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <AnalyticsBarChart
            title="Aylık Lead ve Müşteri Sayıları" subtitle="Aylık karşılaştırma"
            data={leadMonthlyBar} color="#0891b2" label="Yeni Lead"
            compareData={customerMonthlyBar} compareColor="#059669" compareLabel="Kazanılan Müşteri"
            height={260}
          />
          <AnalyticsLineChart title="Müşteri Büyüme Eğilimi" subtitle="Mavi: Toplam Lead (kümülatif) · Yeşil: Aktif Müşteri (kümülatif)" data={growthLine} color="#0891b2" height={280} />
          <AnalyticsDonutChart title="Görev Durumları" subtitle="Seçili dönemde vadesi/oluşturulma tarihi düşen görevler" data={taskStatusDonut} height={260} />
          <AnalyticsDonutChart title="Lead Kaynakları" subtitle="Seçili dönemde oluşturulan başvurular" data={leadSourceDonut} height={260} />
          <AnalyticsBarChart title="Kullanıcılara Göre Tamamlanan Görevler" subtitle="Seçili dönemde tamamlanan görevler" data={tasksByUserBar} color="#2563eb" height={260} />
          <ProposalStatusDonut createdFrom={startDate} createdTo={endDate} />
        </div>
      </div>
    </div>
  );
}

