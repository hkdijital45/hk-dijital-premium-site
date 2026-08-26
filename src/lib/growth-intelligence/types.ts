export const DEFAULT_WORKSPACE_ID = "hk-dijital";

export type GrowthAutomationMode = "manual" | "assisted" | "semi_automatic" | "fully_automatic";

export type GrowthSettings = {
  id?: string;
  workspace_id: string;
  automation_mode: GrowthAutomationMode;
  min_opportunity_score: number;
  min_quality_score: number;
  min_word_count: number;
  require_review: boolean;
  indexnow_enabled: boolean;
  sitemap_ping_enabled: boolean;
  gsc_sync_frequency_hours: number;
  target_service_pages: string[];
  created_at?: string;
  updated_at?: string;
};

export type GrowthOpportunityType = "new_content" | "refresh_content" | "service_page" | "internal_link" | "geo_gap" | "technical";
export type GrowthOpportunityStatus = "new" | "reviewing" | "converted" | "dismissed";

export type GrowthOpportunity = {
  id?: string;
  workspace_id: string;
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avg_position: number;
  opportunity_type: GrowthOpportunityType;
  opportunity_score: number;
  score_breakdown: Record<string, number | string>;
  recommended_action: string;
  related_blog_post_id?: string | null;
  related_content_plan_item_id?: string | null;
  status: GrowthOpportunityStatus;
  source: "search_console" | "manual";
  synced_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type GrowthRunType = "sync" | "scoring" | "generation" | "publish" | "indexing" | "full_cycle";
export type GrowthRunStatus = "running" | "success" | "partial" | "failed";

export type GrowthAutomationRun = {
  id?: string;
  workspace_id: string;
  run_type: GrowthRunType;
  status: GrowthRunStatus;
  started_at: string;
  finished_at?: string | null;
  summary: Record<string, unknown>;
  error?: string | null;
  affected_count: number;
  triggered_by: "cron" | "manual";
};

export type GrowthIndexNowSubmission = {
  id?: string;
  workspace_id: string;
  url: string;
  batch_id?: string | null;
  status: "pending" | "submitted" | "failed";
  response_code?: number | null;
  response_body?: string | null;
  submitted_at?: string | null;
  created_at?: string;
};
