"use client";

import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Plus, Settings2, Sparkles } from "lucide-react";
import { AdminCompactKpiStrip, type AdminCompactKpiItem } from "@/components/admin/workspace/AdminCompactKpiStrip";
import { AdminActionBar } from "@/components/admin/workspace/AdminActionBar";
import { DashboardCustomizePanel } from "./DashboardHero";
import { DashboardPriorityActions } from "./DashboardPriorityActions";
import { DashboardRecentActivity } from "./DashboardRecentActivity";
import { DashboardUpcomingTasks } from "./DashboardUpcomingTasks";
import { DashboardFinanceSummary } from "./DashboardFinanceSummary";
import { DashboardSalesPipeline } from "./DashboardSalesPipeline";
import { DashboardAdPerformance } from "./DashboardAdPerformance";
import type {
  DashboardActivityItem,
  DashboardAiHealthDimension,
  DashboardAutomationSuggestion,
  DashboardKpiItem,
  DashboardOverviewCard,
  DashboardPipelineStage,
  DashboardPriorityAction,
  DashboardQuickAction,
  DashboardRiskyCustomer,
  DashboardUpcomingTask,
  NavigateFn
} from "./types";

export interface MissionControlProps {
  onNavigate: NavigateFn;
  greeting: string;
  userName: string;
  isWidgetVisible: (id: string) => boolean;

  quickActions: DashboardQuickAction[];

  customizing: boolean;
  onToggleCustomizing: () => void;
  widgetOrder: string[];
  widgetHidden: string[];
  widgetLabels: Record<string, { label: string; description: string }>;
  preferencesSaving: boolean;
  onToggleWidget: (id: string) => void;
  onResetPreferences: () => void;

  dailyKpis: DashboardKpiItem[];
  priorityActions: DashboardPriorityAction[];
  commandPlan: string;
  onGenerateDailyPlan: () => void;

  riskyCustomers: DashboardRiskyCustomer[];
  upcomingTasks: DashboardUpcomingTask[];
  recentActivity: DashboardActivityItem[];
  activityFilter: string;
  onActivityFilterChange: (filter: string) => void;

  overviewCards: DashboardOverviewCard[];
  packageDistribution: { starter: number; pro: number; premium: number; none: number };
  pipelineStages: DashboardPipelineStage[];

  adPerformance: { riskyCustomerCount: number; latestCustomerName: string; averageScore: number | string };
  aiHealthDimensions: DashboardAiHealthDimension[];
  automationSuggestions: DashboardAutomationSuggestion[];

  centerCards: unknown;

  websiteAnalytics: ReactNode;
  advanced: ReactNode;
}

const KPI_ICONS: ReactNode[] = [<Sparkles key="0" size={14} />, <AlertTriangle key="1" size={14} />];

