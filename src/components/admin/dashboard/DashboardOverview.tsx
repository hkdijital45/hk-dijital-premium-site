"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { DashboardCustomizePanel, DashboardHero } from "./DashboardHero";
import { DashboardKpiGrid } from "./DashboardKpiGrid";
import { DashboardQuickActions } from "./DashboardQuickActions";
import { DashboardPriorityActions } from "./DashboardPriorityActions";
import { DashboardCustomerRisks } from "./DashboardCustomerRisks";
import { DashboardRecentActivity } from "./DashboardRecentActivity";
import { DashboardUpcomingTasks } from "./DashboardUpcomingTasks";
import { DashboardFinanceSummary } from "./DashboardFinanceSummary";
import { DashboardSalesPipeline } from "./DashboardSalesPipeline";
import { DashboardAdPerformance } from "./DashboardAdPerformance";
import { DashboardAiRecommendations } from "./DashboardAiRecommendations";
import { DashboardFavoriteModules } from "./DashboardFavoriteModules";
import type {
  DashboardActivityItem,
  DashboardAiHealthDimension,
  DashboardAutomationSuggestion,
  DashboardCategoryCard,
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
  lightQuickActions: DashboardQuickAction[];

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

  favoriteModules: DashboardCategoryCard[];

  websiteAnalytics: ReactNode;
  advanced: ReactNode;
}

export function DashboardOverview(props: DashboardOverviewProps) {
  const {
    onNavigate,
    greeting,
    userName,
    isWidgetVisible,
    quickActions,
    lightQuickActions,
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
    favoriteModules,
    websiteAnalytics,
    advanced
  } = props;

  return (
    <div className="admin-dashboard-overview grid w-full min-w-0 gap-5">
      <DashboardHero
        greeting={greeting}
        userName={userName}
        quickActions={quickActions}
        onNavigate={onNavigate}
        customizing={customizing}
        onToggleCustomizing={onToggleCustomizing}
      />

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

      <DashboardQuickActions actions={lightQuickActions} onNavigate={onNavigate} />

      {isWidgetVisible("dailySummary") && <DashboardKpiGrid items={dailyKpis} onNavigate={onNavigate} />}

      {isWidgetVisible("priorityActions") && (
        <DashboardPriorityActions items={priorityActions} commandPlan={commandPlan} onGeneratePlan={onGenerateDailyPlan} onNavigate={onNavigate} />
      )}

      <section className="grid min-w-0 gap-5 xl:grid-cols-2">
        {isWidgetVisible("customerRisks") && <DashboardCustomerRisks items={riskyCustomers} onNavigate={onNavigate} />}
        <DashboardUpcomingTasks items={upcomingTasks} onNavigate={onNavigate} />
      </section>

      <DashboardFinanceSummary overviewCards={overviewCards} packageDistribution={packageDistribution} onNavigate={onNavigate} />

      <section className="grid min-w-0 gap-5 xl:grid-cols-2">
        <DashboardSalesPipeline stages={pipelineStages} onNavigate={onNavigate} />
        <DashboardAdPerformance {...adPerformance} onNavigate={onNavigate} />
      </section>

      {websiteAnalytics}

      <DashboardAiRecommendations dimensions={aiHealthDimensions} suggestions={automationSuggestions} onNavigate={onNavigate} />

      {isWidgetVisible("activity") && (
        <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <DashboardRecentActivity items={recentActivity} filter={activityFilter} onFilterChange={onActivityFilterChange} onNavigate={onNavigate} />
          <DashboardFavoriteModules cards={favoriteModules} onNavigate={onNavigate} />
        </section>
      )}

      {isWidgetVisible("intelligence") && (
        <details className="group admin-card rounded-[20px]">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
            <span>
              <strong className="block text-lg" style={{ color: "var(--admin-text-primary)" }}>Detaylı analiz ve operasyon araçları</strong>
              <span className="mt-1 block text-sm" style={{ color: "var(--admin-text-secondary)" }}>Intelligence, entegrasyon, büyüme, trend ve gelişmiş kontrol panelleri.</span>
            </span>
            <ChevronDown size={20} className="shrink-0 text-slate-500 transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-5 border-t p-4 sm:p-5" style={{ borderColor: "var(--admin-border)" }}>
            {advanced}
          </div>
        </details>
      )}
    </div>
  );
}
