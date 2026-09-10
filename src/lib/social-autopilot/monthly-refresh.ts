// Monthly autonomous strategy refresh. Called by the daily orchestrator;
// only actually regenerates a strategy once the active period has elapsed,
// and always feeds it the real learnings synthesized from the period that
// just ended — this is what makes each cycle evolve instead of repeating
// the same monthly structure forever.
//
// This whole function is AI-authored-strategy-specific, so it's the one
// place that gates itself on ai_operating_mode directly (rather than
// leaving it to callers): in NO_RUNTIME_AI/CLAUDE_CODE_ASSISTED mode, an
// expired strategy period is completely normal and expected — the owner
// supplies the next 30-day package via Claude MCP's strategy_import tool
// (see strategy-package.ts) — so this returns refreshed:false with a
// reason rather than calling any AI endpoint or throwing.
import { getActiveStrategy, generateMonthlyStrategy } from "./strategy-engine";
import { generateLearnings, summarizeRecentLearnings } from "./learning-engine";
import type { AiOperatingMode, SocialAiProviderPreference, SocialBrandProfile } from "./types";

export async function refreshStrategyIfDue(brand: SocialBrandProfile, aiOperatingMode: AiOperatingMode, aiPreference?: SocialAiProviderPreference) {
  const active = await getActiveStrategy();
  const today = new Date().toISOString().slice(0, 10);
  if (active && active.period_end >= today) return { refreshed: false, strategy: active, reason: null as string | null };

  if (aiOperatingMode !== "optional_api_ai") {
    return { refreshed: false, strategy: active, reason: "awaiting_claude_import" };
  }

  const learningResult = await generateLearnings(active?.id || null, true, aiPreference);
  const learningsSummary = learningResult.learnings.length ? await summarizeRecentLearnings() : null;

  const { strategy } = await generateMonthlyStrategy({ brand, learningsSummary, aiPreference, allowRuntimeAi: true });
  return { refreshed: true, strategy, learningsGenerated: learningResult.learnings.length, reason: null as string | null };
}
