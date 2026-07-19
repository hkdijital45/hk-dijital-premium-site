import type { ReactNode } from "react";

export type NavigateFn = (target: string) => void;

export interface DashboardKpiItem {
  label: string;
  value: ReactNode;
  note: string;
  target: string;
  tone: "primary" | "success" | "info" | "warning" | "danger";
  icon: ReactNode;
}

export interface DashboardPriorityAction {
  id: string;
  customer: string;
  reason: ReactNode;
  severity: "Kritik" | "Uyarı" | "Fırsat";
  target: string;
  action: string;
}

export interface DashboardRiskyCustomer {
  company: { id: string; name?: string };
  health: { score: number; status: string };
}

export interface DashboardUpcomingTask {
  id?: string;
  title?: string;
  priority?: string;
  due_date?: string;
  status?: string;
}

export interface DashboardActivityItem {
  id?: string;
  action?: string;
  entity?: string;
  module?: string;
  user?: string;
  created_at?: string;
}

export interface DashboardOverviewCard {
  label: string;
  value: ReactNode;
  note: string;
  icon: ReactNode;
  tone: string;
}

export interface DashboardPipelineStage {
  stage: string;
  count: number;
  gradient: string;
}

export interface DashboardAiHealthDimension {
  label: string;
  score: number;
  reason: string;
  status: "Sağlıklı" | "Riskli" | "Kritik";
}

export interface DashboardAutomationSuggestion {
  title: string;
  detail: string;
  target: string;
  tone: string;
}

export interface DashboardCategoryCard {
  title: string;
  description: string;
  count: string;
  icon: ReactNode;
  gradient: string;
  actions: [string, string][];
}

export interface DashboardQuickAction {
  label: string;
  target: string;
  icon: ReactNode;
  gradient: string;
}
