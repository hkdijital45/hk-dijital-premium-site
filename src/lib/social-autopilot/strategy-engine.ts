// Rolling 30-day strategy generation. Produces one coherent monthly plan —
// not 30 unrelated posts — informed by the previous period's real results
// once they exist (see learning-engine.ts). AI-authored strategy generation
// is entirely OPTIONAL — see allowRuntimeAi below; the primary path is
// Claude MCP's strategy_import tool (strategy-package.ts), which never
// calls this file at all.
import { supabaseRest } from "@/lib/supabase";
import { generateSocialContent, parseStructuredJson } from "./ai-client";
import { buildStrategyPrompt } from "./prompts";
import { PROMPT_VERSION } from "./constants";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type { SocialAiProviderPreference, SocialBrandProfile, SocialStrategy } from "./types";

type StrategyAiOutput = {
  monthly_objective: string;
  target_audience: string;
  funnel_distribution: Record<string, number>;
  content_pillars: Array<{ name: string; weight: number; description?: string }>;
  posting_frequency: number;
  reel_ratio: number; carousel_ratio: number; static_ratio: number;
  story_strategy: string; follower_strategy: string; authority_strategy: string;
  lead_strategy: string; conversion_strategy: string; community_strategy: string;
  testing_hypotheses: Array<{ hypothesis: string; metric: string }>;
  kpi_targets: Record<string, number | string>;
  creative_themes: string[];
};

function isStrategyAiOutput(value: unknown): value is StrategyAiOutput {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StrategyAiOutput>;
  return typeof candidate.monthly_objective === "string" && typeof candidate.target_audience === "string" &&
    Array.isArray(candidate.content_pillars) && Array.isArray(candidate.creative_themes);
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function getActiveStrategy(): Promise<SocialStrategy | null> {
  const rows = await supabaseRest<SocialStrategy[]>(`social_strategies?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&status=eq.active&select=*&order=period_start.desc&limit=1`);
  return rows[0] || null;
}

export async function getMostRecentStrategy(): Promise<SocialStrategy | null> {
  const rows = await supabaseRest<SocialStrategy[]>(`social_strategies?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&order=period_start.desc&limit=1`);
  return rows[0] || null;
}

function summarizeStrategy(strategy: SocialStrategy) {
  return [
    `Hedef: ${strategy.monthly_objective}`,
    `Kitle: ${strategy.target_audience}`,
    `Sütunlar: ${strategy.content_pillars.map((pillar) => pillar.name).join(", ")}`,
    `Kreatif temalar: ${strategy.creative_themes.join(", ")}`
  ].join("\n");
}

export async function generateMonthlyStrategy(params: {
  brand: SocialBrandProfile;
  learningsSummary?: string | null;
  aiPreference?: SocialAiProviderPreference;
  // This function has no non-AI fallback (unlike quality-gate.ts/
  // learning-engine.ts) because AI-authored strategy generation IS the
  // entire point of calling it; callers (the settings-page "generate now"
  // route, monthly-refresh.ts) are responsible for not calling this at all
  // outside optional_api_ai mode.
  allowRuntimeAi: boolean;
}): Promise<{ strategy: SocialStrategy }> {
  const previous = await getMostRecentStrategy();
  const periodStart = previous ? addDays(previous.period_end, 1) : new Date().toISOString().slice(0, 10);
  const periodEnd = addDays(periodStart, 29);

  const { system, prompt } = buildStrategyPrompt({
    brand: params.brand, periodStart, periodEnd,
    previousStrategySummary: previous ? summarizeStrategy(previous) : null,
    learningsSummary: params.learningsSummary || null
  });

  const result = await generateSocialContent({ action: "social_autopilot_strategy", systemPrompt: system, prompt, preference: params.aiPreference, allowRuntimeAi: params.allowRuntimeAi, expectedOutputSize: "long", complexity: "high" });
  const parsed = parseStructuredJson(result.text, isStrategyAiOutput);

  if (previous && previous.status === "active") {
    await supabaseRest(`social_strategies?id=eq.${encodeURIComponent(previous.id)}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
  }

  const rows = await supabaseRest<SocialStrategy[]>("social_strategies", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: SOCIAL_WORKSPACE_ID, period_start: periodStart, period_end: periodEnd, status: "active",
      monthly_objective: parsed.monthly_objective, target_audience: parsed.target_audience,
      funnel_distribution: parsed.funnel_distribution || {}, content_pillars: parsed.content_pillars || [],
      posting_frequency: parsed.posting_frequency || 5, reel_ratio: parsed.reel_ratio ?? 0.5,
      carousel_ratio: parsed.carousel_ratio ?? 0.3, static_ratio: parsed.static_ratio ?? 0.2,
      story_strategy: parsed.story_strategy || "", follower_strategy: parsed.follower_strategy || "",
      authority_strategy: parsed.authority_strategy || "", lead_strategy: parsed.lead_strategy || "",
      conversion_strategy: parsed.conversion_strategy || "", community_strategy: parsed.community_strategy || "",
      testing_hypotheses: parsed.testing_hypotheses || [], kpi_targets: parsed.kpi_targets || {},
      creative_themes: parsed.creative_themes || [],
      based_on_learnings: params.learningsSummary ? [{ summary: params.learningsSummary }] : [],
      ai_provider: result.provider, ai_model: result.model, prompt_version: PROMPT_VERSION, generated_by: "ai"
    })
  });

  return { strategy: rows[0] };
}
