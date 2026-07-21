"use client";

import type { ReactNode } from "react";
import { ChevronRight, Gauge, Plus, Settings2, Sparkles, TrendingUp } from "lucide-react";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminCompactKpiStrip, type AdminCompactKpiItem } from "@/components/admin/workspace/AdminCompactKpiStrip";
import { AdminActionBar } from "@/components/admin/workspace/AdminActionBar";
import { AdminDetailInspector } from "@/components/admin/workspace/AdminDetailInspector";
import { DashboardCustomizePanel } from "./DashboardHero";
import { DashboardPriorityActions } from "./DashboardPriorityActions";
import { DashboardCustomerRisks } from "./DashboardCustomerRisks";
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

export interface DashboardOverviewProps {
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

const KPI_ICONS: ReactNode[] = [<Gauge key="0" size={14} />, <TrendingUp key="1" size={14} />, <Sparkles key="2" size={14} />];

export function DashboardOverview(props: DashboardOverviewProps) {
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

  const criticalCount = priorityActions.filter((item) => item.severity === "Kritik").length;

  return (
    <AdminWorkspace
      eyebrow={`${greeting}, ${userName}`}
      title="Operasyon Merkezi"
      description="Bugünkü öncelikler, müşteri riskleri ve operasyon durumu tek ekranda."
      headerActions={
        <>
          <details className="group relative">
            <summary className="hk-button hk-button-primary hk-button-compact cursor-pointer list-none"><Plus size={14} /> Hızlı İşlem</summary>
            <div className="admin-card absolute right-0 z-30 mt-2 grid w-[min(92vw,320px)] gap-1.5 rounded-[12px] p-2 shadow-2xl">
              {quickActions.map((item) => (
                <button type="button" key={item.label} onClick={() => onNavigate(item.target)} className="hk-button hk-button-neutral hk-button-compact justify-start">
                  {item.icon}
                  {item.label}
                  <ChevronRight className="ml-auto" size={14} />
                </button>
              ))}
            </div>
          </details>
          <button type="button" onClick={onToggleCustomizing} aria-pressed={customizing} className="hk-button hk-button-edit hk-button-compact"><Settings2 size={14} /> Düzenle</button>
        </>
      }
      rightPanel={
        <AdminDetailInspector title="AI Sağlık Skoru" subtitle="Reklam, içerik, lead, satış ve tahsilat sağlığı">
          <div className="admin-detail-inspector-fields">
            {aiHealthDimensions.map((item) => (
              <div key={item.label} className="admin-detail-inspector-field">
                <p>{item.label} · {item.score}/100 · {item.status}</p>
                <p style={{ fontWeight: 500 }}>{item.reason}</p>
              </div>
            ))}
          </div>
          <div className="admin-detail-inspector-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
            {automationSuggestions.map((item) => (
              <button key={item.title} type="button" onClick={() => onNavigate(item.target)} className="hk-button hk-button-neutral hk-button-compact justify-start">
                {item.title}
              </button>
            ))}
            {!automationSuggestions.length && <p style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>Bekleyen otomasyon aksiyonu yok.</p>}
          </div>
        </AdminDetailInspector>
      }
      bottomBar={
        <AdminActionBar statusText={`${criticalCount} kritik uyarı · ${riskyCustomers.length} riskli müşteri`}>
          <button type="button" onClick={() => onNavigate("Müşteriler")} className="hk-button hk-button-info hk-button-compact">Yeni Müşteri</button>
          <button type="button" onClick={() => onNavigate("Görevler")} className="hk-button hk-button-neutral hk-button-compact">Yeni Görev</button>
          <button type="button" onClick={() => onNavigate("Raporlar")} className="hk-button hk-button-success hk-button-compact">Rapor Oluştur</button>
        </AdminActionBar>
      }
    >
      {isWidgetVisible("dailySummary") && <AdminCompactKpiStrip items={kpiItems} />}

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

      <div className="grid min-w-0 gap-4">
        {isWidgetVisible("priorityActions") && (
          <DashboardPriorityActions items={priorityActions} commandPlan={commandPlan} onGeneratePlan={onGenerateDailyPlan} onNavigate={onNavigate} />
        )}

        {(isWidgetVisible("customerRisks") || isWidgetVisible("upcomingTasks")) && (
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            {isWidgetVisible("customerRisks") && <DashboardCustomerRisks items={riskyCustomers} onNavigate={onNavigate} />}
            {isWidgetVisible("upcomingTasks") && <DashboardUpcomingTasks items={upcomingTasks} onNavigate={onNavigate} />}
          </section>
        )}

        {isWidgetVisible("activity") && (
          <DashboardRecentActivity items={recentActivity} filter={activityFilter} onFilterChange={onActivityFilterChange} onNavigate={onNavigate} />
        )}

        <DashboardFinanceSummary overviewCards={overviewCards} packageDistribution={packageDistribution} onNavigate={onNavigate} />

        <section className="grid min-w-0 gap-4 xl:grid-cols-2">
          <DashboardSalesPipeline stages={pipelineStages} onNavigate={onNavigate} />
          <DashboardAdPerformance {...adPerformance} onNavigate={onNavigate} />
        </section>

        {websiteAnalytics}

        <details className="group admin-card rounded-[14px]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>
            Gelişmiş operasyon panelleri (bildirimler, sistem sağlığı, başarılar, ajans haritası)
          </summary>
          <div className="border-t p-4" style={{ borderColor: "var(--admin-border)" }}>
            {advanced}
          </div>
        </details>
      </div>
    </AdminWorkspace>
  );
}