export function MissionControl(props: MissionControlProps) {
  const {
    onNavigate,
    greeting,
    userName,
    isWidgetVisible,
    quickActions,
    customizing,
    onToggleCustomizing,
    widgetOrder,
    widgetHidden,
    widgetLabels,
    preferencesSaving,
    onToggleWidget,
    onResetPreferences,
    dailyKpis,
    priorityActions,
    commandPlan,
    onGenerateDailyPlan,
    riskyCustomers,
    upcomingTasks,
    recentActivity,
    activityFilter,
    onActivityFilterChange,
    overviewCards,
    packageDistribution,
    pipelineStages,
    adPerformance,
    aiHealthDimensions,
    automationSuggestions,
    websiteAnalytics,
    advanced
  } = props;

  const kpiItems: AdminCompactKpiItem[] = dailyKpis.map((item, index) => ({
    key: item.label,
    label: item.label,
    value: item.value,
    icon: item.icon || KPI_ICONS[index % KPI_ICONS.length],
    tone: item.tone,
    onClick: () => onNavigate(item.target)
  }));

  const criticalActions = priorityActions.filter((item) => item.severity === "Kritik");
  const alarmRows = [
    ...criticalActions.slice(0, 3).map((item) => ({ key: `pa-${item.id}`, title: item.customer, detail: item.reason, target: item.target })),
    ...riskyCustomers.slice(0, 3).map((item) => ({ key: `rc-${item.company.id}`, title: item.company.name || "Müşteri", detail: `Sağlık skoru ${item.health.score}/100`, target: "Müşteriler" }))
  ].slice(0, 5);

  const topSuggestion = automationSuggestions[0] as DashboardAutomationSuggestion | undefined;

  return (
    <div className="mc-shell">
      <section className="mc-hero">
        <div className="mc-hero-top">
          <div>
            <p className="mc-hero-eyebrow">{greeting}, {userName}</p>
            <h1 className="mc-hero-title">Bugünkü Durum</h1>
            <p className="mc-hero-sub">Operasyon, finans, reklam ve CRM sinyalleri tek ekranda — kritik olan en üstte.</p>
          </div>
          <div className="mc-hero-actions">
            <details className="group relative">
              <summary className="hk-button hk-button-primary hk-button-compact cursor-pointer list-none"><Plus size={14} /> Hızlı İşlem</summary>
              <div className="admin-card absolute right-0 z-30 mt-2 grid w-[min(92vw,320px)] gap-1.5 rounded-[12px] p-2 shadow-2xl">
                {quickActions.map((item) => (
                  <button type="button" key={item.label} onClick={() => onNavigate(item.target)} className="hk-button hk-button-neutral hk-button-compact justify-start">
                    {item.icon}
                    {item.label}
                    <ArrowRight className="ml-auto" size={14} />
                  </button>
                ))}
              </div>
            </details>
            <button type="button" onClick={onToggleCustomizing} aria-pressed={customizing} className="hk-button hk-button-edit hk-button-compact"><Settings2 size={14} /> Görünümü Düzenle</button>
          </div>
        </div>

        {isWidgetVisible("dailySummary") && <AdminCompactKpiStrip items={kpiItems} />}

        {topSuggestion && (
          <div className="mc-insight-banner">
            <span className="mc-insight-banner-icon"><Sparkles size={17} /></span>
            <div>
              <strong>{topSuggestion.title}</strong>
              <p>{topSuggestion.detail}</p>
            </div>
          </div>
        )}
      </section>

      {customizing && (
        <DashboardCustomizePanel
          order={widgetOrder}
          hidden={widgetHidden}
          labels={widgetLabels}
          saving={preferencesSaving}
          onToggleWidget={onToggleWidget}
          onReset={onResetPreferences}
        />
      )}

      <div className="mc-grid">
        <div className="mc-panel mc-panel-alarm">
          <div className="mc-panel-head">
            <div>
              <p className="mc-panel-eyebrow">Kritik Alarm</p>
              <h2 className="mc-panel-title">Şimdi müdahale gerekiyor</h2>
            </div>
          </div>
          {alarmRows.map((row) => (
            <button type="button" key={row.key} onClick={() => onNavigate(row.target)} className="mc-alarm-row" style={{ width: "100%", textAlign: "left" }}>
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: "block" }}>{row.title}</strong>
                <span>{row.detail}</span>
              </span>
              <ArrowRight size={14} />
            </button>
          ))}
          {!alarmRows.length && <p style={{ fontSize: "var(--text-sm)", color: "var(--admin-text-secondary)" }}>Kritik uyarı yok — sistem sakin.</p>}
        </div>

        <div className="mc-panel-operation">
          {isWidgetVisible("priorityActions") && (
            <DashboardPriorityActions items={priorityActions} commandPlan={commandPlan} onGeneratePlan={onGenerateDailyPlan} onNavigate={onNavigate} />
          )}
        </div>

        <div className="mc-panel mc-panel-insight">
          <div className="mc-panel-head">
            <div>
              <p className="mc-panel-eyebrow">AI Insights</p>
              <h2 className="mc-panel-title">Sağlık skoru</h2>
            </div>
          </div>
          {isWidgetVisible("intelligence") && (
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              {aiHealthDimensions.map((item) => (
                <div key={item.label} className="admin-card-soft" style={{ borderRadius: "var(--hk-radius-md)", padding: "var(--space-3)" }}>
                  <p style={{ fontSize: "var(--text-xs)", fontWeight: 800, color: "var(--admin-text-primary)" }}>{item.label} · {item.score}/100 · {item.status}</p>
                  <p style={{ fontSize: "var(--text-2xs)", color: "var(--admin-text-muted)", marginTop: 4 }}>{item.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mc-panel-finance">
          <DashboardFinanceSummary overviewCards={overviewCards} packageDistribution={packageDistribution} onNavigate={onNavigate} />
        </div>

        <div className="mc-panel-ad">
          <DashboardAdPerformance {...adPerformance} onNavigate={onNavigate} />
        </div>

        <div className="mc-panel-crm">
          <DashboardSalesPipeline stages={pipelineStages} onNavigate={onNavigate} />
        </div>

        <div className="mc-panel-calendar">
          <DashboardUpcomingTasks items={upcomingTasks} onNavigate={onNavigate} />
        </div>

        <div className="mc-panel-activity">
          {isWidgetVisible("activity") && (
            <DashboardRecentActivity items={recentActivity} filter={activityFilter} onFilterChange={onActivityFilterChange} onNavigate={onNavigate} limit={5} />
          )}
        </div>

        <div className="mc-panel mc-panel-actions">
          <div className="mc-panel-head">
            <div>
              <p className="mc-panel-eyebrow">Hızlı İşlemler</p>
              <h2 className="mc-panel-title">Bir tık uzakta</h2>
            </div>
          </div>
          <div className="mc-quick-grid">
            {quickActions.map((item) => (
              <button type="button" key={item.label} onClick={() => onNavigate(item.target)} className="mc-quick-action">
                <span className="mc-quick-action-icon">{item.icon}</span>
                <strong>{item.label}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>

      {websiteAnalytics}

      <details className="group admin-card rounded-[14px]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>
          Gelişmiş operasyon panelleri (bildirimler, sistem sağlığı, başarılar, ajans haritası)
        </summary>
        <div className="border-t p-4" style={{ borderColor: "var(--admin-border)" }}>
          {advanced}
        </div>
      </details>

      <AdminActionBar statusText={`${criticalActions.length} kritik uyarı · ${riskyCustomers.length} riskli müşteri`}>
        <button type="button" onClick={() => onNavigate("Müşteriler")} className="hk-button hk-button-info hk-button-compact">Yeni Müşteri</button>
        <button type="button" onClick={() => onNavigate("Görevler")} className="hk-button hk-button-neutral hk-button-compact">Yeni Görev</button>
        <button type="button" onClick={() => onNavigate("Raporlar")} className="hk-button hk-button-success hk-button-compact">Rapor Oluştur</button>
      </AdminActionBar>
    </div>
  );
}
