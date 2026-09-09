// HK Social Autopilot — shared types. Single-workspace (one Instagram
// account, 'hk-dijital') system; not customer-scoped.

export const SOCIAL_WORKSPACE_ID = "hk-dijital";

export type SocialControlMode = "manual" | "approval" | "full_auto";
export type SocialContentType = "reel" | "carousel" | "static" | "story";
export type SocialFunnelStage =
  | "awareness" | "problem_awareness" | "consideration" | "authority" | "trust" | "conversion" | "retention";
export type SocialPublicationStatus =
  | "draft" | "generated" | "quality_check" | "ready" | "scheduled" | "preparing"
  | "publishing" | "processing" | "published" | "failed" | "needs_review" | "paused" | "cancelled";
export type SocialGenerationStatus = "pending" | "generating" | "generated" | "failed";
export type SocialQueueStatus =
  | "draft" | "ready" | "scheduled" | "preparing" | "publishing" | "processing"
  | "published" | "failed" | "needs_review" | "paused" | "cancelled";
export type SocialConfidence = "low" | "medium" | "high";
export type SocialAiProviderPreference = "auto" | "anthropic" | "gemini";
export type SocialIntegrationStatus = "disconnected" | "connected" | "error" | "token_expired";
export type SocialLearningType = "winner" | "weakness" | "hypothesis" | "fatigue_signal" | "experiment_result";
export type SocialRunType = "daily_cycle" | "queue_process" | "analytics_sync" | "learning_update" | "monthly_refresh";
export type SocialRunStatus = "running" | "success" | "partial" | "failed";
export type SocialSnapshotWindow = "1h" | "24h" | "72h" | "7d" | "30d" | "daily";
export type SocialSnapshotScope = "content" | "account";

export type SocialAutopilotSettings = {
  id: string;
  workspace_id: string;
  autopilot_active: boolean;
  control_mode: SocialControlMode;
  test_mode: boolean;
  emergency_pause: boolean;
  emergency_pause_reason: string | null;
  emergency_paused_at: string | null;
  timezone: string;
  min_quality_score: number;
  max_quality_retries: number;
  daily_publish_cap: number;
  posting_frequency_per_week: number;
  reel_ratio: number;
  carousel_ratio: number;
  static_ratio: number;
  content_pillar_weights: Record<string, number>;
  funnel_stage_plan: Record<string, unknown>;
  crisis_pause_enabled: boolean;
  ai_provider_preference: SocialAiProviderPreference;
  notify_on_failure: boolean;
  notify_on_disconnect: boolean;
  notify_on_quality_gate_repeat_failure: boolean;
  created_at: string;
  updated_at: string;
};

export type SocialBrandProfile = {
  id: string;
  workspace_id: string;
  brand_name: string;
  mission: string;
  service_categories: string[];
  target_personas: Array<{ name: string; description: string }>;
  geography: string;
  tone_guidelines: string;
  forbidden_topics: string[];
  visual_style_notes: string;
  created_at: string;
  updated_at: string;
};

export type SocialClicheEntry = {
  id: string;
  workspace_id: string;
  phrase: string;
  category: string;
  active: boolean;
  created_at: string;
};

export type SocialStrategy = {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "active" | "completed" | "archived";
  monthly_objective: string;
  target_audience: string;
  funnel_distribution: Record<string, number>;
  content_pillars: Array<{ name: string; weight: number; description?: string }>;
  platform_objectives: Record<string, unknown>;
  posting_frequency: number;
  reel_ratio: number;
  carousel_ratio: number;
  static_ratio: number;
  story_strategy: string;
  follower_strategy: string;
  authority_strategy: string;
  lead_strategy: string;
  conversion_strategy: string;
  community_strategy: string;
  testing_hypotheses: Array<{ hypothesis: string; metric: string }>;
  kpi_targets: Record<string, number | string>;
  creative_themes: string[];
  based_on_learnings: unknown[];
  ai_provider: string | null;
  ai_model: string | null;
  prompt_version: string | null;
  generated_by: "ai" | "manual";
  created_at: string;
  updated_at: string;
};

