import { supabaseRest } from "@/lib/supabase";
import { runQualityGate } from "../quality-gate";
import { loadPrivacyWatchlist, scanForPrivacyLeaks } from "../privacy-filter";
import { runMediaAndPersist } from "../content-generator";
import { validateStrategyPackage } from "../strategy-package";
import { validateContentShape } from "./import-validation";
import { ControlError } from "./protocol";
import { SOCIAL_WORKSPACE_ID } from "../types";
import type { SocialAutopilotSettings, SocialBrandProfile, SocialContentItem, ClicheEntry, SocialStrategy } from "../types";

export async function getItem(id: string) {
  const item = (await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))[0];
  if (!item) throw new ControlError("NOT_FOUND", "Content not found.", 404);
  return item;
}

export async function getSettings() {
  const row = (await supabaseRest<SocialAutopilotSettings[]>(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`))[0];
  if (!row) throw new ControlError("NOT_CONFIGURED", "Application settings not found.", 503);
  return row;
}

export function editable(item: SocialContentItem) {
  if (["scheduled", "preparing", "publishing", "published"].includes(item.publication_status)) throw new ControlError("CONTENT_LOCKED", "Cancel scheduling before editing; publishing and published content cannot be edited.", 409);
}

export async function validateContent(id: string) {
  const item = await getItem(id);
  editable(item);
  const [brands, blacklist, watchlist, recentItems, settings] = await Promise.all([
    supabaseRest<SocialBrandProfile[]>(`social_brand_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`),
    supabaseRest<ClicheEntry[]>(`social_cliche_blacklist?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&active=eq.true&select=*`),
    loadPrivacyWatchlist(),
    supabaseRest<SocialContentItem[]>(`social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&id=neq.${encodeURIComponent(id)}&select=hook,caption,creative_brief,cta&order=content_date.desc&limit=6`),
    getSettings()
  ]);
  if (!brands[0]) throw new ControlError("NOT_CONFIGURED", "Brand profile required.", 503);
  const result = await runQualityGate({ item, brand: brands[0], blacklist, watchlist, recentItems, attempt: 1, allowRuntimeAi: false });
  const mediaReady = item.media_generation_status === "generated" && item.media_asset_urls.length > 0 && (item.media_quality_score ?? 0) >= settings.min_media_quality_score;
  const passed = result.passed && result.overall_score >= settings.min_quality_score;
  await supabaseRest("social_quality_checks", { method: "POST", body: JSON.stringify({ content_item_id: id, overall_score: result.overall_score, checks: result.checks, passed: result.passed, attempt: 1 }) });
  await supabaseRest(`social_content_items?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ quality_score: result.overall_score, privacy_check_passed: result.checks.privacy?.passed === true, publication_status: passed && mediaReady ? "ready" : passed ? "needs_media" : "needs_review" })
  });
  return { ...result, mediaReady, ready: passed && mediaReady };
}

export async function renderContent(id: string) {
  const item = await getItem(id);
  editable(item);
  if (item.content_type === "reel") return { status: "NEEDS_MEDIA", creative_brief: item.creative_brief };
  const brand = (await supabaseRest<SocialBrandProfile[]>(`social_brand_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`))[0];
  if (!brand) throw new ControlError("NOT_CONFIGURED", "Brand profile required.", 503);
  const rendered = await runMediaAndPersist({ ...item, media_mode: "auto" }, brand.brand_name);
  return { item: rendered, validation: await validateContent(id) };
}

export async function prepareContent(raw: unknown, type: "carousel" | "static" | "reel") {
  const strategy = (await supabaseRest<SocialStrategy[]>(`social_strategies?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&status=eq.active&select=*&limit=1`))[0];
  if (!strategy) throw new ControlError("STRATEGY_REQUIRED", "Import an active strategy first.", 409);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ControlError("INVALID_CONTENT", "Content must be an object.");
  const item = validateContentShape(raw);
  if (scanForPrivacyLeaks(JSON.stringify(item), await loadPrivacyWatchlist()).length) throw new ControlError("PRIVACY_BLOCKED", "Content contains protected private information.");
  if (item.content_type !== type) throw new ControlError("INVALID_CONTENT", "Content type must match tool.");
  const validated = validateStrategyPackage({ schema_version: "1.0", strategy, content_items: [item] });
  if (!validated.valid) throw new ControlError("INVALID_CONTENT", "Complete content matching the strategy package contract is required.");
  const c = validated.package.content_items[0];
  const day = c.content_date || new Date(Date.parse(strategy.period_start) + (c.day_offset || 0) * 86400000).toISOString().slice(0, 10);
  const rows = await supabaseRest<SocialContentItem[]>("social_content_items", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: SOCIAL_WORKSPACE_ID, strategy_id: strategy.id, content_date: day, platform: "instagram", content_type: type, funnel_stage: c.funnel_stage,
      content_pillar: c.content_pillar, objective: c.objective || c.target_kpi || c.cta_goal || "save", target_persona: c.target_persona || strategy.target_audience,
      topic: c.topic, title: c.title, hook: c.hook, hook_archetype: c.hook_archetype || "direct_insight", caption: c.caption, cta: c.cta, cta_goal: c.cta_goal || "save",
      hashtags: c.hashtags || [], seo_keywords: c.keywords || [], creative_brief: { slides: c.carousel_slides, script: c.script, scenes: c.scenes, on_screen_text: c.on_screen_text, visual_prompt: c.visual_direction },
      source: "manual", media_mode: "auto", media_generation_status: type === "reel" ? "awaiting_manual_upload" : "pending", generation_status: "generated", publication_status: type === "reel" ? "needs_media" : "generated"
    })
  });
  return { item: rows[0], status: type === "reel" ? "NEEDS_MEDIA" : "PREPARED" };
}
