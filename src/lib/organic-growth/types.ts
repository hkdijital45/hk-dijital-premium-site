// Organik Büyüme Merkezi — shared types/constants. Zero external imports
// (kept pure/dependency-free like connect-capabilities.ts) so the
// deterministic engines built on top of this file stay unit-testable
// under the plain node test runner (no @/ alias resolution there).

export const CONTENT_PLAN_STATUSES = [
  "PLANNED", "BRIEF_READY", "WAITING_FOR_CLAUDE", "DRAFT", "REVIEW",
  "APPROVED", "SCHEDULED", "PUBLISHED", "UPDATE_REQUIRED"
] as const;
export type ContentPlanStatus = (typeof CONTENT_PLAN_STATUSES)[number];

export const CONTENT_PLAN_STATUS_LABELS: Record<ContentPlanStatus, string> = {
  PLANNED: "Planlandı",
  BRIEF_READY: "Brief Hazır",
  WAITING_FOR_CLAUDE: "Claude Bekleniyor",
  DRAFT: "Taslak",
  REVIEW: "İncelemede",
  APPROVED: "Onaylandı",
  SCHEDULED: "Yayına Planlandı",
  PUBLISHED: "Yayınlandı",
  UPDATE_REQUIRED: "Güncelleme Gerekli"
};

export const PRIORITY_LEVELS = ["low", "medium", "high"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const PILLAR_OR_SUPPORTING = ["pillar", "supporting"] as const;
export type PillarOrSupporting = (typeof PILLAR_OR_SUPPORTING)[number];

export const STRATEGY_STATUSES = ["draft", "active", "completed"] as const;
export type StrategyStatus = (typeof STRATEGY_STATUSES)[number];

// Canonical HK Dijital service list — mirrors src/lib/public-seo-content.ts
// servicePages (slug/eyebrow). Duplicated here (not imported) only because
// that file pulls in lucide-react icon components; this keeps the
// organic-growth types module icon-free and dependency-free. Any new
// service page added there should be mirrored here.
export const TARGET_SERVICES = [
  { slug: "meta-reklam-yonetimi", label: "Meta Reklam Yönetimi" },
  { slug: "google-ads-yonetimi", label: "Google Ads Yönetimi" },
  { slug: "sosyal-medya-yonetimi", label: "Sosyal Medya Yönetimi" },
  { slug: "dijital-pazarlama-danismanligi", label: "Dijital Pazarlama Danışmanlığı" }
] as const;

export type MonthlyStrategy = {
  id: string;
  month: string;
  business_objective: string;
  target_services: string[];
  target_geography: string;
  target_audience: string;
  publishing_frequency: string;
  strategic_notes: string;
  status: StrategyStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TopicCluster = {
  id: string;
  name: string;
  slug: string;
  description: string;
  target_service: string | null;
  search_intents: string[];
  geography: string | null;
  pillar_article_id: string | null;
  created_at: string;
  updated_at: string;
};

// hk_recommendations.recommendation_type is free-text (no enum), shared
// across every HK Intelligence CEO analysis area — this keyword filter
// surfaces the organic/content/SEO/GEO-relevant subset for a customer
// without adding a new recommendation_type value or a parallel table.
const ORGANIC_RECOMMENDATION_KEYWORDS = ["seo", "geo", "content", "içerik", "blog", "organik", "organic", "search"];

export function isOrganicRecommendationType(recommendationType: string): boolean {
  const normalized = recommendationType.toLocaleLowerCase("tr");
  return ORGANIC_RECOMMENDATION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export type ContentPlanItem = {
  id: string;
  strategy_id: string | null;
  topic_cluster_id: string | null;
  blog_post_id: string | null;
  planned_publication_date: string | null;
  working_title: string;
  primary_topic: string;
  search_intent: string;
  funnel_stage: string;
  target_service: string;
  target_geography: string;
  target_audience: string;
  pillar_or_supporting: PillarOrSupporting | null;
  article_type: string;
  priority: PriorityLevel;
  rationale: string;
  cta_objective: string;
  internal_link_targets: string[];
  status: ContentPlanStatus;
  why_this_article: string;
  primary_question: string;
  secondary_questions: string[];
  related_concepts: string[];
  must_cover_points: string[];
  existing_related_content: string[];
  content_angle: string;
  seo_requirements: string;
  geo_requirements: string;
  facts_sources: string;
  editorial_notes: string;
  claude_prompt_cache: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
