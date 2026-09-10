// Professional, reusable carousel layouts. Each template is a pure layout
// function operating inside the shared safe-content rectangle
// carousel-renderer.ts computes (background, brand mark, page indicator and
// slide number are drawn once by the caller, identically for every
// template). Templates interpret `slide.body` as either one paragraph or
// newline-separated list items, depending on what the template needs —
// content-generator.ts tells the AI which shape to write for the template
// already chosen for that slide (see selectCarouselTemplate in
// template-selector.ts).
import type { SKRSContext2D } from "@napi-rs/canvas";
import type { ResolvedTheme } from "./theme";
import { fitText, drawTextLines, shortenToFit, type FitTextResult } from "./typography.ts";
import { roundRect, drawAccentBar } from "./canvas-utils.ts";

export const TEMPLATE_KEYS = [
  "bold_hook", "educational_breakdown", "mistakes", "checklist", "step_by_step",
  "comparison", "myth_vs_reality", "framework", "data_insight", "tactical_guide",
  "problem_solution", "cta_closing"
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  bold_hook: "Bold Hook", educational_breakdown: "Educational Breakdown", mistakes: "Mistakes",
  checklist: "Checklist", step_by_step: "Step-by-Step", comparison: "Comparison",
  myth_vs_reality: "Myth vs Reality", framework: "Framework", data_insight: "Data / Insight",
  tactical_guide: "Tactical Guide", problem_solution: "Problem → Solution", cta_closing: "CTA / Closing"
};

export type TemplateSlideInput = { headline: string; body: string; index: number; total: number; cta?: string };
export type TemplateRenderContext = {
  ctx: SKRSContext2D;
  theme: ResolvedTheme;
  headingFontFamily: string;
  bodyFontFamily: string;
  x: number; y: number; width: number; height: number;
};
export type TemplateRenderResult = { overflow: boolean; usedFallbackShortening: boolean };

function listItemsFrom(body: string): string[] {
  const items = body.split(/\n+/).map((line) => line.replace(/^[-•\d.\s]+/, "").trim()).filter(Boolean);
  return items.length > 1 ? items : [body.trim()];
}

function fitWithShortenRetry(ctx: SKRSContext2D, text: string, opts: Parameters<typeof fitText>[2]): { result: FitTextResult; usedFallbackShortening: boolean } {
  const result = fitText(ctx, text, opts);
  if (!result.overflow) return { result, usedFallbackShortening: false };
  const shortened = shortenToFit(text, Math.max(20, Math.floor(text.length * 0.7)));
  const retry = fitText(ctx, shortened, opts);
  return retry.overflow ? { result, usedFallbackShortening: false } : { result: retry, usedFallbackShortening: true };
}

function drawHeadline(context: TemplateRenderContext, headline: string, boxHeight: number, align: "left" | "center" = "left", maxFontSize = 74) {
  const { ctx, theme, headingFontFamily, x, y, width } = context;
  ctx.fillStyle = theme.color_foreground;
  const { result, usedFallbackShortening } = fitWithShortenRetry(ctx, headline, {
    maxWidth: width, maxHeight: boxHeight, fontFamily: headingFontFamily, maxFontSize, minFontSize: 40, maxLines: 5, lineHeightMultiplier: 1.08
  });
  drawTextLines(ctx, result, x, y, headingFontFamily, align, width);
  return { result, usedFallbackShortening };
}

function drawBody(context: TemplateRenderContext, body: string, boxY: number, boxHeight: number, align: "left" | "center" = "left") {
  const { ctx, theme, bodyFontFamily, x, width } = context;
  ctx.fillStyle = theme.color_muted;
  const { result, usedFallbackShortening } = fitWithShortenRetry(ctx, body, {
    maxWidth: width, maxHeight: boxHeight, fontFamily: bodyFontFamily, maxFontSize: 40, minFontSize: 26, maxLines: 10, lineHeightMultiplier: 1.35
  });
  drawTextLines(ctx, result, x, boxY, bodyFontFamily, align, width);
  return { result, usedFallbackShortening };
}

