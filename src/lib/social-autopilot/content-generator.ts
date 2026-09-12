// Turns a strategy + a calendar day into a real, persisted content item.
// Splits into a deterministic local planner (which funnel stage / pillar /
// format / hook archetype today gets — the editorial variation system) and
// one AI call that writes the actual creative. Immediately after, runs the
// media stage (AUTO MEDIA / MANUAL MEDIA — see media/pipeline.ts) so every
// content item leaves this function with an honest, correct
// media_generation_status instead of silently sitting in limbo.
import { supabaseRest } from "@/lib/supabase";
import { generateSocialContent, parseStructuredJson } from "./ai-client";
import { buildContentWriterPrompt } from "./prompts";
import { determineMediaMode, runMediaStage } from "./media/pipeline";
import { selectCarouselTemplate, templateSlideStructureHint } from "./media/render/template-selector.ts";
import { fetchRecentCarouselTemplates } from "./media/render/template-history.ts";
import { FUNNEL_ROTATION, HOOK_ARCHETYPES, CTA_GOALS, DEFAULT_CONTENT_PILLAR_WEIGHTS, PROMPT_VERSION } from "./constants";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type { SocialAiProviderPreference, SocialBrandProfile, SocialContentItem, ContentType, CreativeBrief, MediaMode, ReelSceneItem, SocialStrategy } from "./types";

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

// allowedTypes restricts the pool — used in FULL AUTO mode to only ever
// choose a format social_autopilot_settings.full_auto_supported_formats
// actually lists — never generates a Reel it already knows it can't finish
// end-to-end. NEEDS_MEDIA still exists as a safety net for anything that
// slips through (e.g. an APPROVAL/MANUAL-mode Reel).
function pickContentType(strategy: SocialStrategy, dayIndex: number, allowedTypes?: ContentType[]): ContentType {
  const allRatios: Array<[ContentType, number]> = [["reel", strategy.reel_ratio || 0.5], ["carousel", strategy.carousel_ratio || 0.3], ["static", strategy.static_ratio || 0.2]];
  const ratios = allowedTypes ? allRatios.filter(([type]) => allowedTypes.includes(type)) : allRatios;
  const pool = ratios.length ? ratios : allRatios;
  const total = pool.reduce((sum, [, ratio]) => sum + ratio, 0) || 1;
  const position = (dayIndex % 100) / 100 * total;
  let cursor = 0;
  for (const [type, ratio] of pool) {
    cursor += ratio;
    if (position <= cursor) return type;
  }
  return pool[0][0];
}

export function planDailyContentBrief(params: { strategy: SocialStrategy; dayIndex: number; recentPillars: string[]; recentHookArchetypes: string[]; recentTopics: string[]; allowedContentTypes?: ContentType[] }) {
  const funnelStage = FUNNEL_ROTATION[params.dayIndex % FUNNEL_ROTATION.length];
  const pillarWeights = params.strategy.content_pillars.length
    ? Object.fromEntries(params.strategy.content_pillars.map((pillar) => [pillar.name, pillar.weight]))
    : DEFAULT_CONTENT_PILLAR_WEIGHTS;
  const lastPillar = params.recentPillars[0] || null;
  const contentPillar = weightedPick(pillarWeights, lastPillar);

  const unusedHooks = HOOK_ARCHETYPES.filter((archetype) => !params.recentHookArchetypes.includes(archetype));
  const hookArchetype = (unusedHooks.length ? unusedHooks : [...HOOK_ARCHETYPES])[params.dayIndex % (unusedHooks.length || HOOK_ARCHETYPES.length)];

  const ctaGoal = CTA_GOALS[params.dayIndex % CTA_GOALS.length];
  const contentType = pickContentType(params.strategy, params.dayIndex, params.allowedContentTypes);

  const themes = params.strategy.creative_themes.length ? params.strategy.creative_themes : [`${contentPillar} ile ilgili pratik bir ders`];
  const unusedThemes = themes.filter((theme) => !params.recentTopics.includes(theme));
  const topic = (unusedThemes.length ? unusedThemes : themes)[params.dayIndex % (unusedThemes.length || themes.length)];

  return { funnelStage, contentPillar, hookArchetype, ctaGoal, contentType, topic };
}

