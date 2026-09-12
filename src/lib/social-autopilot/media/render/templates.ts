// Professional, reusable carousel layouts. Each template is a pure layout
// function operating inside the shared safe-content rectangle
// carousel-renderer.ts computes (background, brand mark, page indicator and
// slide number are drawn once by the caller, identically for every
// template). Templates interpret `slide.body` as either one paragraph or
// newline-separated list items, depending on what the template needs —
// content-generator.ts tells the AI which shape to write for the template
// already chosen for that slide (see selectCarouselTemplate in
// template-selector.ts).
//
// HK Visual System V1: font sizes/line counts come from design-tokens.ts's
// TYPE_SCALE rather than per-template magic numbers, and decorative fills
// (badges, CTA pill) are flat brand colors, not gradients — see the audit
// in the HK Visual System V1 report for why.
import type { SKRSContext2D } from "@napi-rs/canvas";
import type { ResolvedTheme } from "./theme";
import { fitText, drawTextLines, shortenToFit, type FitTextResult } from "./typography.ts";
import { roundRect, drawAccentBar } from "./canvas-utils.ts";
import { TYPE_SCALE, SPACING, DANGER, type TypeLevelKey } from "./design-tokens.ts";

export const TEMPLATE_KEYS = [
  "bold_hook", "educational_breakdown", "mistakes", "checklist", "step_by_step",
  "comparison", "myth_vs_reality", "framework", "data_insight", "tactical_guide",
  "problem_solution", "question_prompt", "cta_closing"
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  bold_hook: "Bold Hook", educational_breakdown: "Educational Breakdown", mistakes: "Mistakes",
  checklist: "Checklist", step_by_step: "Step-by-Step", comparison: "Comparison",
  myth_vs_reality: "Myth vs Reality", framework: "Framework", data_insight: "Data / Insight",
  tactical_guide: "Tactical Guide", problem_solution: "Problem → Solution",
  question_prompt: "Question", cta_closing: "CTA / Closing"
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

function drawHeadline(context: TemplateRenderContext, headline: string, boxHeight: number, align: "left" | "center" = "left", level: TypeLevelKey = "HEADLINE") {
  const { ctx, theme, headingFontFamily, x, y, width } = context;
  const scale = TYPE_SCALE[level];
  ctx.fillStyle = theme.color_foreground;
  const { result, usedFallbackShortening } = fitWithShortenRetry(ctx, headline, {
    maxWidth: width, maxHeight: boxHeight, fontFamily: headingFontFamily, maxFontSize: scale.max, minFontSize: scale.min, maxLines: scale.maxLines, lineHeightMultiplier: scale.lineHeight
  });
  drawTextLines(ctx, result, x, y, headingFontFamily, align, width);
  return { result, usedFallbackShortening };
}

// Secondary supporting line — always color_muted, always a lower-weight
// scale than whatever headline it sits under, per the brief's visual
// hierarchy rule (headline = strongest, secondary text = lower weight).
function drawSubhead(context: TemplateRenderContext, text: string, boxY: number, boxHeight: number, align: "left" | "center" = "left") {
  const { ctx, theme, bodyFontFamily, x, width } = context;
  const scale = TYPE_SCALE.SUBHEAD;
  ctx.fillStyle = theme.color_muted;
  const { result, usedFallbackShortening } = fitWithShortenRetry(ctx, text, {
    maxWidth: width, maxHeight: boxHeight, fontFamily: bodyFontFamily, maxFontSize: scale.max, minFontSize: scale.min, maxLines: scale.maxLines, lineHeightMultiplier: scale.lineHeight
  });
  drawTextLines(ctx, result, x, boxY, bodyFontFamily, align, width);
  return { result, usedFallbackShortening };
}

function drawBody(context: TemplateRenderContext, body: string, boxY: number, boxHeight: number, align: "left" | "center" = "left", level: TypeLevelKey = "BODY") {
  const { ctx, theme, bodyFontFamily, x, width } = context;
  const scale = TYPE_SCALE[level];
  ctx.fillStyle = theme.color_muted;
  const { result, usedFallbackShortening } = fitWithShortenRetry(ctx, body, {
    maxWidth: width, maxHeight: boxHeight, fontFamily: bodyFontFamily, maxFontSize: scale.max, minFontSize: scale.min, maxLines: scale.maxLines, lineHeightMultiplier: scale.lineHeight
  });
  drawTextLines(ctx, result, x, boxY, bodyFontFamily, align, width);
  return { result, usedFallbackShortening };
}

function drawEyebrowLabel(ctx: SKRSContext2D, x: number, y: number, label: string, fontFamily: string, color: string) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${TYPE_SCALE.LABEL.max}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.fillText(label, x, y + TYPE_SCALE.LABEL.max);
  ctx.fillRect(x, y + TYPE_SCALE.LABEL.max + 18, SPACING.RULE_WIDTH, SPACING.RULE_HEIGHT);
  return TYPE_SCALE.LABEL.max + 18 + SPACING.RULE_HEIGHT;
}

