// HK Social Autopilot — shared types. Single-workspace (HK Dijital's own
// Instagram account) module inside HK Admin — not customer-scoped, unlike
// customer_integrations. Every table is workspace_id-scoped (constant
// 'hk-dijital') rather than per-customer, matching growth_settings'
// existing singleton-row convention in this codebase.

export const SOCIAL_WORKSPACE_ID = "hk-dijital";

export type ControlMode = "manual" | "approval" | "full_auto";
export type ContentType = "reel" | "carousel" | "static" | "story";
export type FunnelStage =
  | "awareness" | "problem_awareness" | "consideration" | "authority" | "trust" | "conversion" | "retention";
export type PublicationStatus =
  | "draft" | "generated" | "quality_check" | "ready" | "scheduled" | "preparing"
  | "publishing" | "processing" | "published" | "failed" | "needs_review" | "paused" | "cancelled"
  | "needs_media" | "media_failed";
export type GenerationStatus = "pending" | "generating" | "generated" | "failed";
export type QueueStatus = PublicationStatus;
export type Confidence = "low" | "medium" | "high";
export type IntegrationStatus = "disconnected" | "connected" | "error" | "token_expired";
export type LearningType = "winner" | "weakness" | "hypothesis" | "fatigue_signal" | "experiment_result";
export type RunType = "daily_cycle" | "queue_process" | "analytics_sync" | "learning_update" | "monthly_refresh";
export type RunStatus = "running" | "success" | "partial" | "failed";
export type RunTriggeredBy = "cron" | "manual";
export type SnapshotWindow = "1h" | "24h" | "72h" | "7d" | "30d" | "daily";
export type SnapshotScope = "content" | "account";

// The HK AI Smart Router (src/lib/agent-providers.ts) already supports many
// providers; Social Autopilot only ever asks for Claude (preferred when
// configured) or Gemini (the real production default) — never a fabricated
// "demo" result gets treated as real content.
export type SocialAiProviderPreference = "auto" | "anthropic" | "gemini";

// Same three-mode design as the standalone build this module was ported
// from (see the delivery report) — CLAUDE_CODE_ASSISTED is the default so a
// fresh install never requires ANTHROPIC_API_KEY to run autonomously; the
// existing HK AI Smart Router remains fully available as an OPTIONAL path.
export type AiOperatingMode = "no_runtime_ai" | "optional_api_ai" | "claude_code_assisted";

export type MediaMode = "auto" | "manual" | "auto_with_fallback";
export type MediaGenerationStatus = "not_applicable" | "pending" | "generating" | "generated" | "failed" | "awaiting_manual_upload";

export type ReadinessStatus = "READY" | "WARNING" | "NOT_READY";
export type ReadinessCheck = { key: string; label: string; status: ReadinessStatus; message: string };
export type ReadinessReport = {
  overall: ReadinessStatus;
  checks: ReadinessCheck[];
  fullAutoCapableFormats: ContentType[];
  fullAutoGateKeys: string[];
  aiOperatingMode: AiOperatingMode;
};

export type StrategySupplyStatus = {
  remainingContentItems: number;
  coverageDays: number;
  activeStrategyPeriodEnd: string | null;
  lastImportedAt: string | null;
  warning: boolean;
  message: string;
};

