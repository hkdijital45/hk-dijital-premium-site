"use client";

// HK Admin "Genel Bakış" — Dashboard V3. Renders ONLY the pixel-close
// rebuild (DashboardOverviewV2.tsx) against the supplied reference
// screenshot: stat cards, "Bugün Yapılacaklar" and the 3x2 chart grid.
//
// The previous widget set (finance summary, sales pipeline, ad
// performance, priority actions, AI insights, risky-customer alarm,
// activity feed, AI Workforce teaser, customize-widgets panel, advanced
// operations accordion) is intentionally NOT rendered here anymore — the
// reference design has no equivalent of them on this screen. Their
// components/files, the underlying data (still computed in
// AdminDashboard.tsx for now, cheap since it's already in memory) and
// every API/route they call are untouched; they are simply no longer
// composed into this particular view. No functionality was deleted.
import { DashboardOverviewV2 } from "./DashboardOverviewV2";
import type { DashboardStatCard } from "./DashboardOverviewV2";
import type { NavigateFn } from "./types";

export interface MissionControlProps {
  onNavigate: NavigateFn;
  overviewV2: {
    statCards: DashboardStatCard[];
    tasks: any[];
    companies: any[];
    leads: any[];
    users: any[];
    onCompleteTask: (id: string) => void;
    completingIds: Set<string>;
  };
  // Legacy MissionControl props — still accepted (AdminDashboard.tsx's
  // call site is unchanged/minimal-diff) but intentionally unused by this
  // view; kept optional so nothing upstream has to be rewired.
  [legacyProp: string]: unknown;
}

export function MissionControl({ onNavigate, overviewV2 }: MissionControlProps) {
  // No background override here — this renders inside AdminDashboard.tsx's
  // existing "admin-dashboard-main" panel (its own border/padding/shadow,
  // already provided), per the "occupy the existing main content area,
  // don't replace its chrome" requirement.
  return (
    <div className="grid gap-5">
      <DashboardOverviewV2
        statCards={overviewV2.statCards}
        tasks={overviewV2.tasks}
        companies={overviewV2.companies}
        leads={overviewV2.leads}
        users={overviewV2.users}
        onNavigate={onNavigate}
        onCompleteTask={overviewV2.onCompleteTask}
        completingIds={overviewV2.completingIds}
      />
    </div>
  );
}
