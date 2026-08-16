import type { IntelligenceTaskType } from "@/lib/ai-task-routing";

// HK AI Smart Router — deterministic, local, zero-latency model selection
// across the three active OpenAI production models. This NEVER calls an AI
// model to decide which AI model to use (see the module docblock further
// down for why that matters). It only decides WHICH of the three OpenAI
// models + how much reasoning/output budget a request gets; the actual
// OpenAI call happens in src/lib/openai-client.ts, and the provider-level
// decision (OpenAI vs the legacy Gemini/Groq/Anthropic/etc providers, which
// remain dormant but uncalled by default) is made in
// src/lib/ai-task-routing.ts's providerOrderForTask.

export const HK_AI_MODELS = {
  FAST: "gpt-5.6-luna",
  DEFAULT: "gpt-5.6-terra",
  POWERFUL: "gpt-5.6-sol"
} as const;

export type HKAIModel = (typeof HK_AI_MODELS)[keyof typeof HK_AI_MODELS];

export type HKReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

export interface HKModelRoute {
  model: HKAIModel;
  reasoning: HKReasoningEffort;
  reason: string;
  maxOutputTokens: number;
  allowWeb: boolean;
}

export type HKRouteComplexity = "simple" | "normal" | "critical";
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
   * text escalation heuristic in section 10 of the spec, via keyword
   * matching. Never sent to a model just to classify itself. */
  prompt?: string;
}

type Tier = "LUNA" | "TERRA" | "SOL";

// Known action ids -> tier. Kebab-case, matches the routing test matrix
// exactly (lead-score, ai-strategist, ads-doctor-pro, ...). Callers that
// already have a clear action name should pass it — it's the fastest,
// least ambiguous path and skips task-type inference entirely.
const ACTION_TIER: Record<string, Tier> = {
  // Luna — high-volume, lightweight
  "classify": "LUNA",
  "categorize": "LUNA",
  "tagging": "LUNA",
  "entity-extraction": "LUNA",
  "short-summary": "LUNA",
  "crm-note": "LUNA",
  "crm-note-cleanup": "LUNA",
  "text-normalization": "LUNA",
  "title-generation": "LUNA",
  "short-description": "LUNA",
  "lead-score": "LUNA",
  "lead-temperature": "LUNA",
  "lead-classification": "LUNA",
  "structured-data-extraction": "LUNA",
  "input-validation": "LUNA",
  "content-variation": "LUNA",
  "short-caption": "LUNA",
  "short-task-description": "LUNA",
  "customer-note-summary": "LUNA",
  "background-batch": "LUNA",

  // Terra — default professional work
  "normal-ai-chat": "TERRA",
  "social-media-strategy": "TERRA",
  "content-plan": "TERRA",
  "content-calendar": "TERRA",
  "meta-ads-analysis": "TERRA",
  "google-ads-analysis": "TERRA",
  "seo-analysis": "TERRA",
  "customer-report": "TERRA",
  "monthly-report": "TERRA",
  "package-recommendation": "TERRA",
  "ad-budget-recommendation": "TERRA",
  "proposal-support": "TERRA",
  "competitor-analysis": "TERRA",
  "digital-status-assessment": "TERRA",
  "campaign-recommendation": "TERRA",
  "conversion-recommendation": "TERRA",
  "sales-opportunity-assessment": "TERRA",

  // Sol — genuinely hard work only
  "ai-strategist": "SOL",
  "ads-doctor-pro": "SOL",
  "deep-analysis": "SOL",
  "90-day-strategy": "SOL",
  "multi-step-agent": "SOL",
  "cross-channel-synthesis": "SOL",
  "deep-cross-channel-analysis": "SOL",
  "critical-customer-strategy": "SOL",
  "complex-troubleshooting": "SOL",
  "complex-sales-strategy": "SOL",
  "comprehensive-operations-strategy": "SOL",
  "conflicting-data-decision": "SOL",
  "high-risk-final-assessment": "SOL",
  "multi-step-professional-planning": "SOL"
};

