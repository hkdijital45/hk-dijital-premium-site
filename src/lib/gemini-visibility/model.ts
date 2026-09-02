import { HK_AI_FALLBACK_MODELS, HK_AI_MODELS, type HKAIModel } from "@/lib/hk-ai-router";

const KNOWN_MODELS = new Set<HKAIModel>(["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.1-pro-preview", "gemini-3.5-flash"]);

// Server-only override for the per-question scan model. Must name a model
// this codebase already knows how to call (src/lib/hk-ai-router.ts) — an
// unrecognized or hallucinated model name is rejected in favor of the safe
// economical default, never passed through to the Gemini API blind.
export function resolveScanModel(): HKAIModel {
  const override = process.env.GEMINI_GEO_MODEL;
  if (override && KNOWN_MODELS.has(override as HKAIModel)) return override as HKAIModel;
  return HK_AI_MODELS.FAST;
}

export function scanModelFallback(model: HKAIModel): HKAIModel | undefined {
  if (model === HK_AI_MODELS.FAST) return HK_AI_FALLBACK_MODELS.FAST.model;
  if (model === HK_AI_MODELS.DEFAULT) return HK_AI_FALLBACK_MODELS.DEFAULT.model;
  if (model === HK_AI_MODELS.POWERFUL) return HK_AI_FALLBACK_MODELS.POWERFUL.model;
  return undefined;
}

// The one batch analysis call per scan (spec section 4) needs more reliable
// structured-JSON extraction across several answers at once than the
// economical per-question model — uses the DEFAULT tier, still real Gemini,
// never a second provider.
export function resolveAnalysisModel(): HKAIModel {
  return HK_AI_MODELS.DEFAULT;
}

export function resolveSuggestQuestionsModel(): HKAIModel {
  return HK_AI_MODELS.FAST;
}
