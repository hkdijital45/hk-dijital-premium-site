import type { CSSProperties } from "react";

/** globals.css forces `color` to a theme token via `!important` on any
 * element classed `.font-black`/`.font-bold`/`.text-xs`/`.text-[10px]`
 * (see the "escape hatch" comment above those rules) UNLESS that same
 * element also sets the `--hk-force-text-color` custom property inline —
 * an inline custom property always wins over a stylesheet's definition
 * of that property, so the rules' `var(--hk-force-text-color, ...)`
 * picks it up before falling back to the forced value. A plain inline
 * `color` alone always loses to those rules, silently repainting text
 * (including literal white-on-color button labels) to the wrong color.
 * Wrap any inline style that sets `color` on a `.font-black`/`.font-bold`/
 * `.text-xs`-classed element with this helper instead of writing the
 * custom property by hand everywhere. */
export function forceTextColor<T extends CSSProperties & { color?: string }>(style: T): T & CSSProperties {
  return style.color ? ({ ...style, "--hk-force-text-color": style.color } as T & CSSProperties) : style;
}

/** Real WCAG 2.x relative-luminance contrast ratio between two #rrggbb
 * colors — used by a regression test to verify every button color pair
 * this app actually ships (not just that a color "looks" dark/light
 * enough) meets the 4.5:1 AA target for normal-size text. */
export function contrastRatio(hexA: string, hexB: string): number {
  const luminance = (hex: string) => {
    const clean = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
    const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const [l1, l2] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}
