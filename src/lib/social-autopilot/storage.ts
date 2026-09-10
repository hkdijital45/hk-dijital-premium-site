// Media asset handling for Social Autopilot. Reuses the existing
// hk-dijital-media Supabase Storage bucket and its uploadToSupabaseStorage
// helper (src/lib/supabase.ts) rather than standing up a second bucket —
// the same public-bucket pattern already used for customer/blog media, and
// fine here because the content becomes public on Instagram the moment it
// publishes anyway. Both MANUAL MEDIA (human upload) and AUTO MEDIA
// (deterministic renderer output, see media/) go through this same bucket
// under a social-autopilot/ path prefix.
import { uploadToSupabaseStorage } from "@/lib/supabase";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export type MediaValidationResult = { ok: boolean; reason?: string };

export function validateMediaFile(file: { type: string; size: number }, kind: "image" | "video"): MediaValidationResult {
  if (kind === "image") {
    // Instagram's content-publishing API only accepts JPEG for image_url.
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return { ok: false, reason: "Sadece JPEG formatı desteklenir (Instagram content publishing API gereksinimi)." };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: `Görsel çok büyük (${Math.round(file.size / 1024 / 1024)}MB, azami 8MB).` };
  } else {
    if (!ALLOWED_VIDEO_TYPES.has(file.type)) return { ok: false, reason: "Sadece MP4/MOV formatı desteklenir." };
    if (file.size > MAX_VIDEO_BYTES) return { ok: false, reason: `Video çok büyük (${Math.round(file.size / 1024 / 1024)}MB, azami 100MB).` };
  }
  return { ok: true };
}

export async function uploadSocialMedia(file: File, kind: "image" | "video") {
  const validation = validateMediaFile(file, kind);
  if (!validation.ok) throw new Error(validation.reason);
  return uploadToSupabaseStorage(file, "social-autopilot");
}

/** Server-generated buffer upload (deterministic renderer output) — same
 * bucket/prefix, distinct from uploadSocialMedia which takes a browser File
 * from a MANUAL MEDIA upload form. uploadToSupabaseStorage takes a File, so
 * this wraps the buffer in one via a Blob (works fine server-side under
 * Next.js's Node runtime, which implements the File/Blob web APIs). */
export async function uploadSocialMediaBuffer(buffer: Buffer, contentType: string, extension: string, folder = "generated") {
  const file = new File([new Uint8Array(buffer)], `${crypto.randomUUID()}.${extension}`, { type: contentType });
  return uploadToSupabaseStorage(file, `social-autopilot/${folder}`);
}