export type SocialAutopilotSettings = {
  id: string;
  workspace_id: string;
  autopilot_active: boolean;
  control_mode: ControlMode;
  test_mode: boolean;
  emergency_pause: boolean;
  emergency_pause_reason: string | null;
  emergency_paused_at: string | null;
  emergency_paused_by: string | null;
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
  ai_operating_mode: AiOperatingMode;
  media_mode_default: MediaMode;
  full_auto_supported_formats: ContentType[];
  min_media_quality_score: number;
  media_daily_generation_cap: number;
  media_regeneration_limit: number;
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

export type SocialBrandVisualProfile = {
  id: string;
  workspace_id: string;
  logo_url: string | null;
  logo_position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center-top";
  watermark_enabled: boolean;
  color_background: string;
  color_surface: string;
  color_primary: string;
  color_accent: string;
  color_foreground: string;
  color_muted: string;
  gradient_from: string;
  gradient_to: string;
  font_family_heading: string;
  font_family_body: string;
  font_scale: number;
  line_height_scale: number;
  spacing_scale: number;
  border_radius: number;
  card_style: "flat" | "elevated" | "outlined";
  cta_style: "pill" | "block" | "underline";
  chart_palette: string[];
  created_at: string;
  updated_at: string;
};

export type SocialMediaAsset = {
  id: string;
  content_item_id: string;
  url: string;
  file_type: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  provider: string;
  slide_index: number | null;
  generated_at: string;
  quality_state: "pending" | "passed" | "rejected";
  publication_state: "unpublished" | "published";
  created_at: string;
};

export type ClicheEntry = { id: string; workspace_id: string; phrase: string; category: string; active: boolean; created_at: string };
export type PrivacyBlacklistEntry = { id: string; workspace_id: string; kind: "name" | "handle" | "domain" | "phone" | "email"; value: string; label: string; active: boolean; created_at: string };

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

export type ReelSceneItem = {
  scene: number;
  start: number;
  end: number;
  type: "kinetic_text" | "screen_capture" | "b_roll" | "chart" | "ui_mock" | "callout" | "quote";
  voiceover: string;
  text: string;
  visual_direction: string;
  transition: string;
};

export type CreativeBrief = {
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
  scenes?: ReelSceneItem[];
};

export type SocialContentItem = {
  id: string;
  workspace_id: string;
  strategy_id: string | null;
  content_date: string;
  platform: string;
  content_type: ContentType;
  funnel_stage: FunnelStage;
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
  creative_brief: CreativeBrief;
  source: "ai_generated" | "imported" | "manual";
  media_mode: MediaMode;
  media_asset_urls: string[];
  media_generation_status: MediaGenerationStatus;
  media_generation_provider: string | null;
  media_generation_error: string | null;
  media_template_used: string | null;
  media_regeneration_count: number;
  processing_stage: string | null;
  visual_quality_score: number | null;
  brand_consistency_score: number | null;
  readability_score: number | null;
  composition_score: number | null;
  content_visual_match_score: number | null;
  platform_compatibility_score: number | null;
  media_quality_score: number | null;
  primary_kpi: string;
  secondary_kpi: string;
  quality_score: number | null;
  factuality_score: number | null;
  originality_score: number | null;
  duplicate_score: number | null;
  brand_fit_score: number | null;
  privacy_check_passed: boolean;
  publication_status: PublicationStatus;
  generation_status: GenerationStatus;
  scheduled_at: string | null;
  publish_confidence: Confidence | null;
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

export type QualityCheckResult = {
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
  status: QueueStatus;
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
  status: IntegrationStatus;
  connected_at: string | null;
  connected_by: string | null;
  last_successful_call_at: string | null;
  last_publish_at: string | null;
  last_insights_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type MetricSnapshot = {
  id: string;
  workspace_id: string;
  content_item_id: string | null;
  snapshot_scope: SnapshotScope;
  snapshot_window: SnapshotWindow;
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

export type AiLearning = {
  id: string;
  workspace_id: string;
  strategy_id: string | null;
  learning_type: LearningType;
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  evidence_window: string;
  sample_size: number;
  confidence: Confidence;
  action_recommendation: string;
  applied: boolean;
  generated_at: string;
  created_at: string;
};

export type PublishingTimeRecommendation = {
  id: string;
  workspace_id: string;
  weekday: number;
  hour: number;
  content_type: string;
  content_pillar: string;
  sample_size: number;
  avg_score: number;
  confidence: Confidence;
  updated_at: string;
};

export type SocialAutopilotRun = {
  id: string;
  workspace_id: string;
  run_type: RunType;
  status: RunStatus;
  started_at: string;
  finished_at: string | null;
  summary: Record<string, unknown>;
  error: string | null;
  affected_count: number;
  triggered_by: RunTriggeredBy;
};

// ---------------------------------------------------------------------------
// Claude Code / Claude MCP — strategy/content package import contract
// (spec: "strategy_import" MCP tool). Same shape as the standalone build's
// hk-social-strategy.json contract.
// ---------------------------------------------------------------------------

export type StrategyPackageContentItem = {
  day_offset?: number;
  content_date?: string;
  content_type: ContentType;
  funnel_stage: FunnelStage;
  content_pillar: string;
  objective?: string;
  target_persona?: string;
  topic: string;
  title: string;
  hook: string;
  hook_archetype?: string;
  secondary_hook?: string;
  script?: string;
  scenes?: ReelSceneItem[];
  on_screen_text?: string;
  estimated_duration_seconds?: number;
  carousel_slides?: Array<{ index: number; headline: string; body: string }>;
  caption: string;
  cta: string;
  cta_goal?: string;
  hashtags?: string[];
  keywords?: string[];
  visual_direction?: string;
  target_kpi?: string;
  preferred_template?: string;
};

export type StrategyPackage = {
  schema_version: string;
  generated_at?: string;
  strategy: {
    period_start: string;
    period_end: string;
    monthly_objective: string;
    target_audience: string;
    personas?: Array<{ name: string; description: string }>;
    funnel_distribution?: Record<string, number>;
    content_pillars: Array<{ name: string; weight: number; description?: string }>;
    posting_frequency?: number;
    reel_ratio?: number;
    carousel_ratio?: number;
    static_ratio?: number;
    story_strategy?: string;
    follower_strategy?: string;
    authority_strategy?: string;
    lead_strategy?: string;
    conversion_strategy?: string;
    community_strategy?: string;
    testing_hypotheses?: Array<{ hypothesis: string; metric: string }>;
    kpi_targets?: Record<string, number | string>;
    creative_themes?: string[];
  };
  content_items: StrategyPackageContentItem[];
};

export type StrategyPackageRecord = {
  id: string;
  workspace_id: string;
  imported_at: string;
  imported_by: string | null;
  strategy_id: string | null;
  period_start: string;
  period_end: string;
  item_count: number;
  schema_version: string;
  package_json: StrategyPackage;
  created_at: string;
};

export type ClaudeContextExport = {
  schema_version: string;
  generated_at: string;
  account_summary: { totalPublished: number; reach30d: number; avgQualityScore: number | null; avgPerformanceScore: number | null };
  strong_topics: Array<{ key: string; avgScore: number; sampleSize: number }>;
  weak_topics: Array<{ key: string; avgScore: number; sampleSize: number }>;
  strong_hooks: Array<{ key: string; avgScore: number; sampleSize: number }>;
  weak_hooks: Array<{ key: string; avgScore: number; sampleSize: number }>;
  strongest_publishing_windows: Array<{ label: string; avgScore: number; sampleSize: number }>;
  content_fatigue: Array<{ key: string; kind: "topic" | "hook_archetype"; recentUses: number }>;
  current_pillar_distribution: Record<string, number>;
  previous_strategy_summary: { period_start: string; period_end: string; monthly_objective: string; creative_themes: string[] } | null;
  strategy_supply: StrategySupplyStatus;
};
