// The Claude Code / Claude MCP <-> HK Social Autopilot contract
// ("strategy_import" MCP tool). validateStrategyPackage is pure (no DB
// access) so it's directly unit-testable and reusable by both the "Validate
// Package" / "Preview Import" UI action and applyStrategyPackage below.
// Validation is all-or-nothing by design — every item in the package is
// checked BEFORE any database write happens, so a package that fails
// partway through never leaves a half-imported strategy behind.
import { supabaseRest } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type { ContentType, CreativeBrief, FunnelStage, SocialStrategy, StrategyPackage, StrategyPackageContentItem } from "./types";

export const STRATEGY_PACKAGE_SCHEMA_VERSION = "1.0";
const MAX_CONTENT_ITEMS = 62; // generous headroom over "up to 2/day for 31 days" — a sanity cap, not a real product limit
const VALID_CONTENT_TYPES: ContentType[] = ["reel", "carousel", "static", "story"];
const VALID_FUNNEL_STAGES: FunnelStage[] = ["awareness", "problem_awareness", "consideration", "authority", "trust", "conversion", "retention"];

export type StrategyPackagePreview = {
  periodStart: string;
  periodEnd: string;
  monthlyObjective: string;
  contentPillars: string[];
  itemCount: number;
  itemsByType: Record<string, number>;
  itemsByFunnelStage: Record<string, number>;
  firstContentDate: string | null;
  lastContentDate: string | null;
};

