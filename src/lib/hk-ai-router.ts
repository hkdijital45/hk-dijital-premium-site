import type { IntelligenceTaskType } from "@/lib/ai-task-routing";

// HK AI Smart Router — deterministic, local, zero-latency model selection
// across three cost/capability tiers. This NEVER calls an AI model to decide
// which AI model to use. It only decides WHICH tier + how much thinking
// budget/output budget/web-search a request gets; the actual provider call
// happens in src/lib/gemini-client.ts (production) or src/lib/openai-client.ts
// (kept for admin-only rollback — see src/lib/ai-task-routing.ts). The tier
// vocabulary below (FAST/DEFAULT/POWERFUL) is intentionally provider-neutral
// so a future model-provider change only touches HK_AI_MODELS.

// gemini-2.5-* is no longer accessible on the production API key (confirmed
// live: 404 "This model ... is no longer available to new users"). Stable-
// first policy: FAST/DEFAULT use current-generation stable models; only
// POWERFUL uses a preview model (gemini-3.1-pro-preview, genuinely the
// strongest available tier) — and even POWERFUL has a stable fallback below
// so a preview-model outage/removal can't take production down.
export const HK_AI_MODELS = {
  FAST: "gemini-3.5-flash-lite",
  DEFAULT: "gemini-3.6-flash",
  POWERFUL: "gemini-3.1-pro-preview"
} as const;

// One controlled fallback model per tier — used only when the primary model
// for that tier is unavailable at call time (404 model-not-found), never
// chained further (src/lib/gemini-client-core.ts enforces "at most one
// fallback attempt"). POWERFUL's fallback compensates for the reduced model
// strength with a higher thinking budget, per fallbackReasoning.
export const HK_AI_FALLBACK_MODELS: Record<Tier, { model: HKAIModel; reasoning?: HKReasoningEffort }> = {
  FAST: { model: "gemini-3.5-flash" },
  DEFAULT: { model: "gemini-3.5-flash" },
  POWERFUL: { model: "gemini-3.6-flash", reasoning: "high" }
};

export type HKAIModel = "gemini-3.5-flash-lite" | "gemini-3.6-flash" | "gemini-3.1-pro-preview" | "gemini-3.5-flash";

// Abstract thinking/reasoning budget vocabulary — mapped to each provider's
// actual parameter (Gemini's ThinkingLevel, OpenAI's reasoning.effort) by
// that provider's own client, never passed through verbatim.
export type HKReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

export interface HKModelRoute {
  model: HKAIModel;
  reasoning: HKReasoningEffort;
  reason: string;
  maxOutputTokens: number;
  allowWeb: boolean;
  // Always populated — the provider client uses these only if the primary
  // model call fails with a model-not-found/unavailable error, at most once.
  fallbackModel: HKAIModel;
  fallbackReasoning: HKReasoningEffort;
}

export type HKRouteComplexity = "simple" | "normal" | "high" | "critical";
export type HKOutputSize = "short" | "medium" | "long";

export interface HKRouteSignals {
  module?: string;
  /** Primary dispatch key — a stable, kebab-case action id (e.g. "lead-score",
   * "ai-strategist"). Known actions route deterministically without ever
   * looking at the prompt text. See ACTION_TIER below for the full list. */
  action?: string;
  /** Fallback classification from the existing multi-provider router
   * (src/lib/ai-task-routing.ts's classifyAiTask) — used only when no
   * `action` is recognized. */
  taskType?: IntelligenceTaskType;
  complexity?: HKRouteComplexity;
  multiStep?: boolean;
  needsWeb?: boolean;
  hasFiles?: boolean;
  toolCount?: number;
  expectedOutputSize?: HKOutputSize;
  userIntent?: string;
  /** Raw user prompt — only consulted for the narrow "normal-ai-chat" free-
   * text escalation heuristic, via keyword matching. Never sent to a model
   * just to classify itself. */
  prompt?: string;
}

type Tier = "FAST" | "DEFAULT" | "POWERFUL";

// Known action ids -> tier. Kebab-case, matches the routing test matrix
// exactly (lead-score, ai-strategist, ads-doctor-pro, ...). Callers that
// already have a clear action name should pass it — it's the fastest,
// least ambiguous path and skips task-type inference entirely.
const ACTION_TIER: Record<string, Tier> = {
  // FAST — high-volume, lightweight (gemini-3.5-flash-lite)
  "classify": "FAST",
  "categorize": "FAST",
  "tagging": "FAST",
  "entity-extraction": "FAST",
  "short-summary": "FAST",
  "crm-note": "FAST",
  "crm-note-cleanup": "FAST",
  "text-normalization": "FAST",
  "title-generation": "FAST",
  "short-description": "FAST",
  "lead-score": "FAST",
  "lead-temperature": "FAST",
  "lead-classification": "FAST",
  "structured-data-extraction": "FAST",
  "input-validation": "FAST",
  "content-variation": "FAST",
  "short-caption": "FAST",
  "short-task-description": "FAST",
  "customer-note-summary": "FAST",
  "background-batch": "FAST",

  // DEFAULT — default professional work (gemini-3.6-flash)
  "normal-ai-chat": "DEFAULT",
  "social-media-strategy": "DEFAULT",
  "content-plan": "DEFAULT",
  "content-calendar": "DEFAULT",
  "meta-ads-analysis": "DEFAULT",
  "google-ads-analysis": "DEFAULT",
  "seo-analysis": "DEFAULT",
  "customer-report": "DEFAULT",
  "monthly-report": "DEFAULT",
  "package-recommendation": "DEFAULT",
  "ad-budget-recommendation": "DEFAULT",
  "proposal-support": "DEFAULT",
  "competitor-analysis": "DEFAULT",
  "digital-status-assessment": "DEFAULT",
  "campaign-recommendation": "DEFAULT",
  "conversion-recommendation": "DEFAULT",
  "sales-opportunity-assessment": "DEFAULT",

  // POWERFUL — genuinely hard work only (gemini-3.1-pro-preview)
  "ai-strategist": "POWERFUL",
  "ads-doctor-pro": "POWERFUL",
  "deep-analysis": "POWERFUL",
  "90-day-strategy": "POWERFUL",
  "multi-step-agent": "POWERFUL",
  "cross-channel-synthesis": "POWERFUL",
  "deep-cross-channel-analysis": "POWERFUL",
  "critical-customer-strategy": "POWERFUL",
  "complex-troubleshooting": "POWERFUL",
  "complex-sales-strategy": "POWERFUL",
  "comprehensive-operations-strategy": "POWERFUL",
  "conflicting-data-decision": "POWERFUL",
  "high-risk-final-assessment": "POWERFUL",
  "multi-step-professional-planning": "POWERFUL"
};

