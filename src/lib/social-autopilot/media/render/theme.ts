import { supabaseRest } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "../../types";
import type { SocialBrandVisualProfile } from "../../types";
import {
  FONT_FAMILY_REGULAR, FONT_FAMILY_MEDIUM, FONT_FAMILY_SEMIBOLD, FONT_FAMILY_BOLD, FONT_FAMILY_EXTRABOLD, FONT_FAMILY_BLACK
} from "./fonts.ts";

export async function getVisualBrandProfile(): Promise<SocialBrandVisualProfile> {
  const rows = await supabaseRest<SocialBrandVisualProfile[]>(`social_brand_visual_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`);
  if (!rows[0]) throw new Error("social_brand_visual_profile satırı bulunamadı — Social Autopilot migration'ı uygulanmamış olabilir.");
  return rows[0];
}

// The DB stores human-readable labels ("Inter ExtraBold") so the Autopilot
// Ayarları UI stays readable; this maps them to the actual registered
// canvas font-family aliases (see fonts.ts). Unrecognized labels fall back
// to a sane default rather than crashing a render.
const FONT_LABEL_MAP: Record<string, string> = {
  "Inter": FONT_FAMILY_REGULAR,
  "Inter Regular": FONT_FAMILY_REGULAR,
  "Inter Medium": FONT_FAMILY_MEDIUM,
  "Inter SemiBold": FONT_FAMILY_SEMIBOLD,
  "Inter Bold": FONT_FAMILY_BOLD,
  "Inter ExtraBold": FONT_FAMILY_EXTRABOLD,
  "Inter Black": FONT_FAMILY_BLACK
};

export function resolveFontFamily(label: string): string {
  return FONT_LABEL_MAP[label] || FONT_FAMILY_REGULAR;
}

export type ResolvedTheme = SocialBrandVisualProfile & { headingFontFamily: string; bodyFontFamily: string };

export async function getResolvedTheme(): Promise<ResolvedTheme> {
  const profile = await getVisualBrandProfile();
  return { ...profile, headingFontFamily: resolveFontFamily(profile.font_family_heading), bodyFontFamily: resolveFontFamily(profile.font_family_body) };
}
