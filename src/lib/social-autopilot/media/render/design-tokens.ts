// HK Visual System V1 — centralized typography scale and spacing tokens for
// the deterministic renderer. Every template pulls font sizes / line counts
// from here instead of inventing its own numbers, so the whole system reads
// as one coherent visual language rather than 12 unrelated layouts.
//
// Levels map to the brief's six-tier hierarchy (DISPLAY/HEADLINE/SUBHEAD/
// BODY/LABEL/META): a few extra named tiers exist below (HEADLINE_COMPACT,
// BODY_COLUMN, ...) because several templates need the *same conceptual
// level* at a slightly different size for their layout (e.g. a two-column
// paragraph is narrower than a full-width one) — they stay part of the same
// family rather than becoming new one-off magic numbers.
export type TypeLevel = {
  max: number;
  min: number;
  maxLines: number;
  lineHeight: number;
};

export const TYPE_SCALE = {
  // DISPLAY — the strongest visual element on the slide. Cover hooks only.
  DISPLAY: { max: 88, min: 52, maxLines: 5, lineHeight: 1.08 } as TypeLevel,
  DISPLAY_COMPACT: { max: 66, min: 42, maxLines: 4, lineHeight: 1.1 } as TypeLevel,

  // HEADLINE — primary message of a body slide or a static post.
  HEADLINE: { max: 60, min: 38, maxLines: 4, lineHeight: 1.12 } as TypeLevel,
  HEADLINE_COMPACT: { max: 52, min: 34, maxLines: 3, lineHeight: 1.16 } as TypeLevel,

  // SUBHEAD — secondary supporting line, deliberately lower visual weight
  // than the headline (rendered in color_muted, never color_foreground).
  SUBHEAD: { max: 40, min: 26, maxLines: 5, lineHeight: 1.3 } as TypeLevel,

  // BODY — paragraph text.
  BODY: { max: 34, min: 24, maxLines: 10, lineHeight: 1.35 } as TypeLevel,
  BODY_COLUMN: { max: 32, min: 22, maxLines: 8, lineHeight: 1.3 } as TypeLevel,
  BODY_LIST: { max: 34, min: 24, maxLines: 3, lineHeight: 1.3 } as TypeLevel,
  FRAMEWORK_STEP: { max: 30, min: 22, maxLines: 2, lineHeight: 1.25 } as TypeLevel,

  // LABEL — small helper info: section eyebrows, ESKİ/YENİ style tags.
  // Minimal by design — never competes with the headline.
  LABEL: { max: 30, min: 22, maxLines: 1, lineHeight: 1 } as TypeLevel,

  // META — slide numbers, watermark text. Smallest, quietest tier.
  META: { max: 22, min: 18, maxLines: 1, lineHeight: 1 } as TypeLevel,

  // Data/insight numerals are their own scale — much larger than DISPLAY,
  // single line only.
  STAT: { max: 160, min: 80, maxLines: 1, lineHeight: 1 } as TypeLevel,
  STAT_LABEL: { max: 38, min: 26, maxLines: 2, lineHeight: 1.25 } as TypeLevel
} as const;

export type TypeLevelKey = keyof typeof TYPE_SCALE;

// Spacing / grid tokens — the shared vertical rhythm every template composes
// within. SAFE_MARGIN/CAROUSEL_WIDTH/HEIGHT stay in canvas-utils.ts (they are
// canvas-geometry constants, not typographic rhythm); these are the
// content-composition numbers that were previously scattered per template.
export const SPACING = {
  SECTION_GAP: 32,
  ROW_GAP: 18,
  COLUMN_GAP: 40,
  RULE_HEIGHT: 5,
  RULE_WIDTH: 64
} as const;

// A single, controlled semantic exception to the brand palette: used only
// for "wrong / before / mistake" markers (ESKİ, YANLIŞ İNANIŞ, PROBLEM, the
// mistakes-template cross mark). Never used for brand/accent purposes.
export const DANGER = "#F87171";