function drawBadge(ctx: SKRSContext2D, theme: ResolvedTheme, cx: number, cy: number, radius: number, label: string, fontFamily: string) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  const gradient = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  gradient.addColorStop(0, theme.color_primary);
  gradient.addColorStop(1, theme.color_accent);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.font = `800 ${Math.round(radius * 1.05)}px ${fontFamily}`;
  ctx.fillStyle = "#0B0D12";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + radius * 0.05);
}

function drawCheckMark(ctx: SKRSContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.22;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.5, cy);
  ctx.lineTo(cx - size * 0.12, cy + size * 0.4);
  ctx.lineTo(cx + size * 0.55, cy - size * 0.45);
  ctx.stroke();
}

function drawCrossMark(ctx: SKRSContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.45, cy - size * 0.45);
  ctx.lineTo(cx + size * 0.45, cy + size * 0.45);
  ctx.moveTo(cx + size * 0.45, cy - size * 0.45);
  ctx.lineTo(cx - size * 0.45, cy + size * 0.45);
  ctx.stroke();
}

/** Renders a vertical list where each row gets a marker (check/cross/number)
 * drawn as a real vector shape — not an emoji glyph, which fonts render
 * inconsistently — plus wrapped text. Shared by mistakes/checklist/
 * step_by_step/tactical_guide; returns whether everything fit. */
function drawMarkerList(context: TemplateRenderContext, items: string[], boxY: number, boxHeight: number, marker: "check" | "cross" | "number") {
  const { ctx, theme, bodyFontFamily, x, width } = context;
  const rowGap = 18;
  const markerSize = 44;
  const textX = x + markerSize + 28;
  const textWidth = width - markerSize - 28;
  let cursorY = boxY;
  let overflow = false;

  for (let i = 0; i < items.length; i += 1) {
    const remainingHeight = boxHeight - (cursorY - boxY);
    if (remainingHeight < 60) { overflow = i < items.length; break; }
    const fit = fitText(ctx, items[i], { maxWidth: textWidth, maxHeight: remainingHeight, fontFamily: bodyFontFamily, maxFontSize: 34, minFontSize: 24, maxLines: 3, lineHeightMultiplier: 1.3 });
    if (fit.overflow) overflow = true;

    const markerCy = cursorY + fit.lineHeight * 0.55;
    if (marker === "check") drawCheckMark(ctx, x + markerSize / 2, markerCy, markerSize * 0.8, theme.color_accent);
    else if (marker === "cross") drawCrossMark(ctx, x + markerSize / 2, markerCy, markerSize * 0.8, "#EF4444");
    else drawBadge(ctx, theme, x + markerSize / 2, markerCy, markerSize / 2, String(i + 1), bodyFontFamily);

    ctx.fillStyle = theme.color_foreground;
    drawTextLines(ctx, fit, textX, cursorY, bodyFontFamily, "left", textWidth);
    cursorY += fit.totalHeight + rowGap;
  }
  return { overflow };
}

function template(key: TemplateKey, render: (context: TemplateRenderContext, slide: TemplateSlideInput) => TemplateRenderResult) {
  return { key, render };
}