export type StrategyPackageValidationResult =
  | { valid: true; package: StrategyPackage; warnings: string[]; preview: StrategyPackagePreview }
  | { valid: false; errors: string[]; warnings: string[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / (24 * 60 * 60_000));
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function validateContentItem(raw: unknown, index: number, periodStart: string, periodEnd: string, errors: string[], warnings: string[]): StrategyPackageContentItem | null {
  const prefix = `content_items[${index}]`;
  if (!isPlainObject(raw)) { errors.push(`${prefix}: bir nesne olmalı.`); return null; }

  const contentType = raw.content_type;
  if (typeof contentType !== "string" || !VALID_CONTENT_TYPES.includes(contentType as ContentType)) {
    errors.push(`${prefix}.content_type: geçersiz veya eksik (beklenen: ${VALID_CONTENT_TYPES.join(", ")}).`);
  }
  const funnelStage = raw.funnel_stage;
  if (typeof funnelStage !== "string" || !VALID_FUNNEL_STAGES.includes(funnelStage as FunnelStage)) {
    errors.push(`${prefix}.funnel_stage: geçersiz veya eksik (beklenen: ${VALID_FUNNEL_STAGES.join(", ")}).`);
  }
  for (const field of ["content_pillar", "topic", "title", "hook", "caption", "cta"] as const) {
    if (typeof raw[field] !== "string" || !(raw[field] as string).trim()) errors.push(`${prefix}.${field}: boş olamayan bir metin olmalı.`);
  }

  let contentDate: string | undefined;
  if (raw.content_date !== undefined) {
    if (!isIsoDate(raw.content_date)) errors.push(`${prefix}.content_date: geçerli bir YYYY-MM-DD tarihi olmalı.`);
    else contentDate = raw.content_date;
  } else if (raw.day_offset !== undefined) {
    if (typeof raw.day_offset !== "number" || raw.day_offset < 0 || !Number.isInteger(raw.day_offset)) {
      errors.push(`${prefix}.day_offset: negatif olmayan bir tam sayı olmalı.`);
    } else {
      contentDate = addDaysIso(periodStart, raw.day_offset);
    }
  } else {
    errors.push(`${prefix}: content_date veya day_offset alanlarından biri zorunlu.`);
  }
  if (contentDate && (contentDate < periodStart || contentDate > periodEnd)) {
    errors.push(`${prefix}: hesaplanan tarih (${contentDate}) strateji periyodunun (${periodStart} → ${periodEnd}) dışında.`);
  }

  if (contentType === "carousel") {
    const slides = raw.carousel_slides;
    if (!Array.isArray(slides) || slides.length < 2 || slides.length > 10) {
      errors.push(`${prefix}.carousel_slides: 2-10 slayt içeren bir dizi olmalı (Instagram sınırı).`);
    } else {
      slides.forEach((slide, slideIndex) => {
        if (!isPlainObject(slide) || typeof slide.headline !== "string" || !slide.headline.trim() || typeof slide.body !== "string" || typeof slide.index !== "number") {
          errors.push(`${prefix}.carousel_slides[${slideIndex}]: {index:number, headline:non-empty string, body:string} şeklinde olmalı.`);
        }
      });
    }
  }
  if (contentType === "reel" && (typeof raw.script !== "string" || !raw.script.trim())) {
    errors.push(`${prefix}.script: reel içerikler için zorunlu, boş olamaz.`);
  }

  for (const field of ["hashtags", "keywords"] as const) {
    if (raw[field] !== undefined && (!Array.isArray(raw[field]) || !(raw[field] as unknown[]).every((v) => typeof v === "string"))) {
      errors.push(`${prefix}.${field}: bir metin dizisi olmalı.`);
    }
  }
  if (raw.hook_archetype !== undefined && typeof raw.hook_archetype !== "string") errors.push(`${prefix}.hook_archetype: bir metin olmalı.`);
  if (raw.cta_goal !== undefined && typeof raw.cta_goal !== "string") errors.push(`${prefix}.cta_goal: bir metin olmalı.`);
  if (raw.preferred_template !== undefined && typeof raw.preferred_template !== "string") warnings.push(`${prefix}.preferred_template: metin değil, yok sayılacak.`);

  return raw as unknown as StrategyPackageContentItem;
}

export function validateStrategyPackage(raw: unknown): StrategyPackageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(raw)) return { valid: false, errors: ["Paket kök seviyede bir JSON nesnesi olmalı."], warnings };
  if (raw.schema_version !== STRATEGY_PACKAGE_SCHEMA_VERSION) {
    errors.push(`schema_version: "${STRATEGY_PACKAGE_SCHEMA_VERSION}" bekleniyor, "${String(raw.schema_version)}" alındı.`);
  }

  const strategy = raw.strategy;
  if (!isPlainObject(strategy)) {
    errors.push("strategy: bir nesne olmalı.");
    return { valid: false, errors, warnings };
  }

  let periodStart = "";
  let periodEnd = "";
  if (!isIsoDate(strategy.period_start)) errors.push("strategy.period_start: geçerli bir YYYY-MM-DD tarihi olmalı.");
  else periodStart = strategy.period_start;
  if (!isIsoDate(strategy.period_end)) errors.push("strategy.period_end: geçerli bir YYYY-MM-DD tarihi olmalı.");
  else periodEnd = strategy.period_end;
  if (periodStart && periodEnd && daysBetween(periodStart, periodEnd) <= 0) errors.push("strategy.period_end, period_start'tan sonra olmalı.");

  if (typeof strategy.monthly_objective !== "string" || !strategy.monthly_objective.trim()) errors.push("strategy.monthly_objective: boş olamayan bir metin olmalı.");
  if (typeof strategy.target_audience !== "string" || !strategy.target_audience.trim()) errors.push("strategy.target_audience: boş olamayan bir metin olmalı.");

  const contentPillars = strategy.content_pillars;
  if (!Array.isArray(contentPillars) || !contentPillars.length) {
    errors.push("strategy.content_pillars: en az bir öğe içeren bir dizi olmalı.");
  } else {
    contentPillars.forEach((pillar, i) => {
      if (!isPlainObject(pillar) || typeof pillar.name !== "string" || !pillar.name.trim() || typeof pillar.weight !== "number") {
        errors.push(`strategy.content_pillars[${i}]: {name:non-empty string, weight:number} şeklinde olmalı.`);
      }
    });
  }

  for (const field of ["reel_ratio", "carousel_ratio", "static_ratio"] as const) {
    if (strategy[field] !== undefined && (typeof strategy[field] !== "number" || strategy[field] < 0 || strategy[field] > 1)) {
      errors.push(`strategy.${field}: 0-1 arasında bir sayı olmalı.`);
    }
  }
  if (strategy.creative_themes !== undefined && (!Array.isArray(strategy.creative_themes) || !strategy.creative_themes.every((v) => typeof v === "string"))) {
    errors.push("strategy.creative_themes: bir metin dizisi olmalı.");
  }

  const contentItemsRaw = raw.content_items;
  if (!Array.isArray(contentItemsRaw) || !contentItemsRaw.length) {
    errors.push("content_items: en az bir öğe içeren bir dizi olmalı.");
  } else if (contentItemsRaw.length > MAX_CONTENT_ITEMS) {
    errors.push(`content_items: en fazla ${MAX_CONTENT_ITEMS} öğe olabilir, ${contentItemsRaw.length} alındı.`);
  }

  const validatedItems: StrategyPackageContentItem[] = [];
  if (periodStart && periodEnd && Array.isArray(contentItemsRaw)) {
    contentItemsRaw.forEach((item, index) => {
      const validated = validateContentItem(item, index, periodStart, periodEnd, errors, warnings);
      if (validated) validatedItems.push(validated);
    });
  }

  if (errors.length) return { valid: false, errors, warnings };

  const pkg: StrategyPackage = { schema_version: raw.schema_version as string, generated_at: typeof raw.generated_at === "string" ? raw.generated_at : undefined, strategy: strategy as unknown as StrategyPackage["strategy"], content_items: validatedItems };

  const itemsByType: Record<string, number> = {};
  const itemsByFunnelStage: Record<string, number> = {};
  const resolvedDates: string[] = [];
  for (const item of validatedItems) {
    itemsByType[item.content_type] = (itemsByType[item.content_type] || 0) + 1;
    itemsByFunnelStage[item.funnel_stage] = (itemsByFunnelStage[item.funnel_stage] || 0) + 1;
    resolvedDates.push(item.content_date || addDaysIso(periodStart, item.day_offset || 0));
  }
  resolvedDates.sort();

  const preview: StrategyPackagePreview = {
    periodStart, periodEnd, monthlyObjective: pkg.strategy.monthly_objective,
    contentPillars: pkg.strategy.content_pillars.map((p) => p.name),
    itemCount: validatedItems.length, itemsByType, itemsByFunnelStage,
    firstContentDate: resolvedDates[0] || null, lastContentDate: resolvedDates[resolvedDates.length - 1] || null
  };

  return { valid: true, package: pkg, warnings, preview };
}