export type SocialCreativeBrief = {
  script?: string;
  shot_plan?: string[];
  b_roll?: string[];
  on_screen_text?: string;
  thumbnail_text?: string;
  cover_prompt?: string;
  visual_prompt?: string;
  estimated_duration_seconds?: number;
  desired_action?: string;
  slides?: Array<{ index: number; headline: string; body: string }>;
  design_notes?: string;
};

export type SocialContentItem = {
  id: string;
  workspace_id: string;
  strategy_id: string | null;
  content_date: string;
  platform: string;
  content_type: SocialContentType;
  funnel_stage: SocialFunnelStage;
  content_pillar: string;
  objective: string;
  target_persona: string;
  topic: string;
  title: string;
  hook: string;
  hook_archetype: string;
  secondary_hook: string;
  caption: string;
  cta: string;
  cta_goal: string;
  hashtags: string[];
  seo_keywords: string[];
  creative_brief: SocialCreativeBrief;
  media_asset_urls: string[];
  primary_kpi: string;
  secondary_kpi: string;
  quality_score: number | null;
  factuality_score: number | null;
  originality_score: number | null;
  duplicate_score: number | null;
  brand_fit_score: number | null;
  privacy_check_passed: boolean;
  publication_status: SocialPublicationStatus;
  generation_status: SocialGenerationStatus;
  scheduled_at: string | null;
  publish_confidence: SocialConfidence | null;
  publish_time_reasoning: string | null;
  published_at: string | null;
  external_media_id: string | null;
  external_permalink: string | null;
  failure_reason: string | null;
  retries: number;
  edited_manually: boolean;
  manual_edit_locked_fields: string[];
  version: number;
  ai_provider: string | null;
  ai_model: string | null;
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialQualityCheckResult = {
  id?: string;
  content_item_id: string;
  overall_score: number;
  checks: Record<string, { passed: boolean; score: number; detail: string }>;
  passed: boolean;
  attempt: number;
  created_at?: string;
};

export type SocialQueueItem = {
  id: string;
  workspace_id: string;
  content_item_id: string;
  status: SocialQueueStatus;
  scheduled_at: string;
  locked_at: string | null;
  locked_by: string | null;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  error_category: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialIntegration = {
  id: string;
  workspace_id: string;
  provider: string;
  ig_user_id: string | null;
  username: string | null;
  account_type: string | null;
  access_token_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[];
  status: SocialIntegrationStatus;
  connected_at: string | null;
  connected_by: string | null;
  last_successful_call_at: string | null;
  last_publish_at: string | null;
  last_insights_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialMetricSnapshot = {
  id: string;
  workspace_id: string;
  content_item_id: string | null;
  snapshot_scope: SocialSnapshotScope;
  snapshot_window: SocialSnapshotWindow;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  profile_visits: number;
  follows: number;
  video_views: number;
  watch_time_seconds: number | null;
  engagement_rate: number | null;
  follower_count: number | null;
  performance_score: number | null;
  captured_at: string;
  created_at: string;
};

export type SocialAiLearning = {
  id: string;
  workspace_id: string;
  strategy_id: string | null;
  learning_type: SocialLearningType;
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  evidence_window: string;
  sample_size: number;
  confidence: SocialConfidence;
  action_recommendation: string;
  applied: boolean;
  generated_at: string;
  created_at: string;
};

export type SocialPublishingTimeRecommendation = {
  id: string;
  workspace_id: string;
  weekday: number;
  hour: number;
  content_type: string;
  content_pillar: string;
  sample_size: number;
  avg_score: number;
  confidence: SocialConfidence;
  updated_at: string;
};

export type SocialAutopilotRun = {
  id: string;
  workspace_id: string;
  run_type: SocialRunType;
  status: SocialRunStatus;
  started_at: string;
  finished_at: string | null;
  summary: Record<string, unknown>;
  error: string | null;
  affected_count: number;
  triggered_by: "cron" | "manual";
};

export type SocialExperiment = {
  id: string;
  workspace_id: string;
  hypothesis: string;
  variant_a: string;
  variant_b: string;
  metric: string;
  status: "planned" | "running" | "completed" | "cancelled";
  result: Record<string, unknown>;
  content_item_ids: string[];
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};
