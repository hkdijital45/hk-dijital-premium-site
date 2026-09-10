import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialBrandProfile, SocialBrandVisualProfile } from "@/lib/social-autopilot/types";

const PROFILE_FIELDS = ["brand_name", "mission", "service_categories", "target_personas", "geography", "tone_guidelines", "forbidden_topics", "visual_style_notes"] as const;
const VISUAL_FIELDS = [
  "logo_url", "logo_position", "watermark_enabled", "color_background", "color_surface", "color_primary", "color_accent",
  "color_foreground", "color_muted", "gradient_from", "gradient_to", "font_family_heading", "font_family_body",
  "font_scale", "line_height_scale", "spacing_scale", "border_radius", "card_style", "cta_style", "chart_palette"
] as const;

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const [profileRows, visualRows] = await Promise.all([
      supabaseRest<SocialBrandProfile[]>(`social_brand_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`),
      supabaseRest<SocialBrandVisualProfile[]>(`social_brand_visual_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`)
    ]);
    return NextResponse.json({ profile: profileRows[0] || null, visualProfile: visualRows[0] || null });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  const profilePatch: Record<string, unknown> = {};
  for (const field of PROFILE_FIELDS) if (field in body) profilePatch[field] = body[field];
  const visualPatch: Record<string, unknown> = {};
  for (const field of VISUAL_FIELDS) if (field in body) visualPatch[field] = body[field];
  if (!Object.keys(profilePatch).length && !Object.keys(visualPatch).length) {
    return NextResponse.json({ error: "Geçerli bir alan gönderilmedi." }, { status: 400 });
  }

  try {
    const [profileRows, visualRows] = await Promise.all([
      Object.keys(profilePatch).length
        ? supabaseRest<SocialBrandProfile[]>(`social_brand_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*`, { method: "PATCH", body: JSON.stringify(profilePatch) })
        : supabaseRest<SocialBrandProfile[]>(`social_brand_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`),
      Object.keys(visualPatch).length
        ? supabaseRest<SocialBrandVisualProfile[]>(`social_brand_visual_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*`, { method: "PATCH", body: JSON.stringify(visualPatch) })
        : supabaseRest<SocialBrandVisualProfile[]>(`social_brand_visual_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`)
    ]);
    return NextResponse.json({ profile: profileRows[0] || null, visualProfile: visualRows[0] || null });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