function buildCreativeBriefFromPackageItem(item: StrategyPackageContentItem): CreativeBrief {
  if (item.content_type === "reel") {
    return {
      script: item.script, on_screen_text: item.on_screen_text, estimated_duration_seconds: item.estimated_duration_seconds,
      scenes: item.scenes, visual_prompt: item.visual_direction
    };
  }
  if (item.content_type === "carousel") {
    return { slides: item.carousel_slides, visual_prompt: item.visual_direction };
  }
  return { visual_prompt: item.visual_direction };
}

export type ApplyStrategyPackageResult = { strategyId: string; itemsInserted: number };

/** DB-touching half — deliberately separate from validateStrategyPackage so
 * the pure validator stays trivially testable. Always re-validates its
 * input (never trust a caller skipped that step) before writing anything. */
export async function applyStrategyPackage(raw: unknown, importedBy: string | null): Promise<ApplyStrategyPackageResult> {
  const result = validateStrategyPackage(raw);
  if (!result.valid) throw new Error(`Geçersiz paket: ${result.errors.join(" | ")}`);
  const { package: pkg } = result;

  const activeRows = await supabaseRest<Array<{ id: string }>>(`social_strategies?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&status=eq.active&select=id`);
  for (const row of activeRows) {
    await supabaseRest(`social_strategies?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
  }

  const strategyRows = await supabaseRest<SocialStrategy[]>("social_strategies", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: SOCIAL_WORKSPACE_ID, period_start: pkg.strategy.period_start, period_end: pkg.strategy.period_end, status: "active",
      monthly_objective: pkg.strategy.monthly_objective, target_audience: pkg.strategy.target_audience,
      funnel_distribution: pkg.strategy.funnel_distribution || {}, content_pillars: pkg.strategy.content_pillars,
      platform_objectives: {}, posting_frequency: pkg.strategy.posting_frequency ?? 5,
      reel_ratio: pkg.strategy.reel_ratio ?? 0.3, carousel_ratio: pkg.strategy.carousel_ratio ?? 0.5, static_ratio: pkg.strategy.static_ratio ?? 0.2,
      story_strategy: pkg.strategy.story_strategy || "", follower_strategy: pkg.strategy.follower_strategy || "",
      authority_strategy: pkg.strategy.authority_strategy || "", lead_strategy: pkg.strategy.lead_strategy || "",
      conversion_strategy: pkg.strategy.conversion_strategy || "", community_strategy: pkg.strategy.community_strategy || "",
      testing_hypotheses: pkg.strategy.testing_hypotheses || [], kpi_targets: pkg.strategy.kpi_targets || {},
      creative_themes: pkg.strategy.creative_themes || [], based_on_learnings: [],
      ai_provider: null, ai_model: null, prompt_version: null, generated_by: "manual"
    })
  });
  const strategy = strategyRows[0];

  let itemsInserted = 0;
  for (const item of pkg.content_items) {
    const contentDate = item.content_date || addDaysIso(pkg.strategy.period_start, item.day_offset || 0);
    await supabaseRest("social_content_items", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: SOCIAL_WORKSPACE_ID, strategy_id: strategy.id, content_date: contentDate, platform: "instagram",
        content_type: item.content_type, funnel_stage: item.funnel_stage, content_pillar: item.content_pillar,
        objective: item.objective || `${item.funnel_stage} / ${item.target_kpi || "genel"}`, target_persona: item.target_persona || pkg.strategy.target_audience,
        topic: item.topic, title: item.title, hook: item.hook, hook_archetype: item.hook_archetype || "direct_insight", secondary_hook: item.secondary_hook || "",
        caption: item.caption, cta: item.cta, cta_goal: item.cta_goal || "save",
        hashtags: item.hashtags || [], seo_keywords: item.keywords || [],
        creative_brief: buildCreativeBriefFromPackageItem(item), media_mode: "manual", media_generation_status: "pending",
        source: "imported", primary_kpi: item.target_kpi || item.cta_goal || "save",
        generation_status: "generated", publication_status: "generated", ai_provider: null, ai_model: null, prompt_version: null
      })
    });
    itemsInserted += 1;
  }

  await supabaseRest("social_strategy_packages", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: SOCIAL_WORKSPACE_ID, imported_by: importedBy, strategy_id: strategy.id, period_start: pkg.strategy.period_start, period_end: pkg.strategy.period_end,
      item_count: itemsInserted, schema_version: pkg.schema_version, package_json: pkg
    })
  });

  return { strategyId: strategy.id, itemsInserted };
}
