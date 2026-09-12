// The FIRST real, working AUTO MEDIA provider: zero external API, zero
// per-generation cost, deterministic — the carousel/static compositor
// itself. Implements the existing MediaProvider interface so it plugs into
// registry.ts/pipeline.ts without any pipeline changes, and additionally
// satisfies MediaRenderer (a narrower "is my own machinery ready" surface)
// for the readiness engine.
import { uploadSocialMediaBuffer } from "../../storage";
import { ensureFontsRegistered } from "../render/fonts.ts";
import { renderCarousel, type RenderedSlide } from "../render/carousel-renderer.ts";
import { renderStatic } from "../render/static-renderer.ts";
import { runMediaQualityGate } from "../quality-gate.ts";
import type { MediaGenerationRequest, MediaGenerationResult, MediaProvider, MediaRenderer } from "../types";
import type { TemplateKey } from "../render/templates";
import { selectCarouselTemplate } from "../render/template-selector.ts";
import { fetchRecentCarouselTemplates } from "../render/template-history.ts";

export class MediaQualityRejectedError extends Error {
  constructor(reason: string) { super(reason); this.name = "MediaQualityRejectedError"; }
}

// HK Visual System V1: statics used to render with only 2 of the 12
// template families (cta_closing for conversion, educational_breakdown for
// everything else), and their "headline" was the entire caption (a
// 200+ char paragraph crammed into a headline-sized box) because the
// short, punchy `title`/`hook` fields were never even passed to the
// renderer. This picks a template from real content signals already on the
// item — never from creative_brief, which stays unable to override brand
// colors/fonts/spacing — and always uses the short title/hook as the
// on-image headline, with the hook demoted to a lower-weight subhead
// instead of duplicating the full caption on the image.
const STAT_PATTERN = /(%|x\b|×|\+|\b\d{2,}\b)/i;

function selectStaticPresentation(request: MediaGenerationRequest): { templateKey: TemplateKey; headline: string; subhead: string } {
  const title = (request.title || "").trim();
  const hook = (request.hook || "").trim();
  const fallback = firstSentence(request.caption) || request.brandName;

  if (request.funnelStage === "conversion") {
    return { templateKey: "cta_closing", headline: title || fallback, subhead: hook };
  }
  if (/\?\s*$/.test(title)) return { templateKey: "question_prompt", headline: title, subhead: hook };
  if (/\?\s*$/.test(hook)) return { templateKey: "question_prompt", headline: hook, subhead: "" };
  if (/\d/.test(title) && STAT_PATTERN.test(title)) return { templateKey: "data_insight", headline: title, subhead: hook };
  if (/\d/.test(hook) && STAT_PATTERN.test(hook)) return { templateKey: "data_insight", headline: hook, subhead: "" };
  return { templateKey: "bold_hook", headline: title || fallback, subhead: title ? hook : "" };
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]{1,140}[.!?]/);
  return (match ? match[0] : text).slice(0, 140).trim();
}

async function uploadSlides(slides: RenderedSlide[], contentItemId: string) {
  const urls: string[] = [];
  const metadata: Array<{ width: number; height: number; sizeBytes: number; slideIndex: number }> = [];
  for (let i = 0; i < slides.length; i += 1) {
    const url = await uploadSocialMediaBuffer(slides[i].buffer, "image/jpeg", "jpg", `generated/${contentItemId}`);
    urls.push(url);
    metadata.push({ width: slides[i].width, height: slides[i].height, sizeBytes: slides[i].buffer.length, slideIndex: i });
  }
  return { urls, metadata };
}

export const deterministicRendererProvider: MediaProvider & MediaRenderer = {
  key: "deterministic-renderer",
  label: "Programatik Görsel Motoru (carousel/static)",
  supportedContentTypes: ["carousel", "static"],

  isConfigured() {
    return this.isReady().ok;
  },

  isReady() {
    return ensureFontsRegistered();
  },

  async generate(request: MediaGenerationRequest): Promise<MediaGenerationResult> {
    const fontStatus = ensureFontsRegistered();
    if (!fontStatus.ok) throw new Error(`Render motoru hazır değil: ${fontStatus.error}`);

    if (request.contentType === "carousel") {
      const slides = request.creativeBrief.slides;
      if (!slides?.length) throw new Error("Carousel için 'slides' verisi eksik — içerik üretimi tamamlanmamış.");

      const recent = await fetchRecentCarouselTemplates();
      const templateKey = (request.preselectedTemplate as TemplateKey) || selectCarouselTemplate(request.funnelStage, recent);
      const rendered = await renderCarousel({
        slides: slides.map((slide) => ({ index: slide.index, headline: slide.headline, body: slide.body })),
        templateKey, cta: request.cta, brandName: request.brandName
      });

      const quality = runMediaQualityGate({ slides: rendered.slides, expectedSlideCount: slides.length, templateUsed: templateKey, recentTemplatesUsed: recent });
      if (!quality.passed) {
        throw new MediaQualityRejectedError(`Medya kalite kontrolünden geçemedi (${quality.overallScore}/100): ${Object.values(quality.checks).filter((check) => !check.passed).map((check) => check.detail).join(" | ")}`);
      }

      const { urls, metadata } = await uploadSlides(rendered.slides, request.contentItemId);
      return {
        provider: this.key, assetUrls: urls, templateUsed: templateKey,
        mediaQualityScore: quality.overallScore, mediaQualityScores: quality.scores as unknown as Record<string, number>, assetMetadata: metadata
      };
    }

    if (request.contentType === "static") {
      const { templateKey, headline, subhead } = selectStaticPresentation(request);
      const rendered = await renderStatic({ headline, body: subhead, cta: request.cta, templateKey, brandName: request.brandName });

      // Static posts are independent single images — the carousel
      // anti-repetition history doesn't apply the same way here.
      const quality = runMediaQualityGate({ slides: [rendered], expectedSlideCount: 1, templateUsed: templateKey, recentTemplatesUsed: [] });
      if (!quality.passed) {
        throw new MediaQualityRejectedError(`Medya kalite kontrolünden geçemedi (${quality.overallScore}/100): ${Object.values(quality.checks).filter((check) => !check.passed).map((check) => check.detail).join(" | ")}`);
      }

      const { urls, metadata } = await uploadSlides([rendered], request.contentItemId);
      return {
        provider: this.key, assetUrls: urls, templateUsed: templateKey,
        mediaQualityScore: quality.overallScore, mediaQualityScores: quality.scores as unknown as Record<string, number>, assetMetadata: metadata
      };
    }

    // Reel/story: this provider honestly does not support them — the
    // pipeline treats this exactly like "no provider configured for this
    // content type" (see registry.ts's supportedContentTypes filtering),
    // which is what routes Reels to needs_media/manual instead of a fake
    // success.
    throw new Error(`Programatik render motoru "${request.contentType}" formatını desteklemiyor.`);
  }
};
