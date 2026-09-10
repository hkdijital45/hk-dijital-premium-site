// The deterministic carousel compositor: takes AI-produced structured copy
// (topic/headline/body per slide) and a chosen template, and
// programmatically renders the FINAL publishable JPEG files — real
// typography, real layout, real branding. No image-generation model is
// ever asked to render text.
import { createCanvas } from "@napi-rs/canvas";
import { ensureFontsRegistered } from "./fonts.ts";
import { getResolvedTheme } from "./theme.ts";
import { paintBackground, drawPageIndicator, drawSlideNumber, drawBrandMark, CAROUSEL_WIDTH, CAROUSEL_HEIGHT, SAFE_MARGIN } from "./canvas-utils.ts";
import { CAROUSEL_TEMPLATES, type TemplateKey, type TemplateSlideInput } from "./templates.ts";

export type CarouselSlideContent = { index: number; headline: string; body: string };
export type RenderedSlide = { buffer: Buffer; width: number; height: number; overflow: boolean; usedFallbackShortening: boolean; templateApplied: TemplateKey };
export type CarouselRenderResult = { slides: RenderedSlide[]; templateUsed: TemplateKey; anyOverflow: boolean };

/** Slide 1 always renders with the bold_hook bookend and the last slide
 * always renders with cta_closing — the selected body template governs
 * everything in between. */
function templateForSlide(index: number, total: number, bodyTemplate: TemplateKey): TemplateKey {
  if (index === 0) return "bold_hook";
  if (index === total - 1) return "cta_closing";
  return bodyTemplate;
}

export async function renderCarousel(params: { slides: CarouselSlideContent[]; templateKey: TemplateKey; cta: string; brandName: string }): Promise<CarouselRenderResult> {
  const fontStatus = ensureFontsRegistered();
  if (!fontStatus.ok) throw new Error(`Render motoru fontları yüklenemedi: ${fontStatus.error}`);

  const theme = await getResolvedTheme();
  const rendered: RenderedSlide[] = [];
  let anyOverflow = false;

  for (let i = 0; i < params.slides.length; i += 1) {
    const slideContent = params.slides[i];
    const appliedTemplate = templateForSlide(i, params.slides.length, params.templateKey);

    const canvas = createCanvas(CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
    const ctx = canvas.getContext("2d");

    paintBackground(ctx, theme, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);

    const contentX = SAFE_MARGIN;
    const contentY = SAFE_MARGIN + 70; // leaves room for the brand mark row
    const contentWidth = CAROUSEL_WIDTH - SAFE_MARGIN * 2;
    const contentHeight = CAROUSEL_HEIGHT - contentY - SAFE_MARGIN - 40; // leaves room for page indicator row

    const slideInput: TemplateSlideInput = {
      headline: slideContent.headline, body: slideContent.body, index: i, total: params.slides.length,
      cta: appliedTemplate === "cta_closing" ? params.cta : undefined
    };

    const result = CAROUSEL_TEMPLATES[appliedTemplate].render(
      { ctx, theme, headingFontFamily: theme.headingFontFamily, bodyFontFamily: theme.bodyFontFamily, x: contentX, y: contentY, width: contentWidth, height: contentHeight },
      slideInput
    );
    if (result.overflow) anyOverflow = true;

    await drawBrandMark(ctx, theme, params.brandName, CAROUSEL_WIDTH, CAROUSEL_HEIGHT, theme.bodyFontFamily);
    drawSlideNumber(ctx, theme, i, params.slides.length, CAROUSEL_WIDTH, theme.bodyFontFamily);
    if (params.slides.length > 1) drawPageIndicator(ctx, theme, i, params.slides.length, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);

    // JPEG, not PNG: Instagram's content-publishing API only accepts JPEG
    // for image_url. High quality (0.92) keeps text edges sharp at this
    // resolution while staying well under the 8MB limit.
    const buffer = await canvas.encode("jpeg", 0.92);
    rendered.push({ buffer, width: CAROUSEL_WIDTH, height: CAROUSEL_HEIGHT, overflow: result.overflow, usedFallbackShortening: result.usedFallbackShortening, templateApplied: appliedTemplate });
  }

  return { slides: rendered, templateUsed: params.templateKey, anyOverflow };
}