// Fallback when only an existing IntelligenceTaskType is known (no explicit
// action) — every task type not listed here already means DEFAULT by the
// "emin değilsen -> Flash" rule below.
const TASK_TYPE_TIER: Partial<Record<IntelligenceTaskType, Tier>> = {
  quick_summary: "FAST",
  data_extraction: "FAST",
  deep_research: "POWERFUL",
  strategy: "POWERFUL"
};

// Free-text escalation signals for "normal-ai-chat"-style open input — local
// keyword heuristic only, never an extra AI call.
const ESCALATION_KEYWORDS = [
  "karşılaştır", "detaylı analiz et", "bütün verileri birleştir", "90 günlük strateji",
  "derin analiz", "birden fazla kaynak", "kapsamlı teşhis", "nedenlerini bul", "stratejik plan"
];

const OUTPUT_BUDGET: Record<Tier, Record<HKOutputSize, number>> = {
  FAST: { short: 350, medium: 700, long: 1000 },
  DEFAULT: { short: 1200, medium: 1800, long: 2800 },
  POWERFUL: { short: 2500, medium: 4000, long: 6000 }
};

function baseReasoning(tier: Tier, complexity: HKRouteComplexity): HKReasoningEffort {
  if (tier === "FAST") return complexity === "simple" ? "none" : "low";
  if (tier === "DEFAULT") return complexity === "simple" ? "low" : "medium";
  // POWERFUL: high is the production ceiling — xhigh/max are intentionally
  // never selected by this router.
  return complexity === "critical" ? "high" : "medium";
}

function shouldEscalateToPowerful(signals: HKRouteSignals): string | null {
  if (signals.complexity === "critical") return "complexity=critical";
  // multiStep alone is deliberately NOT sufficient — that was the previous
  // router's cost anti-pattern. It only escalates when paired with a
  // genuinely high complexity signal; a normal multi-step task stays on
  // DEFAULT (Flash).
  if (signals.multiStep && signals.complexity === "high") return "multiStep + complexity=high";
  // toolCount alone is deliberately NOT a reason — a few tool calls are well
  // within DEFAULT's capability.
  const text = (signals.prompt || "").toLocaleLowerCase("tr");
  if (text && ESCALATION_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return "free-text escalation keyword matched";
  }
  return null;
}

/**
 * Deterministic HK AI model route — module/action(+optional signals) in,
 * model+reasoning+budget out, in well under a millisecond, no network call.
 */
export function resolveHkAiRoute(signals: HKRouteSignals = {}): HKModelRoute {
  const normalizedAction = signals.action ? signals.action.trim().toLocaleLowerCase("tr") : "";
  const complexity: HKRouteComplexity = signals.complexity || "normal";
  const outputSize: HKOutputSize = signals.expectedOutputSize || "medium";

  let tier: Tier = "DEFAULT"; // "emin değilsen -> Flash" — the safe default
  let reason = "default-unknown-action-or-task";

  if (normalizedAction && ACTION_TIER[normalizedAction]) {
    tier = ACTION_TIER[normalizedAction];
    reason = `action:${normalizedAction}`;
  } else if (signals.taskType && TASK_TYPE_TIER[signals.taskType]) {
    tier = TASK_TYPE_TIER[signals.taskType]!;
    reason = `taskType:${signals.taskType}`;
  } else if (signals.taskType) {
    // Known task type, just not explicitly FAST/POWERFUL-mapped — DEFAULT by design.
    reason = `taskType:${signals.taskType}:default-flash`;
  }

  // Escalation can raise (never lower) the tier, and only for genuinely
  // open-ended/professional work — not for FAST's high-volume lightweight
  // jobs, which are lightweight by definition regardless of prompt wording.
  if (tier !== "FAST") {
    const escalation = shouldEscalateToPowerful(signals);
    if (escalation && tier !== "POWERFUL") {
      tier = "POWERFUL";
      reason = `escalated:${escalation}`;
    }
  }

  const model = HK_AI_MODELS[tier];
  const reasoning = baseReasoning(tier, complexity);
  const maxOutputTokens = OUTPUT_BUDGET[tier][outputSize];

  // Web search stays off by default everywhere — only genuinely fresh-data
  // task types opt in automatically, everything else requires the caller to
  // explicitly say needsWeb.
  const inherentlyNeedsWeb = signals.taskType ? (["deep_research", "competitor_research", "market_research"] as IntelligenceTaskType[]).includes(signals.taskType) : false;
  const allowWeb = Boolean(signals.needsWeb ?? inherentlyNeedsWeb);

  const fallback = HK_AI_FALLBACK_MODELS[tier];
  return { model, reasoning, reason, maxOutputTokens, allowWeb, fallbackModel: fallback.model, fallbackReasoning: fallback.reasoning || reasoning };
}
