// The three explicit media workflows:
//   - "manual": always waits for a human upload. Normal, not a failure.
//   - "auto": a real generation attempt is required. On failure, the item
//     is flagged needs_media — it never silently becomes "manual" and
//     never fabricates a result.
//   - "auto_with_fallback": attempts automatic generation first; on failure
//     it gracefully degrades to manual (mode rewritten, reason recorded)
//     instead of blocking the item.
// Wired into the content pipeline right after a content item's creative
// brief is generated (see content-generator.ts).
import { isAutoMediaAvailableFor, resolveMediaProviderFor } from "./registry.ts";
import type { SocialContentItem, MediaMode } from "../types";
import type { MediaGenerationResult } from "./types";

/** Resolves the actual mode a new content item should use — respects the
 * configured default, but always degrades "auto"/"auto_with_fallback" to
 * "manual" up front if NOTHING can produce this exact content type yet
 * (fail fast rather than wasting a render attempt). Strict "auto" stays
 * "auto" even when unavailable — see runMediaStage, which is what actually
 * turns that into a needs_media flag rather than silently downgrading. */
export function determineMediaMode(configuredDefault: MediaMode, contentType: SocialContentItem["content_type"]): MediaMode {
  if (configuredDefault === "manual") return "manual";
  if (isAutoMediaAvailableFor(contentType)) return configuredDefault;
  return configuredDefault === "auto_with_fallback" ? "manual" : configuredDefault;
}

export type MediaStagePatch = Pick<SocialContentItem,
  | "media_mode" | "media_generation_status" | "media_generation_provider" | "media_generation_error"
  | "media_asset_urls" | "media_template_used"
  | "visual_quality_score" | "brand_consistency_score" | "readability_score"
  | "composition_score" | "content_visual_match_score" | "platform_compatibility_score" | "media_quality_score"
>;

export type MediaStageOutcome = {
  patch: MediaStagePatch;
  /** Set only when strict "auto" mode failed — the caller must move the
   * content item's publication_status to "needs_media" rather than
   * whatever it would otherwise become. */
  needsMedia: boolean;
  assetMetadata?: Array<{ width: number; height: number; sizeBytes: number; slideIndex: number }>;
};

function manualPatch(error: string | null = null): MediaStagePatch {
  return {
    media_mode: "manual", media_generation_status: "awaiting_manual_upload", media_generation_provider: null,
    media_generation_error: error, media_asset_urls: [], media_template_used: null,
    visual_quality_score: null, brand_consistency_score: null, readability_score: null,
    composition_score: null, content_visual_match_score: null, platform_compatibility_score: null, media_quality_score: null
  };
}

export async function runMediaStage(item: Pick<SocialContentItem, "id" | "content_type" | "creative_brief" | "caption" | "media_mode" | "cta" | "funnel_stage" | "content_pillar">, brandName: string, preselectedTemplate?: string): Promise<MediaStageOutcome> {
  if (item.media_mode === "manual") {
    return { patch: manualPatch(), needsMedia: false };
  }

  const provider = resolveMediaProviderFor(item.content_type);
  if (provider.key === "none") {
    if (item.media_mode === "auto_with_fallback") {
      return { patch: manualPatch("Bu format için AUTO MEDIA sağlayıcısı yapılandırılmadı — MANUAL MEDIA akışına düşüldü."), needsMedia: false };
    }
    return {
      patch: { ...manualPatch(), media_mode: "auto", media_generation_status: "failed", media_generation_error: `Bu format ("${item.content_type}") için hiçbir AUTO MEDIA sağlayıcısı yapılandırılmadı.` },
      needsMedia: true
    };
  }

  try {
    const result: MediaGenerationResult = await provider.generate({
      contentItemId: item.id, contentType: item.content_type, creativeBrief: item.creative_brief, caption: item.caption,
      cta: item.cta, funnelStage: item.funnel_stage, contentPillar: item.content_pillar, brandName, preselectedTemplate
    });
    if (!result.assetUrls.length) throw new Error("Sağlayıcı hiçbir medya dosyası döndürmedi.");

    const scores = result.mediaQualityScores || {};
    return {
      needsMedia: false,
      assetMetadata: result.assetMetadata,
      patch: {
        media_mode: item.media_mode, media_generation_status: "generated", media_generation_provider: result.provider,
        media_generation_error: null, media_asset_urls: result.assetUrls, media_template_used: result.templateUsed || null,
        visual_quality_score: scores.visual_quality ?? null, brand_consistency_score: scores.brand_consistency ?? null,
        readability_score: scores.readability ?? null, composition_score: scores.composition ?? null,
        content_visual_match_score: scores.content_visual_match ?? null, platform_compatibility_score: scores.platform_compatibility ?? null,
        media_quality_score: result.mediaQualityScore ?? null
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Medya üretimi başarısız oldu.";
    if (item.media_mode === "auto_with_fallback") {
      return { patch: manualPatch(`${provider.label}: ${message} — MANUAL MEDIA akışına düşüldü.`), needsMedia: false };
    }
    return {
      patch: { ...manualPatch(message), media_mode: "auto", media_generation_status: "failed" },
      needsMedia: true
    };
  }
}