export const CAROUSEL_TEMPLATES: Record<TemplateKey, { key: TemplateKey; render: (context: TemplateRenderContext, slide: TemplateSlideInput) => TemplateRenderResult }> = {
  bold_hook: template("bold_hook", (context, slide) => {
    const { result, usedFallbackShortening } = drawHeadline(context, slide.headline, context.height * 0.7, "left", 88);
    if (slide.body) drawBody(context, slide.body, context.y + result.totalHeight + 40, context.height - result.totalHeight - 40);
    return { overflow: result.overflow, usedFallbackShortening };
  }),

  educational_breakdown: template("educational_breakdown", (context, slide) => {
    const headlineHeight = context.height * 0.28;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", 60);
    const bodyResult = drawBody(context, slide.body, context.y + headlineHeight + 24, context.height - headlineHeight - 24);
    return { overflow: h.overflow || bodyResult.result.overflow, usedFallbackShortening: usedFallbackShortening || bodyResult.usedFallbackShortening };
  }),

  mistakes: template("mistakes", (context, slide) => {
    const headlineHeight = context.height * 0.22;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", 54);
    const list = drawMarkerList(context, listItemsFrom(slide.body), context.y + headlineHeight + 20, context.height - headlineHeight - 20, "cross");
    return { overflow: h.overflow || list.overflow, usedFallbackShortening };
  }),

  checklist: template("checklist", (context, slide) => {
    const headlineHeight = context.height * 0.22;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", 54);
    const list = drawMarkerList(context, listItemsFrom(slide.body), context.y + headlineHeight + 20, context.height - headlineHeight - 20, "check");
    return { overflow: h.overflow || list.overflow, usedFallbackShortening };
  }),

  step_by_step: template("step_by_step", (context, slide) => {
    const headlineHeight = context.height * 0.2;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", 52);
    const list = drawMarkerList(context, listItemsFrom(slide.body), context.y + headlineHeight + 20, context.height - headlineHeight - 20, "number");
    return { overflow: h.overflow || list.overflow, usedFallbackShortening };
  }),

  tactical_guide: template("tactical_guide", (context, slide) => {
    const headlineHeight = context.height * 0.2;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", 50);
    const list = drawMarkerList(context, listItemsFrom(slide.body), context.y + headlineHeight + 20, context.height - headlineHeight - 20, "check");
    return { overflow: h.overflow || list.overflow, usedFallbackShortening };
  }),

  comparison: template("comparison", (context, slide) => {
    const { ctx, theme, x, y, width, height, bodyFontFamily } = context;
    const [leftRaw, rightRaw] = slide.body.split(/\n{2,}|\|\|/);
    const columnGap = 40;
    const columnWidth = (width - columnGap) / 2;
    const headlineHeight = height * 0.2;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", 48);

    ctx.strokeStyle = theme.color_muted;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x + columnWidth + columnGap / 2, y + headlineHeight + 30);
    ctx.lineTo(x + columnWidth + columnGap / 2, y + height);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.font = `800 30px ${bodyFontFamily}`;
    ctx.fillStyle = "#EF4444";
    ctx.textAlign = "left";
    ctx.fillText("ESKİ", x, y + headlineHeight + 60);
    ctx.fillStyle = theme.color_accent;
    ctx.fillText("YENİ", x + columnWidth + columnGap, y + headlineHeight + 60);

    const leftFit = fitText(ctx, (leftRaw || "").trim(), { maxWidth: columnWidth, maxHeight: height - headlineHeight - 100, fontFamily: bodyFontFamily, maxFontSize: 32, minFontSize: 22, maxLines: 8, lineHeightMultiplier: 1.3 });
    ctx.fillStyle = theme.color_muted;
    drawTextLines(ctx, leftFit, x, y + headlineHeight + 90, bodyFontFamily, "left", columnWidth);

    const rightFit = fitText(ctx, (rightRaw || "").trim(), { maxWidth: columnWidth, maxHeight: height - headlineHeight - 100, fontFamily: bodyFontFamily, maxFontSize: 32, minFontSize: 22, maxLines: 8, lineHeightMultiplier: 1.3 });
    ctx.fillStyle = theme.color_foreground;
    drawTextLines(ctx, rightFit, x + columnWidth + columnGap, y + headlineHeight + 90, bodyFontFamily, "left", columnWidth);

    return { overflow: h.overflow || leftFit.overflow || rightFit.overflow, usedFallbackShortening };
  }),

  myth_vs_reality: template("myth_vs_reality", (context, slide) => {
    const { ctx, theme, x, y, width, height, bodyFontFamily } = context;
    const [mythRaw, realityRaw] = slide.body.split(/\n{2,}|\|\|/);
    const halfHeight = (height - 30) / 2;

    ctx.font = `800 30px ${bodyFontFamily}`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#EF4444";
    ctx.fillText("YANLIŞ İNANIŞ", x, y + 34);
    const mythFit = fitText(ctx, (mythRaw || slide.headline).trim(), { maxWidth: width, maxHeight: halfHeight - 50, fontFamily: bodyFontFamily, maxFontSize: 40, minFontSize: 26, maxLines: 5, lineHeightMultiplier: 1.3 });
    ctx.fillStyle = theme.color_muted;
    drawTextLines(ctx, mythFit, x, y + 50, bodyFontFamily, "left", width);

    const dividerY = y + halfHeight + 15;
    drawAccentBar(ctx, theme, x, dividerY, width, 6);

    ctx.font = `800 30px ${bodyFontFamily}`;
    ctx.fillStyle = theme.color_accent;
    ctx.fillText("GERÇEK", x, dividerY + 50);
    const realityFit = fitText(ctx, (realityRaw || "").trim(), { maxWidth: width, maxHeight: halfHeight - 50, fontFamily: bodyFontFamily, maxFontSize: 40, minFontSize: 26, maxLines: 5, lineHeightMultiplier: 1.3 });
    ctx.fillStyle = theme.color_foreground;
    drawTextLines(ctx, realityFit, x, dividerY + 66, bodyFontFamily, "left", width);

    return { overflow: mythFit.overflow || realityFit.overflow, usedFallbackShortening: false };
  }),

  framework: template("framework", (context, slide) => {
    const { ctx, theme, x, y, width, height, bodyFontFamily } = context;
    const headlineHeight = height * 0.2;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", 50);
    const steps = listItemsFrom(slide.body).slice(0, 5);
    const boxHeight = (height - headlineHeight - 20 - (steps.length - 1) * 20) / steps.length;
    let cursorY = y + headlineHeight + 20;
    let overflow = h.overflow;

    for (const step of steps) {
      roundRect(ctx, x, cursorY, width, boxHeight, theme.border_radius * 0.6);
      ctx.fillStyle = theme.color_surface;
      ctx.fill();
      const fit = fitText(ctx, step, { maxWidth: width - 48, maxHeight: boxHeight - 24, fontFamily: bodyFontFamily, maxFontSize: 30, minFontSize: 22, maxLines: 2, lineHeightMultiplier: 1.25 });
      if (fit.overflow) overflow = true;
      ctx.fillStyle = theme.color_foreground;
      drawTextLines(ctx, fit, x + 24, cursorY + (boxHeight - fit.totalHeight) / 2, bodyFontFamily, "left", width - 48);
      if (step !== steps[steps.length - 1]) {
        ctx.strokeStyle = theme.color_accent;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(x + width / 2, cursorY + boxHeight);
        ctx.lineTo(x + width / 2, cursorY + boxHeight + 20);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      cursorY += boxHeight + 20;
    }
    return { overflow, usedFallbackShortening };
  }),

  data_insight: template("data_insight", (context, slide) => {
    const { ctx, theme, headingFontFamily, bodyFontFamily, x, y, width, height } = context;
    const statMatch = slide.headline.match(/[\d.,%xX+]+/);
    const stat = statMatch ? statMatch[0] : slide.headline.slice(0, 6);
    const label = slide.headline.replace(stat, "").trim() || slide.headline;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const statFit = fitText(ctx, stat, { maxWidth: width, maxHeight: height * 0.45, fontFamily: headingFontFamily, maxFontSize: 160, minFontSize: 80, maxLines: 1, lineHeightMultiplier: 1 });
    ctx.fillStyle = theme.color_accent;
    drawTextLines(ctx, statFit, x, y, headingFontFamily, "left", width);

    const labelFit = fitText(ctx, label, { maxWidth: width, maxHeight: height * 0.2, fontFamily: bodyFontFamily, maxFontSize: 38, minFontSize: 26, maxLines: 2, lineHeightMultiplier: 1.25 });
    ctx.fillStyle = theme.color_foreground;
    drawTextLines(ctx, labelFit, x, y + statFit.totalHeight + 20, bodyFontFamily, "left", width);

    const bodyY = y + statFit.totalHeight + 20 + labelFit.totalHeight + 30;
    const bodyResult = drawBody(context, slide.body, bodyY, y + height - bodyY);
    return { overflow: statFit.overflow || labelFit.overflow || bodyResult.result.overflow, usedFallbackShortening: bodyResult.usedFallbackShortening };
  }),

  problem_solution: template("problem_solution", (context, slide) => {
    const { ctx, theme, x, y, width, height, bodyFontFamily } = context;
    const [problemRaw, solutionRaw] = slide.body.split(/\n{2,}|\|\|/);
    const halfHeight = (height - 30) / 2;

    ctx.font = `800 30px ${bodyFontFamily}`;
    ctx.fillStyle = "#EF4444";
    ctx.textAlign = "left";
    ctx.fillText("PROBLEM", x, y + 34);
    const problemFit = fitText(ctx, (problemRaw || slide.headline).trim(), { maxWidth: width, maxHeight: halfHeight - 50, fontFamily: bodyFontFamily, maxFontSize: 38, minFontSize: 26, maxLines: 5, lineHeightMultiplier: 1.3 });
    ctx.fillStyle = theme.color_muted;
    drawTextLines(ctx, problemFit, x, y + 50, bodyFontFamily, "left", width);

    const dividerY = y + halfHeight + 15;
    drawAccentBar(ctx, theme, x, dividerY, width, 6);
    ctx.font = `800 30px ${bodyFontFamily}`;
    ctx.fillStyle = theme.color_accent;
    ctx.fillText("ÇÖZÜM", x, dividerY + 50);
    const solutionFit = fitText(ctx, (solutionRaw || "").trim(), { maxWidth: width, maxHeight: halfHeight - 50, fontFamily: bodyFontFamily, maxFontSize: 38, minFontSize: 26, maxLines: 5, lineHeightMultiplier: 1.3 });
    ctx.fillStyle = theme.color_foreground;
    drawTextLines(ctx, solutionFit, x, dividerY + 66, bodyFontFamily, "left", width);

    return { overflow: problemFit.overflow || solutionFit.overflow, usedFallbackShortening: false };
  }),

  cta_closing: template("cta_closing", (context, slide) => {
    const { ctx, theme, bodyFontFamily, x, y, width, height } = context;
    ctx.textAlign = "center";
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, height * 0.45, "center", 66);
    const bodyResult = drawBody(context, slide.body, y + h.totalHeight + 40, height * 0.25, "center");

    if (slide.cta) {
      const ctaY = y + height - 130;
      const ctaFit = fitText(ctx, slide.cta, { maxWidth: width - 80, maxHeight: 70, fontFamily: bodyFontFamily, maxFontSize: 34, minFontSize: 24, maxLines: 1, lineHeightMultiplier: 1.1 });
      const pillWidth = Math.min(width, ctx.measureText(ctaFit.lines[0] || slide.cta).width + 100);
      const pillX = x + (width - pillWidth) / 2;
      const gradient = ctx.createLinearGradient(pillX, ctaY, pillX + pillWidth, ctaY);
      gradient.addColorStop(0, theme.color_primary);
      gradient.addColorStop(1, theme.color_accent);
      roundRect(ctx, pillX, ctaY, pillWidth, 88, theme.cta_style === "pill" ? 44 : 12);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.fillStyle = "#0B0D12";
      ctx.font = `800 ${ctaFit.fontSize}px ${bodyFontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ctaFit.lines[0] || slide.cta, pillX + pillWidth / 2, ctaY + 44);
    }

    return { overflow: h.overflow || bodyResult.result.overflow, usedFallbackShortening };
  })
};
