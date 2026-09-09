// Monthly autonomous strategy refresh (spec section 29). Called by the
// daily orchestrator; only actually regenerates a strategy once the active
// period has elapsed, and always feeds it the real learnings synthesized
// from the period that just ended — this is what makes each cycle evolve
// instead of repeating the same monthly structure forever.
import { getActiveStrategy, generateMonthlyStrategy } from "./strategy-engine";
import { generateLearnings, summarizeRecentLearnings } from "./learning-engine";
import type { SocialAiProviderPreference, SocialBrandProfile } from "./types";

export async function refreshStrategyIfDue(brand: SocialBrandProfile, aiPreference?: SocialAiProviderPreference) {
  const active = await getActiveStrategy();
  const today = new Date().toISOString().slice(0, 10);
  if (active && active.period_end >= today) return { refreshed: false, strategy: active };

  // Period elapsed (or no strategy exists yet) — synthesize fresh learnings
  // from whatever real performance data exists first, then generate the
  // next 30-day strategy informed by them.
  const learningResult = await generateLearnings(active?.id || null);
  const learningsSummary = learningResult.learnings.length ? await summarizeRecentLearnings() : null;

  const { strategy, usedDemo } = await generateMonthlyStrategy({ brand, learningsSummary, aiPreference });
  return { refreshed: true, strategy, usedDemo, learningsGenerated: learningResult.learnings.length };
}
