// Static Instagram post rendering — reuses the exact same engine (fonts,
// theme, typography, templates) as the carousel renderer, for a single
// final image.
import { createCanvas } from "@napi-rs/canvas";
import { ensureFontsRegistered } from "./fonts.ts";
import { getResolvedTheme } from "./theme.ts";
import { paintBackground, drawBrandMark, CAROUSEL_WIDTH, CAROUSEL_HEIGHT, SAFE_MARGIN } from "./canvas-utils.ts";
import { CAROUSEL_TEMPLATES, type TemplateKey } from "./templates.ts";

export type StaticRenderResult = { buffer: Buffer; width: number; height: number; overflow: boolean; usedFallbackShortening: boolean; templateApplied: TemplateKey };

export async function renderStatic(params: { headline: string; body: string; cta: string; templateKey: TemplateKey; brandName: string }): Promise<StaticRenderResult> {
  const fontStatus = ensureFontsRegistered();
  if (!fontStatus.ok) throw new Error(`Render motoru fontları yüklenemedi: ${fontStatus.error}`);

  const theme = await getResolvedTheme();
  const canvas = createCanvas(CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
  const ctx = canvas.getContext("2d");
  paintBackground(ctx, theme, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);

  const contentX = SAFE_MARGIN;
  const contentY = SAFE_MARGIN + 70;
  const contentWidth = CAROUSEL_WIDTH - SAFE_MARGIN * 2;
  const contentHeight = CAROUSEL_HEIGHT - contentY - SAFE_MARGIN - 40;

  const result = CAROUSEL_TEMPLATES[params.templateKey].render(
    { ctx, theme, headingFontFamily: theme.headingFontFamily, bodyFontFamily: theme.bodyFontFamily, x: contentX, y: contentY, width: contentWidth, height: contentHeight },
    { headline: params.headline, body: params.body, index: 0, total: 1, cta: params.templateKey === "cta_closing" ? params.cta : undefined }
  );

  await drawBrandMark(ctx, theme, params.brandName, CAROUSEL_WIDTH, CAROUSEL_HEIGHT, theme.bodyFontFamily);

  // JPEG, not PNG — Instagram's content-publishing API only accepts JPEG
  // for image_url. Quality is an integer 0-100 scale here, not 0-1 — see
  // carousel-renderer.ts's renderCarousel for why this matters.
  const buffer = await canvas.encode("jpeg", 92);
  return { buffer, width: CAROUSEL_WIDTH, height: CAROUSEL_HEIGHT, overflow: result.overflow, usedFallbackShortening: result.usedFallbackShortening, templateApplied: params.templateKey };
}