type ReelAiOutput = {
  title: string; hook: string; secondary_hook?: string; script: string; on_screen_text?: string;
  shot_plan?: string[]; b_roll?: string[]; estimated_duration_seconds?: number; scenes?: ReelSceneItem[];
  caption: string; cta: string; hashtags?: string[]; seo_keywords?: string[];
  thumbnail_text?: string; cover_prompt?: string; visual_prompt?: string; desired_action?: string;
};
type CarouselAiOutput = {
  title: string; hook: string; slides: Array<{ index: number; headline: string; body: string }>;
  caption: string; cta: string; hashtags?: string[]; seo_keywords?: string[];
  cover_prompt?: string; visual_prompt?: string; design_notes?: string; desired_action?: string;
};
type StaticAiOutput = { title: string; hook: string; caption: string; cta: string; hashtags?: string[]; seo_keywords?: string[]; cover_prompt?: string; visual_prompt?: string; desired_action?: string };
type ContentAiOutput = ReelAiOutput | CarouselAiOutput | StaticAiOutput;

function isContentAiOutput(value: unknown): value is ContentAiOutput {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ReelAiOutput & CarouselAiOutput>;
  return typeof candidate.title === "string" && typeof candidate.hook === "string" && typeof candidate.caption === "string" && typeof candidate.cta === "string";
}

type ContentGenerationBrief = { funnelStage: SocialContentItem["funnel_stage"]; contentPillar: string; hookArchetype: string; ctaGoal: string; contentType: ContentType; topic: string };

/** The media-stage tail shared by every path that leaves a content_items
 * row sitting with media_generation_status "pending" — a freshly
 * AI-generated item (this file) and a freshly-imported item from a Claude
 * MCP strategy_import (strategy-package.ts, via orchestrator.ts) both need
 * exactly this same treatment. */
