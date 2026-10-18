import "server-only";

// Logo image validation + normalization. Every logo that will ever reach a
// PDF (manual upload, website discovery, legacy customer_branding upload)
// passes through here: real magic-byte check, real decode (a file that
// does not decode is rejected — no trusting the extension or MIME), size
// and dimension limits, then a clean re-encode to PNG. Re-encoding drops
// any non-image payload (metadata, appended data, polyglot tricks) and
// gives pdf-lib a format it can always embed (it cannot embed WebP or
// 16-bit PNG). Proportions are never changed; large images are only
// scaled down uniformly. SVG is intentionally NOT accepted: it is active
// content and pdf-lib cannot embed it.

export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const LOGO_MIN_SIDE = 16;
export const LOGO_MAX_SIDE = 8000;
const LOGO_OUTPUT_MAX_SIDE = 1200;

export type LogoMime = "image/png" | "image/jpeg" | "image/webp";
export type NormalizedLogo = { png: Buffer; width: number; height: number; sourceMime: LogoMime; sha256: string };

export class LogoImageError extends Error {}

export function sniffLogoMime(buffer: Buffer): LogoMime | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

/** Width/height straight from a PNG's IHDR chunk (no decode). */
export function pngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (sniffLogoMime(buffer) !== "image/png" || buffer.length < 24) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export type LogoBackground = { transparent: boolean; light: boolean };

/** Samples the four CORNER pixels of an already-decoded logo PNG to
 * classify its real background — used by the PDF cover renderer
 * (premium-pdf.ts) to decide whether a client logo needs a light backing
 * plate (opaque + light/white corners, where the logo would otherwise
 * read as unreadable on a navy cover) or can sit directly on navy
 * (genuinely transparent corners, or an opaque colored/dark background
 * that already contrasts fine on its own). Never guesses from the file
 * extension/MIME alone, and never alters the image's own pixels —
 * callers choose a surface to place the UNCHANGED logo on top of; the
 * logo's own real background (e.g. a white rectangle baked into the
 * pixels) is never cropped or force-stripped. */
export async function analyzeLogoBackground(png: Buffer): Promise<LogoBackground> {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  let image: Awaited<ReturnType<typeof loadImage>>;
  try {
    image = await loadImage(png);
  } catch {
    return { transparent: false, light: false };
  }
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const corners: Array<[number, number]> = [
    [0, 0], [image.width - 1, 0], [0, image.height - 1], [image.width - 1, image.height - 1]
  ];
  let alphaSum = 0;
  let lightSum = 0;
  let opaqueSamples = 0;
  for (const [x, y] of corners) {
    const { data } = ctx.getImageData(x, y, 1, 1);
    const [r, g, b, a] = data;
    alphaSum += a;
    if (a > 200) {
      lightSum += (r + g + b) / 3;
      opaqueSamples += 1;
    }
  }
  return {
    transparent: alphaSum / corners.length < 64,
    light: opaqueSamples > 0 && lightSum / opaqueSamples > 225
  };
}

export async function normalizeLogoImage(input: Buffer): Promise<NormalizedLogo> {
  if (!input?.length) throw new LogoImageError("Görsel boş.");
  if (input.length > LOGO_MAX_BYTES) throw new LogoImageError("Logo dosyası 5 MB sınırını aşıyor.");
  const mime = sniffLogoMime(input);
  if (!mime) throw new LogoImageError("Desteklenmeyen görsel biçimi. PNG, JPEG veya WebP yükleyin.");

  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  let image: Awaited<ReturnType<typeof loadImage>>;
  try {
    image = await loadImage(input);
  } catch {
    throw new LogoImageError("Görsel çözümlenemedi (bozuk veya geçersiz dosya).");
  }
  const width = image.width;
  const height = image.height;
  if (!(width >= LOGO_MIN_SIDE && height >= LOGO_MIN_SIDE)) throw new LogoImageError("Logo çok küçük (en az 16×16 piksel olmalı).");
  if (width > LOGO_MAX_SIDE || height > LOGO_MAX_SIDE || width * height > 40_000_000) throw new LogoImageError("Logo boyutları çok büyük.");

  const scale = Math.min(1, LOGO_OUTPUT_MAX_SIDE / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));
  const canvas = createCanvas(outW, outH);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, outW, outH);
  const png = Buffer.from(await canvas.encode("png"));
  const { createHash } = await import("node:crypto");
  return { png, width: outW, height: outH, sourceMime: mime, sha256: createHash("sha256").update(png).digest("hex") };
}
