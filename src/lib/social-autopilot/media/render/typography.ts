// The typography engine: real font-metric-based text measurement and
// wrapping (via @napi-rs/canvas's actual ctx.measureText — not a heuristic
// character-count estimate), automatic font sizing within a hard min/max
// range, and honest overflow detection. This is what lets the media
// quality gate reject a render instead of ever shipping unreadably small
// text, a clipped CTA, or copy that spills past its safe box.
import type { SKRSContext2D } from "@napi-rs/canvas";

export type TextAlign = "left" | "center" | "right";

export type FitTextOptions = {
  maxWidth: number;
  maxHeight: number;
  fontFamily: string;
  maxFontSize: number;
  minFontSize: number;
  lineHeightMultiplier?: number;
  maxLines?: number;
  fontWeightLabel?: string;
};

export type FitTextResult = {
  fontSize: number;
  lineHeight: number;
  lines: string[];
  totalHeight: number;
  overflow: boolean;
};

function setFont(ctx: SKRSContext2D, fontFamily: string, sizePx: number) {
  ctx.font = `${sizePx}px ${fontFamily}`;
}

/** Greedy word-wrap using real measured glyph widths — correct for
 * proportional fonts (a fixed characters-per-line estimate is not). Also
 * hard-splits any single word wider than maxWidth on its own (long URLs,
 * numbers) so it can never silently overflow the box horizontally. */
export function wrapTextToWidth(ctx: SKRSContext2D, text: string, fontFamily: string, fontSizePx: number, maxWidth: number): string[] {
  setFont(ctx, fontFamily, fontSizePx);
  const paragraphs = text.split(/\n+/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      if (ctx.measureText(word).width > maxWidth) {
        let chunk = "";
        for (const char of word) {
          const next = chunk + char;
          if (ctx.measureText(next).width > maxWidth && chunk) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk = next;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/** Tries font sizes from maxFontSize down to minFontSize, returning the
 * largest size whose wrapped line count and total height both fit the box.
 * Never returns a size below minFontSize — if nothing fits even there,
 * overflow=true is set and the caller (carousel-renderer.ts) must shorten
 * the source text and retry, or reject the render. */
export function fitText(ctx: SKRSContext2D, text: string, options: FitTextOptions): FitTextResult {
  const lineHeightMultiplier = options.lineHeightMultiplier ?? 1.25;
  const step = 2;

  for (let size = options.maxFontSize; size >= options.minFontSize; size -= step) {
    const lines = wrapTextToWidth(ctx, text, options.fontFamily, size, options.maxWidth);
    const lineHeight = Math.round(size * lineHeightMultiplier);
    const totalHeight = lines.length * lineHeight;
    const tooManyLines = options.maxLines ? lines.length > options.maxLines : false;
    if (!tooManyLines && totalHeight <= options.maxHeight) {
      return { fontSize: size, lineHeight, lines, totalHeight, overflow: false };
    }
  }

  const lines = wrapTextToWidth(ctx, text, options.fontFamily, options.minFontSize, options.maxWidth);
  const lineHeight = Math.round(options.minFontSize * lineHeightMultiplier);
  return { fontSize: options.minFontSize, lineHeight, lines, totalHeight: lines.length * lineHeight, overflow: true };
}

/** Deterministic, free, zero-AI-call copy shortening: trims to the nearest
 * sentence boundary under a character budget, falling back to a hard word
 * cut with an ellipsis only if no sentence boundary exists at all. */
export function shortenToFit(text: string, approxMaxChars: number): string {
  if (text.length <= approxMaxChars) return text;
  const truncated = text.slice(0, approxMaxChars);
  const sentenceEnd = Math.max(truncated.lastIndexOf(". "), truncated.lastIndexOf("! "), truncated.lastIndexOf("? "));
  if (sentenceEnd > approxMaxChars * 0.4) return truncated.slice(0, sentenceEnd + 1).trim();
  const wordBoundary = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, wordBoundary > 0 ? wordBoundary : approxMaxChars).trim()}…`;
}

export function drawTextLines(ctx: SKRSContext2D, result: FitTextResult, x: number, startY: number, fontFamily: string, align: TextAlign, boxWidth: number) {
  setFont(ctx, fontFamily, result.fontSize);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = align;
  const drawX = align === "left" ? x : align === "right" ? x + boxWidth : x + boxWidth / 2;
  result.lines.forEach((line, index) => {
    ctx.fillText(line, drawX, startY + result.lineHeight * (index + 1) - result.lineHeight * 0.22);
  });
}