export async function runMediaAndPersist(
  item: Pick<SocialContentItem, "id" | "content_type" | "creative_brief" | "title" | "hook" | "caption" | "media_mode" | "cta" | "funnel_stage" | "content_pillar">,
  brandName: string,
  preselectedTemplate?: string
): Promise<SocialContentItem> {
  const outcome = await runMediaStage(item, brandName, preselectedTemplate);

  const finalPatch: Record<string, unknown> = { ...outcome.patch };
  if (outcome.needsMedia) finalPatch.publication_status = "needs_media";

  const updatedRows = await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(item.id)}&select=*`, { method: "PATCH", body: JSON.stringify(finalPatch) });

  if (outcome.assetMetadata?.length) {
    const urls = outcome.patch.media_asset_urls;
    await Promise.all(outcome.assetMetadata.map((meta, i) => supabaseRest("social_media_assets", {
      method: "POST",
      body: JSON.stringify({
        content_item_id: item.id, url: urls[i], file_type: "image/jpeg", width: meta.width, height: meta.height,
        size_bytes: meta.sizeBytes, provider: outcome.patch.media_generation_provider || "deterministic-renderer",
        slide_index: meta.slideIndex, quality_state: "passed", publication_state: "unpublished"
      })
    })));
  }

  return updatedRows[0];
}

export async function generateContentItem(params: {
  strategy: SocialStrategy;
  brand: SocialBrandProfile;
  contentDate: string;
  brief: ContentGenerationBrief;
  recentHooksToAvoid: string[];
  recentTopicsToAvoid: string[];
  aiPreference?: SocialAiProviderPreference;
  mediaModeDefault?: MediaMode;
  // The orchestrator only ever calls this function at all when
  // ai_operating_mode is "optional_api_ai", but the gate is threaded
  // through explicitly anyway rather than assumed.
  allowRuntimeAi: boolean;
}): Promise<{ item: SocialContentItem; carouselTemplate: string | null }> {
  // Carousel template is chosen BEFORE the copy is written (deterministic,
  // anti-repetition) so the AI can be told exactly what shape to write
  // slide bodies in, and the renderer later uses this exact same choice
  // rather than re-selecting independently.
  const carouselTemplate = params.brief.contentType === "carousel"
    ? selectCarouselTemplate(params.brief.funnelStage, await fetchRecentCarouselTemplates())
    : null;

  const { system, prompt } = buildContentWriterPrompt({
    brand: params.brand, contentType: params.brief.contentType, funnelStage: params.brief.funnelStage, contentPillar: params.brief.contentPillar,
    topic: params.brief.topic, objective: `${params.brief.funnelStage} aşamasında ${params.brief.ctaGoal} hedefine katkı`,
    targetPersona: params.strategy.target_audience, hookArchetype: params.brief.hookArchetype, ctaGoal: params.brief.ctaGoal,
    recentHooksToAvoid: params.recentHooksToAvoid, recentTopicsToAvoid: params.recentTopicsToAvoid,
    carouselTemplateStructureHint: carouselTemplate ? templateSlideStructureHint(carouselTemplate) : undefined
  });

  const result = await generateSocialContent({ action: "social_autopilot_content_generation", systemPrompt: system, prompt, preference: params.aiPreference, allowRuntimeAi: params.allowRuntimeAi, expectedOutputSize: "long" });
  const parsed = parseStructuredJson(result.text, isContentAiOutput);

  const creativeBrief: CreativeBrief = params.brief.contentType === "reel"
    ? {
      script: (parsed as ReelAiOutput).script, shot_plan: (parsed as ReelAiOutput).shot_plan, b_roll: (parsed as ReelAiOutput).b_roll,
      on_screen_text: (parsed as ReelAiOutput).on_screen_text, estimated_duration_seconds: (parsed as ReelAiOutput).estimated_duration_seconds,
      scenes: (parsed as ReelAiOutput).scenes, thumbnail_text: (parsed as ReelAiOutput).thumbnail_text, cover_prompt: (parsed as ReelAiOutput).cover_prompt,
      visual_prompt: (parsed as ReelAiOutput).visual_prompt, desired_action: parsed.desired_action
    }
    : params.brief.contentType === "carousel"
    ? { slides: (parsed as CarouselAiOutput).slides, cover_prompt: (parsed as CarouselAiOutput).cover_prompt, visual_prompt: (parsed as CarouselAiOutput).visual_prompt, design_notes: (parsed as CarouselAiOutput).design_notes, desired_action: parsed.desired_action }
    : { cover_prompt: (parsed as StaticAiOutput).cover_prompt, visual_prompt: (parsed as StaticAiOutput).visual_prompt, desired_action: parsed.desired_action };

  const mediaMode = determineMediaMode(params.mediaModeDefault || "manual", params.brief.contentType);

  const rows = await supabaseRest<SocialContentItem[]>("social_content_items", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: SOCIAL_WORKSPACE_ID, strategy_id: params.strategy.id, content_date: params.contentDate, platform: "instagram",
      content_type: params.brief.contentType, funnel_stage: params.brief.funnelStage, content_pillar: params.brief.contentPillar,
      objective: `${params.brief.funnelStage} / ${params.brief.ctaGoal}`, target_persona: params.strategy.target_audience, topic: params.brief.topic,
      title: parsed.title, hook: parsed.hook, hook_archetype: params.brief.hookArchetype, secondary_hook: (parsed as ReelAiOutput).secondary_hook || "",
      caption: parsed.caption, cta: parsed.cta, cta_goal: params.brief.ctaGoal,
      hashtags: (parsed as ReelAiOutput).hashtags || [], seo_keywords: (parsed as ReelAiOutput).seo_keywords || [],
      creative_brief: creativeBrief, media_mode: mediaMode, media_generation_status: "pending", source: "ai_generated", primary_kpi: params.brief.ctaGoal,
      generation_status: "generated", publication_status: "generated",
      ai_provider: result.provider, ai_model: result.model, prompt_version: PROMPT_VERSION
    })
  });

  const created = rows[0];
  const updated = await runMediaAndPersist(created, params.brand.brand_name, carouselTemplate || undefined);
  return { item: updated, carouselTemplate };
}
