import { loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import type { ResolvedTheme } from "./theme";

export const CAROUSEL_WIDTH = 1080;
export const CAROUSEL_HEIGHT = 1350;
// Generous safe margin from every edge — mobile Instagram UI chrome
// (username, caption, action icons) never overlaps content rendered inside
// this box.
export const SAFE_MARGIN = 72;

export function roundRect(ctx: SKRSContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function paintBackground(ctx: SKRSContext2D, theme: ResolvedTheme, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, theme.gradient_from);
  gradient.addColorStop(1, theme.gradient_to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function paintCard(ctx: SKRSContext2D, theme: ResolvedTheme, x: number, y: number, width: number, height: number) {
  roundRect(ctx, x, y, width, height, theme.border_radius);
  if (theme.card_style === "outlined") {
    ctx.fillStyle = theme.color_background;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.color_muted;
    ctx.stroke();
    return;
  }
  ctx.fillStyle = theme.color_surface;
  ctx.fill();
  if (theme.card_style === "elevated") {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, x, y, width, height, theme.border_radius);
    ctx.fillStyle = theme.color_surface;
    ctx.fill();
    ctx.restore();
  }
}

export function drawAccentBar(ctx: SKRSContext2D, theme: ResolvedTheme, x: number, y: number, width: number, height: number) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, theme.color_primary);
  gradient.addColorStop(1, theme.color_accent);
  ctx.fillStyle = gradient;
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();
}

export function drawPageIndicator(ctx: SKRSContext2D, theme: ResolvedTheme, index: number, total: number, canvasWidth: number, canvasHeight: number) {
  const dotRadius = 7;
  const gap = 22;
  const totalWidth = (total - 1) * gap;
  const startX = canvasWidth / 2 - totalWidth / 2;
  const y = canvasHeight - SAFE_MARGIN * 0.55;
  for (let i = 0; i < total; i += 1) {
    ctx.beginPath();
    ctx.arc(startX + i * gap, y, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = i === index ? theme.color_accent : theme.color_muted;
    ctx.globalAlpha = i === index ? 1 : 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function drawSlideNumber(ctx: SKRSContext2D, theme: ResolvedTheme, index: number, total: number, canvasWidth: number, fontFamily: string) {
  ctx.font = `28px ${fontFamily}`;
  ctx.fillStyle = theme.color_muted;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${index + 1}/${total}`, canvasWidth - SAFE_MARGIN, SAFE_MARGIN + 10);
}

let logoImageCache: { url: string; image: Image | null } | null = null;

async function loadLogoImage(url: string): Promise<Image | null> {
  if (logoImageCache?.url === url) return logoImageCache.image;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`logo fetch failed (${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const image = await loadImage(buffer);
    logoImageCache = { url, image };
    return image;
  } catch {
    logoImageCache = { url, image: null };
    return null;
  }
}

/** Draws the configured logo image if present and reachable; otherwise
 * falls back to a small muted text wordmark using the brand name — never
 * throws, never blocks a render over a broken logo URL, and never silently
 * skips branding entirely when watermark_enabled is true. */
export async function drawBrandMark(ctx: SKRSContext2D, theme: ResolvedTheme, brandName: string, canvasWidth: number, canvasHeight: number, bodyFontFamily: string) {
  if (!theme.watermark_enabled) return;
  const markSize = 56;
  const positions: Record<string, { x: number; y: number }> = {
    "top-left": { x: SAFE_MARGIN, y: SAFE_MARGIN },
    "top-right": { x: canvasWidth - SAFE_MARGIN - markSize, y: SAFE_MARGIN },
    "bottom-left": { x: SAFE_MARGIN, y: canvasHeight - SAFE_MARGIN - markSize },
    "bottom-right": { x: canvasWidth - SAFE_MARGIN - markSize, y: canvasHeight - SAFE_MARGIN - markSize },
    "center-top": { x: canvasWidth / 2 - markSize / 2, y: SAFE_MARGIN }
  };
  const position = positions[theme.logo_position] || positions["top-left"];

  const image = theme.logo_url ? await loadLogoImage(theme.logo_url) : null;
  if (image) {
    ctx.drawImage(image, position.x, position.y, markSize, markSize);
    return;
  }
  ctx.font = `700 22px ${bodyFontFamily}`;
  ctx.fillStyle = theme.color_muted;
  ctx.textAlign = theme.logo_position.includes("right") ? "right" : "left";
  ctx.textBaseline = "top";
  const textX = theme.logo_position.includes("right") ? canvasWidth - SAFE_MARGIN : SAFE_MARGIN;
  ctx.fillText(brandName.toUpperCase(), textX, position.y + 16);
}
