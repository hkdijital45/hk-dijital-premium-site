// Turns a strategy + a calendar day into a real, persisted content item.
// Splits into a deterministic local planner (which funnel stage / pillar /
// format / hook archetype today gets — spec section 13's editorial
// variation system) and one AI call that writes the actual creative
// (spec section 12).
import { supabaseRest } from "@/lib/supabase";
import { generateSocialContent, parseStructuredJson } from "./ai-client";
import { buildContentWriterPrompt } from "./prompts";
import { FUNNEL_ROTATION, HOOK_ARCHETYPES, CTA_GOALS, DEFAULT_CONTENT_PILLAR_WEIGHTS, PROMPT_VERSION } from "./constants";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type {
  SocialAiProviderPreference, SocialBrandProfile, SocialContentItem, SocialContentType, SocialCreativeBrief, SocialStrategy
} from "./types";

function weightedPick<T extends string>(weights: Record<string, number>, exclude: T | null): T {
  const entries = Object.entries(weights).filter(([key]) => key !== exclude) as [T, number][];
  const pool = entries.length ? entries : (Object.entries(weights) as [T, number][]);
  const total = pool.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0) || 1;
  let roll = Math.random() * total;
  for (const [key, weight] of pool) {
    roll -= Math.max(0, weight);
    if (roll <= 0) return key;
  }
  return pool[0][0];
}

function pickContentType(strategy: SocialStrategy, dayIndex: number): SocialContentType {
  // Deterministic weighted cycling (not random) so the reel/carousel/static
  // ratio the strategy specifies is actually honored over a run of days,
  // rather than drifting from independent random draws.
  const ratios: Array<[SocialContentType, number]> = [
    ["reel", strategy.reel_ratio || 0.5], ["carousel", strategy.carousel_ratio || 0.3], ["static", strategy.static_ratio || 0.2]
  ];
  const total = ratios.reduce((sum, [, ratio]) => sum + ratio, 0) || 1;
  const position = (dayIndex % 100) / 100 * total;
  let cursor = 0;
  for (const [type, ratio] of ratios) {
    cursor += ratio;
    if (position <= cursor) return type;
  }
  return "reel";
}

export function planDailyContentBrief(params: {
  strategy: SocialStrategy;
  dayIndex: number;
  recentPillars: string[];
  recentHookArchetypes: string[];
  recentTopics: string[];
}) {
  const funnelStage = FUNNEL_ROTATION[params.dayIndex % FUNNEL_ROTATION.length];
  const pillarWeights = params.strategy.content_pillars.length
    ? Object.fromEntries(params.strategy.content_pillars.map((pillar) => [pillar.name, pillar.weight]))
    : DEFAULT_CONTENT_PILLAR_WEIGHTS;
  const lastPillar = params.recentPillars[0] || null;
  const contentPillar = weightedPick(pillarWeights, lastPillar);

  const unusedHooks = HOOK_ARCHETYPES.filter((archetype) => !params.recentHookArchetypes.includes(archetype));
  const hookArchetype = (unusedHooks.length ? unusedHooks : [...HOOK_ARCHETYPES])[params.dayIndex % (unusedHooks.length || HOOK_ARCHETYPES.length)];

  const ctaGoal = CTA_GOALS[params.dayIndex % CTA_GOALS.length];
  const contentType = pickContentType(params.strategy, params.dayIndex);

  const themes = params.strategy.creative_themes.length ? params.strategy.creative_themes : [`${contentPillar} ile ilgili pratik bir ders`];
  const unusedThemes = themes.filter((theme) => !params.recentTopics.includes(theme));
  const topic = (unusedThemes.length ? unusedThemes : themes)[params.dayIndex % (unusedThemes.length || themes.length)];

  return { funnelStage, contentPillar, hookArchetype, ctaGoal, contentType, topic };
}

type ReelAiOutput = {
  title: string; hook: string; secondary_hook?: string; script: string; on_screen_text?: string;
  shot_plan?: string[]; b_roll?: string[]; estimated_duration_seconds?: number;
  caption: string; cta: string; hashtags?: string[]; seo_keywords?: string[];
  thumbnail_text?: string; cover_prompt?: string; visual_prompt?: string; desired_action?: string;
};
type CarouselAiOutput = {
  title: string; hook: string; slides: Array<{ index: number; headline: string; body: string }>;
  caption: string; cta: string; hashtags?: string[]; seo_keywords?: string[];
  cover_prompt?: string; visual_prompt?: string; design_notes?: string; desired_action?: string;
};
type StaticAiOutput = {
  title: string; hook: string; caption: string; cta: string; hashtags?: string[]; seo_keywords?: string[];
  cover_prompt?: string; visual_prompt?: string; desired_action?: string;
};
type ContentAiOutput = ReelAiOutput | CarouselAiOutput | StaticAiOutput;

