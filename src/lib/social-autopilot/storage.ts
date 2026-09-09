// Media asset handling for Social Autopilot. Reuses the existing
// hk-dijital-media Supabase Storage bucket and its uploadToSupabaseStorage
// helper (src/lib/supabase.ts) rather than standing up a second bucket —
// the same public-bucket pattern already used for customer/blog media, and
// fine here because the content becomes public on Instagram the moment it
// publishes anyway.
//
// Deliberate scope boundary (spec section 16): this module does NOT
// generate images or video. No AI image/video generation provider exists
// elsewhere in this codebase to reuse (verified during the audit), and
// fabricating a low-effort synthetic-visual generator would violate the
// spec's explicit instruction not to auto-produce poor-quality AI imagery.
// The AI pipeline (content-generator.ts) produces the full creative
// package — script, shot plan, on-screen text, cover/visual prompts,
// carousel slide copy — and a human (editor/designer) uploads the actual
// produced video/image file here through the Content Studio UI before an
// item can be scheduled. This mirrors the same boundary the existing Growth
// Intelligence module draws around AI draft generation vs. human publish.
import { uploadToSupabaseStorage } from "@/lib/supabase";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export type MediaValidationResult = { ok: boolean; reason?: string };

export function validateMediaFile(file: { type: string; size: number }, kind: "image" | "video"): MediaValidationResult {
  if (kind === "image") {
    // Instagram's content-publishing API only accepts JPEG for image_url
    // (verified against current Meta documentation).
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