function drawBadge(ctx: SKRSContext2D, theme: ResolvedTheme, cx: number, cy: number, radius: number, label: string, fontFamily: string) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = theme.color_primary;
  ctx.fill();
  ctx.font = `800 ${Math.round(radius * 1.05)}px ${fontFamily}`;
  ctx.fillStyle = theme.color_background;
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
  const rowGap = SPACING.ROW_GAP;
  const markerSize = 44;
  const textX = x + markerSize + 28;
  const textWidth = width - markerSize - 28;
  const scale = TYPE_SCALE.BODY_LIST;
  let cursorY = boxY;
  let overflow = false;

  for (let i = 0; i < items.length; i += 1) {
    const remainingHeight = boxHeight - (cursorY - boxY);
    if (remainingHeight < 60) { overflow = i < items.length; break; }
    const fit = fitText(ctx, items[i], { maxWidth: textWidth, maxHeight: remainingHeight, fontFamily: bodyFontFamily, maxFontSize: scale.max, minFontSize: scale.min, maxLines: scale.maxLines, lineHeightMultiplier: scale.lineHeight });
    if (fit.overflow) overflow = true;

    const markerCy = cursorY + fit.lineHeight * 0.55;
    if (marker === "check") drawCheckMark(ctx, x + markerSize / 2, markerCy, markerSize * 0.8, theme.color_accent);
    else if (marker === "cross") drawCrossMark(ctx, x + markerSize / 2, markerCy, markerSize * 0.8, DANGER);
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
    const { result, usedFallbackShortening } = drawHeadline(context, slide.headline, context.height * 0.7, "left", "DISPLAY");
    if (slide.body) drawBody(context, slide.body, context.y + result.totalHeight + SPACING.SECTION_GAP + 8, context.height - result.totalHeight - SPACING.SECTION_GAP - 8);
    return { overflow: result.overflow, usedFallbackShortening };
  }),

  educational_breakdown: template("educational_breakdown", (context, slide) => {
    const headlineHeight = context.height * 0.28;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", "HEADLINE");
    const bodyResult = drawBody(context, slide.body, context.y + headlineHeight + SPACING.SECTION_GAP - 8, context.height - headlineHeight - SPACING.SECTION_GAP + 8);
    return { overflow: h.overflow || bodyResult.result.overflow, usedFallbackShortening: usedFallbackShortening || bodyResult.usedFallbackShortening };
  }),

  question_prompt: template("question_prompt", (context, slide) => {
    const { ctx, theme, bodyFontFamily, x, y, height } = context;
    const eyebrowHeight = drawEyebrowLabel(ctx, x, y, "DOĞRUDAN SORU", bodyFontFamily, theme.color_primary);
    const headlineY = y + eyebrowHeight + SPACING.SECTION_GAP;
    const headlineHeight = height * 0.55;
    const { result: h, usedFallbackShortening } = drawHeadline({ ...context, y: headlineY }, slide.headline, headlineHeight, "left", "HEADLINE");
    let subOverflow = false;
    if (slide.body) {
      const subY = headlineY + h.totalHeight + SPACING.SECTION_GAP;
      const sub = drawSubhead(context, slide.body, subY, height - (subY - y));
      subOverflow = sub.result.overflow;
    }
    return { overflow: h.overflow || subOverflow, usedFallbackShortening };
  }),

  mistakes: template("mistakes", (context, slide) => {
    const headlineHeight = context.height * 0.22;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", "HEADLINE_COMPACT");
    const list = drawMarkerList(context, listItemsFrom(slide.body), context.y + headlineHeight + SPACING.SECTION_GAP - 12, context.height - headlineHeight - SPACING.SECTION_GAP + 12, "cross");
    return { overflow: h.overflow || list.overflow, usedFallbackShortening };
  }),

  checklist: template("checklist", (context, slide) => {
    const headlineHeight = context.height * 0.22;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", "HEADLINE_COMPACT");
    const list = drawMarkerList(context, listItemsFrom(slide.body), context.y + headlineHeight + SPACING.SECTION_GAP - 12, context.height - headlineHeight - SPACING.SECTION_GAP + 12, "check");
    return { overflow: h.overflow || list.overflow, usedFallbackShortening };
  }),

  step_by_step: template("step_by_step", (context, slide) => {
    const headlineHeight = context.height * 0.2;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", "HEADLINE_COMPACT");
    const list = drawMarkerList(context, listItemsFrom(slide.body), context.y + headlineHeight + SPACING.SECTION_GAP - 12, context.height - headlineHeight - SPACING.SECTION_GAP + 12, "number");
    return { overflow: h.overflow || list.overflow, usedFallbackShortening };
  }),

  tactical_guide: template("tactical_guide", (context, slide) => {
    const headlineHeight = context.height * 0.2;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", "HEADLINE_COMPACT");
    const list = drawMarkerList(context, listItemsFrom(slide.body), context.y + headlineHeight + SPACING.SECTION_GAP - 12, context.height - headlineHeight - SPACING.SECTION_GAP + 12, "check");
    return { overflow: h.overflow || list.overflow, usedFallbackShortening };
  }),

  comparison: template("comparison", (context, slide) => {
    const { ctx, theme, x, y, width, height, bodyFontFamily } = context;
    const [leftRaw, rightRaw] = slide.body.split(/\n{2,}|\|\|/);
    const columnGap = SPACING.COLUMN_GAP;
    const columnWidth = (width - columnGap) / 2;
    const headlineHeight = height * 0.2;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", "HEADLINE_COMPACT");
    const labelScale = TYPE_SCALE.LABEL;

    ctx.strokeStyle = theme.color_muted;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x + columnWidth + columnGap / 2, y + headlineHeight + 30);
    ctx.lineTo(x + columnWidth + columnGap / 2, y + height);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.font = `800 ${labelScale.max}px ${bodyFontFamily}`;
    ctx.fillStyle = DANGER;
    ctx.textAlign = "left";
    ctx.fillText("ESKİ", x, y + headlineHeight + 60);
    ctx.fillStyle = theme.color_accent;
    ctx.fillText("YENİ", x + columnWidth + columnGap, y + headlineHeight + 60);

    const leftFit = fitText(ctx, (leftRaw || "").trim(), { maxWidth: columnWidth, maxHeight: height - headlineHeight - 100, fontFamily: bodyFontFamily, maxFontSize: TYPE_SCALE.BODY_COLUMN.max, minFontSize: TYPE_SCALE.BODY_COLUMN.min, maxLines: TYPE_SCALE.BODY_COLUMN.maxLines, lineHeightMultiplier: TYPE_SCALE.BODY_COLUMN.lineHeight });
    ctx.fillStyle = theme.color_muted;
    drawTextLines(ctx, leftFit, x, y + headlineHeight + 90, bodyFontFamily, "left", columnWidth);

    const rightFit = fitText(ctx, (rightRaw || "").trim(), { maxWidth: columnWidth, maxHeight: height - headlineHeight - 100, fontFamily: bodyFontFamily, maxFontSize: TYPE_SCALE.BODY_COLUMN.max, minFontSize: TYPE_SCALE.BODY_COLUMN.min, maxLines: TYPE_SCALE.BODY_COLUMN.maxLines, lineHeightMultiplier: TYPE_SCALE.BODY_COLUMN.lineHeight });
    ctx.fillStyle = theme.color_foreground;
    drawTextLines(ctx, rightFit, x + columnWidth + columnGap, y + headlineHeight + 90, bodyFontFamily, "left", columnWidth);

    return { overflow: h.overflow || leftFit.overflow || rightFit.overflow, usedFallbackShortening };
  }),

  myth_vs_reality: template("myth_vs_reality", (context, slide) => {
    const { ctx, theme, x, y, width, height, bodyFontFamily } = context;
    const [mythRaw, realityRaw] = slide.body.split(/\n{2,}|\|\|/);
    const halfHeight = (height - 30) / 2;
    const labelScale = TYPE_SCALE.LABEL;

    ctx.font = `800 ${labelScale.max}px ${bodyFontFamily}`;
    ctx.textAlign = "left";
    ctx.fillStyle = DANGER;
    ctx.fillText("YANLIŞ İNANIŞ", x, y + 34);
    const mythFit = fitText(ctx, (mythRaw || slide.headline).trim(), { maxWidth: width, maxHeight: halfHeight - 50, fontFamily: bodyFontFamily, maxFontSize: TYPE_SCALE.SUBHEAD.max, minFontSize: TYPE_SCALE.SUBHEAD.min, maxLines: TYPE_SCALE.SUBHEAD.maxLines, lineHeightMultiplier: TYPE_SCALE.SUBHEAD.lineHeight });
    ctx.fillStyle = theme.color_muted;
    drawTextLines(ctx, mythFit, x, y + 50, bodyFontFamily, "left", width);

    const dividerY = y + halfHeight + 15;
    drawAccentBar(ctx, theme, x, dividerY, width, 6);

    ctx.font = `800 ${labelScale.max}px ${bodyFontFamily}`;
    ctx.fillStyle = theme.color_accent;
    ctx.fillText("GERÇEK", x, dividerY + 50);
    const realityFit = fitText(ctx, (realityRaw || "").trim(), { maxWidth: width, maxHeight: halfHeight - 50, fontFamily: bodyFontFamily, maxFontSize: TYPE_SCALE.SUBHEAD.max, minFontSize: TYPE_SCALE.SUBHEAD.min, maxLines: TYPE_SCALE.SUBHEAD.maxLines, lineHeightMultiplier: TYPE_SCALE.SUBHEAD.lineHeight });
    ctx.fillStyle = theme.color_foreground;
    drawTextLines(ctx, realityFit, x, dividerY + 66, bodyFontFamily, "left", width);

    return { overflow: mythFit.overflow || realityFit.overflow, usedFallbackShortening: false };
  }),

  framework: template("framework", (context, slide) => {
    const { ctx, theme, x, y, width, height, bodyFontFamily } = context;
    const headlineHeight = height * 0.2;
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, headlineHeight, "left", "HEADLINE_COMPACT");
    const steps = listItemsFrom(slide.body).slice(0, 5);
    const boxHeight = (height - headlineHeight - 20 - (steps.length - 1) * 20) / steps.length;
    const stepScale = TYPE_SCALE.FRAMEWORK_STEP;
    let cursorY = y + headlineHeight + 20;
    let overflow = h.overflow;

    for (const step of steps) {
      roundRect(ctx, x, cursorY, width, boxHeight, theme.border_radius * 0.6);
      ctx.fillStyle = theme.color_surface;
      ctx.fill();
      const fit = fitText(ctx, step, { maxWidth: width - 48, maxHeight: boxHeight - 24, fontFamily: bodyFontFamily, maxFontSize: stepScale.max, minFontSize: stepScale.min, maxLines: stepScale.maxLines, lineHeightMultiplier: stepScale.lineHeight });
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
    const statScale = TYPE_SCALE.STAT;
    const labelScale = TYPE_SCALE.STAT_LABEL;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const statFit = fitText(ctx, stat, { maxWidth: width, maxHeight: height * 0.45, fontFamily: headingFontFamily, maxFontSize: statScale.max, minFontSize: statScale.min, maxLines: statScale.maxLines, lineHeightMultiplier: statScale.lineHeight });
    ctx.fillStyle = theme.color_accent;
    drawTextLines(ctx, statFit, x, y, headingFontFamily, "left", width);

    const labelFit = fitText(ctx, label, { maxWidth: width, maxHeight: height * 0.2, fontFamily: bodyFontFamily, maxFontSize: labelScale.max, minFontSize: labelScale.min, maxLines: labelScale.maxLines, lineHeightMultiplier: labelScale.lineHeight });
    ctx.fillStyle = theme.color_foreground;
    drawTextLines(ctx, labelFit, x, y + statFit.totalHeight + 20, bodyFontFamily, "left", width);

    const bodyY = y + statFit.totalHeight + 20 + labelFit.totalHeight + 30;
    const bodyResult = slide.body ? drawBody(context, slide.body, bodyY, y + height - bodyY) : null;
    return { overflow: statFit.overflow || labelFit.overflow || Boolean(bodyResult?.result.overflow), usedFallbackShortening: Boolean(bodyResult?.usedFallbackShortening) };
  }),

  problem_solution: template("problem_solution", (context, slide) => {
    const { ctx, theme, x, y, width, height, bodyFontFamily } = context;
    const [problemRaw, solutionRaw] = slide.body.split(/\n{2,}|\|\|/);
    const halfHeight = (height - 30) / 2;
    const labelScale = TYPE_SCALE.LABEL;

    ctx.font = `800 ${labelScale.max}px ${bodyFontFamily}`;
    ctx.fillStyle = DANGER;
    ctx.textAlign = "left";
    ctx.fillText("PROBLEM", x, y + 34);
    const problemFit = fitText(ctx, (problemRaw || slide.headline).trim(), { maxWidth: width, maxHeight: halfHeight - 50, fontFamily: bodyFontFamily, maxFontSize: TYPE_SCALE.SUBHEAD.max, minFontSize: TYPE_SCALE.SUBHEAD.min, maxLines: TYPE_SCALE.SUBHEAD.maxLines, lineHeightMultiplier: TYPE_SCALE.SUBHEAD.lineHeight });
    ctx.fillStyle = theme.color_muted;
    drawTextLines(ctx, problemFit, x, y + 50, bodyFontFamily, "left", width);

    const dividerY = y + halfHeight + 15;
    drawAccentBar(ctx, theme, x, dividerY, width, 6);
    ctx.font = `800 ${labelScale.max}px ${bodyFontFamily}`;
    ctx.fillStyle = theme.color_accent;
    ctx.fillText("ÇÖZÜM", x, dividerY + 50);
    const solutionFit = fitText(ctx, (solutionRaw || "").trim(), { maxWidth: width, maxHeight: halfHeight - 50, fontFamily: bodyFontFamily, maxFontSize: TYPE_SCALE.SUBHEAD.max, minFontSize: TYPE_SCALE.SUBHEAD.min, maxLines: TYPE_SCALE.SUBHEAD.maxLines, lineHeightMultiplier: TYPE_SCALE.SUBHEAD.lineHeight });
    ctx.fillStyle = theme.color_foreground;
    drawTextLines(ctx, solutionFit, x, dividerY + 66, bodyFontFamily, "left", width);

    return { overflow: problemFit.overflow || solutionFit.overflow, usedFallbackShortening: false };
  }),

  cta_closing: template("cta_closing", (context, slide) => {
    const { ctx, theme, bodyFontFamily, x, y, width, height } = context;
    ctx.textAlign = "center";
    const { result: h, usedFallbackShortening } = drawHeadline(context, slide.headline, height * 0.45, "center", "DISPLAY_COMPACT");
    const bodyResult = slide.body ? drawSubhead(context, slide.body, y + h.totalHeight + SPACING.SECTION_GAP + 8, height * 0.25, "center") : null;

    if (slide.cta) {
      const ctaY = y + height - 130;
      const ctaFit = fitText(ctx, slide.cta, { maxWidth: width - 80, maxHeight: 70, fontFamily: bodyFontFamily, maxFontSize: 34, minFontSize: 24, maxLines: 1, lineHeightMultiplier: 1.1 });
      const pillWidth = Math.min(width, ctx.measureText(ctaFit.lines[0] || slide.cta).width + 100);
      const pillX = x + (width - pillWidth) / 2;
      roundRect(ctx, pillX, ctaY, pillWidth, 88, theme.cta_style === "pill" ? 44 : 12);
      ctx.fillStyle = theme.color_primary;
      ctx.fill();
      ctx.fillStyle = theme.color_background;
      ctx.font = `800 ${ctaFit.fontSize}px ${bodyFontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ctaFit.lines[0] || slide.cta, pillX + pillWidth / 2, ctaY + 44);
    }

    return { overflow: h.overflow || Boolean(bodyResult?.result.overflow), usedFallbackShortening };
  })
};
