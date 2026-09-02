export type GeminiVisibilityQuestionCategory = "discovery" | "recommendation" | "comparison" | "trust" | "branded";
export type GeminiVisibilitySentiment = "positive" | "neutral" | "negative";
export type GeminiVisibilityScanStatus = "running" | "completed" | "partial" | "failed";
export type GeminiVisibilityScoreLevel = "critical" | "weak" | "developing" | "strong" | "excellent";

export type GeminiVisibilityProfile = {
  id: string;
  company_id: string;
  business_name: string;
  alternate_names: string[];
  sector: string | null;
  city: string | null;
  district: string | null;
  website: string | null;
  service_summary: string | null;
  tracking_enabled: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GeminiVisibilityQuestion = {
  id: string;
  profile_id: string;
  question_text: string;
  category: GeminiVisibilityQuestionCategory;
  is_active: boolean;
  source: "manual" | "ai_suggested";
  deleted_at?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GeminiVisibilityScoreBreakdown = {
  direct_recommendation?: number;
  name_mention?: number;
  competitor_share?: number;
  citation_presence?: number;
  recommendation_position?: number;
  sentiment?: number;
};

export type GeminiVisibilityScan = {
  id: string;
  profile_id: string;
  company_id: string;
  status: GeminiVisibilityScanStatus;
  model: string;
  questions_total: number;
  questions_completed: number;
  questions_failed: number;
  scoring_version: string;
  score: number | null;
  score_breakdown: GeminiVisibilityScoreBreakdown;
  score_level: GeminiVisibilityScoreLevel | null;
  unmeasured_components: string[];
  previous_scan_id: string | null;
  score_change: number | null;
  triggered_by: "manual" | "cron";
  forced_refresh: boolean;
  usage_json: { inputTokens?: number; outputTokens?: number; totalCalls?: number };
  error: string | null;
  started_at: string;
  finished_at: string | null;
  created_by?: string | null;
  created_at?: string;
};

export type GeminiVisibilityAnswer = {
  id: string;
  scan_id: string;
  question_id: string | null;
  question_text_snapshot: string;
  category: GeminiVisibilityQuestionCategory;
  model: string;
  status: "completed" | "failed" | "cached";
  raw_response: string | null;
  brand_mentioned: boolean | null;
  alternate_name_mentioned: boolean | null;
  recommended: boolean | null;
  position: number | null;
  competitors_mentioned: string[];
  citation: string | null;
  sentiment: GeminiVisibilitySentiment | null;
  error: string | null;
  response_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cached: boolean;
  created_at?: string;
};

export const GEMINI_VISIBILITY_SCORING_VERSION = "gemini_visibility_v1";

export const DEFAULT_QUESTION_COUNT = 8;
export const MAX_QUESTION_COUNT = 15;

export const CACHE_TTL_DAYS = 7;
export const MAX_CONCURRENT_GEMINI_REQUESTS = 2;
export const MAX_RETRIES_PER_QUESTION = 2;

// Conservative, code-defined defaults (spec section 5: "konservatif
// varsayılan limitler") — override only via env if operations needs to
// raise them, never silently changed by the feature itself.
export const DEFAULT_MONTHLY_QUOTA_PER_CUSTOMER = Number(process.env.GEMINI_GEO_MONTHLY_QUOTA_PER_CUSTOMER || 200);
export const DEFAULT_MONTHLY_QUOTA_GLOBAL = Number(process.env.GEMINI_GEO_MONTHLY_QUOTA_GLOBAL || 2000);

export const questionCategoryLabels: Record<GeminiVisibilityQuestionCategory, string> = {
  discovery: "Keşif",
  recommendation: "Öneri",
  comparison: "Karşılaştırma",
  trust: "Güven",
  branded: "Marka Bazlı"
};