// Fallback when only an existing IntelligenceTaskType is known (no explicit
// action) — every task type not listed here already means TERRA by the
// "emin değilsen -> Terra" rule below.
const TASK_TYPE_TIER: Partial<Record<IntelligenceTaskType, Tier>> = {
  quick_summary: "LUNA",
  data_extraction: "LUNA",
  deep_research: "SOL",
  strategy: "SOL"
};

// Free-text escalation signals for "normal-ai-chat"-style open input (spec
// section 10) — local keyword heuristic only, never an extra AI call.
const ESCALATION_KEYWORDS = [
  "karşılaştır", "detaylı analiz et", "bütün verileri birleştir", "90 günlük strateji",
  "derin analiz", "birden fazla kaynak", "kapsamlı teşhis", "nedenlerini bul", "stratejik plan"
];

const OUTPUT_BUDGET: Record<Tier, Record<HKOutputSize, number>> = {
  LUNA: { short: 350, medium: 700, long: 1000 },
  TERRA: { short: 1200, medium: 1800, long: 2800 },
  SOL: { short: 2500, medium: 4000, long: 6000 }
};

function baseReasoning(tier: Tier, complexity: HKRouteComplexity): HKReasoningEffort {
  if (tier === "LUNA") return complexity === "simple" ? "none" : "low";
  if (tier === "TERRA") return complexity === "simple" ? "low" : "medium";
  // SOL: high is the production ceiling — xhigh/max/pro are intentionally
  // never selected by this router (spec section 8).
  return complexity === "critical" ? "high" : "medium";
}

function shouldEscalateToSol(signals: HKRouteSignals): string | null {
  if (signals.complexity === "critical") return "complexity=critical";
  if (signals.multiStep) return "multi-step agent task";
  // toolCount alone is deliberately NOT a reason (spec section 11) — a few
  // tool calls are well within Terra's capability.
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

  let tier: Tier = "TERRA"; // "emin değilsen -> Terra" — the safe default (spec section 9)
  let reason = "default-unknown-action-or-task";

  if (normalizedAction && ACTION_TIER[normalizedAction]) {
    tier = ACTION_TIER[normalizedAction];
    reason = `action:${normalizedAction}`;
  } else if (signals.taskType && TASK_TYPE_TIER[signals.taskType]) {
    tier = TASK_TYPE_TIER[signals.taskType]!;
    reason = `taskType:${signals.taskType}`;
  } else if (signals.taskType) {
    // Known task type, just not explicitly LUNA/SOL-mapped — Terra by design.
    reason = `taskType:${signals.taskType}:default-terra`;
  }

  // Escalation can raise (never lower) the tier, and only for genuinely
  // open-ended/professional work — not for Luna's high-volume lightweight
  // jobs, which are lightweight by definition regardless of prompt wording.
  if (tier !== "LUNA") {
    const escalation = shouldEscalateToSol(signals);
    if (escalation && tier !== "SOL") {
      tier = "SOL";
      reason = `escalated:${escalation}`;
    }
  }

  const model = tier === "LUNA" ? HK_AI_MODELS.FAST : tier === "SOL" ? HK_AI_MODELS.POWERFUL : HK_AI_MODELS.DEFAULT;
  const reasoning = baseReasoning(tier, complexity);
  const maxOutputTokens = OUTPUT_BUDGET[tier][outputSize];

  // Web search stays off by default everywhere — only genuinely fresh-data
  // task types opt in automatically, everything else requires the caller to
  // explicitly say needsWeb (spec section 12).
  const inherentlyNeedsWeb = signals.taskType ? (["deep_research", "competitor_research", "market_research"] as IntelligenceTaskType[]).includes(signals.taskType) : false;
  const allowWeb = Boolean(signals.needsWeb ?? inherentlyNeedsWeb);

  return { model, reasoning, reason, maxOutputTokens, allowWeb };
}