function isContentAiOutput(value: unknown): value is ContentAiOutput {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ReelAiOutput & CarouselAiOutput>;
  return typeof candidate.title === "string" && typeof candidate.hook === "string" && typeof candidate.caption === "string" && typeof candidate.cta === "string";
}

// Loosened from ReturnType<typeof planDailyContentBrief> to plain strings
// for hookArchetype/ctaGoal — regenerateContentItem (orchestrator.ts)
// rebuilds a brief from an existing content_items row, where those columns
// are unconstrained text, not the narrower HookArchetype/CtaGoal literal
// unions planDailyContentBrief itself produces. Both call sites only ever
// feed this into buildContentWriterPrompt, which just interpolates strings.
type ContentGenerationBrief = {
  funnelStage: SocialContentItem["funnel_stage"]; contentPillar: string; hookArchetype: string; ctaGoal: string;
  contentType: SocialContentType; topic: string;
};

export async function generateContentItem(params: {
  strategy: SocialStrategy;
  brand: SocialBrandProfile;
  contentDate: string;
  brief: ContentGenerationBrief;
  recentHooksToAvoid: string[];
  recentTopicsToAvoid: string[];
  aiPreference?: SocialAiProviderPreference;
}): Promise<{ item: SocialContentItem; usedDemo: boolean }> {
  const { system, prompt } = buildContentWriterPrompt({
    brand: params.brand,
    contentType: params.brief.contentType,
    funnelStage: params.brief.funnelStage,
    contentPillar: params.brief.contentPillar,
    topic: params.brief.topic,
    objective: `${params.brief.funnelStage} aşamasında ${params.brief.ctaGoal} hedefine katkı`,
    targetPersona: params.strategy.target_audience,
    hookArchetype: params.brief.hookArchetype,
    ctaGoal: params.brief.ctaGoal,
    recentHooksToAvoid: params.recentHooksToAvoid,
    recentTopicsToAvoid: params.recentTopicsToAvoid
  });

  const result = await generateSocialContent({
    action: "content-plan",
    systemPrompt: system,
    prompt,
    preference: params.aiPreference,
    complexity: "normal",
    expectedOutputSize: "medium",
    taskType: "content_generation"
  });

  const parsed = parseStructuredJson(result.text, isContentAiOutput);

  const creativeBrief: SocialCreativeBrief = params.brief.contentType === "reel"
    ? {
      script: (parsed as ReelAiOutput).script, shot_plan: (parsed as ReelAiOutput).shot_plan, b_roll: (parsed as ReelAiOutput).b_roll,
      on_screen_text: (parsed as ReelAiOutput).on_screen_text, estimated_duration_seconds: (parsed as ReelAiOutput).estimated_duration_seconds,
      thumbnail_text: (parsed as ReelAiOutput).thumbnail_text, cover_prompt: (parsed as ReelAiOutput).cover_prompt,
      visual_prompt: (parsed as ReelAiOutput).visual_prompt, desired_action: parsed.desired_action
    }
    : params.brief.contentType === "carousel"
    ? {
      slides: (parsed as CarouselAiOutput).slides, cover_prompt: (parsed as CarouselAiOutput).cover_prompt,
      visual_prompt: (parsed as CarouselAiOutput).visual_prompt, design_notes: (parsed as CarouselAiOutput).design_notes,
      desired_action: parsed.desired_action
    }
    : { cover_prompt: (parsed as StaticAiOutput).cover_prompt, visual_prompt: (parsed as StaticAiOutput).visual_prompt, desired_action: parsed.desired_action };

  const rows = await supabaseRest<SocialContentItem[]>("social_content_items", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: SOCIAL_WORKSPACE_ID,
      strategy_id: params.strategy.id,
      content_date: params.contentDate,
      platform: "instagram",
      content_type: params.brief.contentType,
      funnel_stage: params.brief.funnelStage,
      content_pillar: params.brief.contentPillar,
      objective: `${params.brief.funnelStage} / ${params.brief.ctaGoal}`,
      target_persona: params.strategy.target_audience,
      topic: params.brief.topic,
      title: parsed.title,
      hook: parsed.hook,
      hook_archetype: params.brief.hookArchetype,
      secondary_hook: (parsed as ReelAiOutput).secondary_hook || "",
      caption: parsed.caption,
      cta: parsed.cta,
      cta_goal: params.brief.ctaGoal,
      hashtags: (parsed as ReelAiOutput).hashtags || [],
      seo_keywords: (parsed as ReelAiOutput).seo_keywords || [],
      creative_brief: creativeBrief,
      primary_kpi: params.brief.ctaGoal,
      generation_status: "generated",
      publication_status: "generated",
      ai_provider: result.provider,
      ai_model: result.model,
      prompt_version: PROMPT_VERSION
    })
  });

  return { item: rows[0], usedDemo: result.provider === "demo" };
}
