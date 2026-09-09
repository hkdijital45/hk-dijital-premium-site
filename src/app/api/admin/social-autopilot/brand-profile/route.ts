import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialBrandProfile } from "@/lib/social-autopilot/types";

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    const rows = await supabaseRest<SocialBrandProfile[]>(`social_brand_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`);
    if (!rows[0]) return NextResponse.json({ error: "Marka profili bulunamadı." }, { status: 404 });
    return NextResponse.json({ brand: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}

const EDITABLE_FIELDS = [
  "brand_name", "mission", "service_categories", "target_personas", "geography", "tone_guidelines", "forbidden_topics", "visual_style_notes"
] as const;

export async function PUT(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) if (field in body) patch[field] = body[field];

  try {
    const rows = await supabaseRest<SocialBrandProfile[]>(`social_brand_profile?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*`, {
      method: "PATCH", body: JSON.stringify(patch)
    });
    return NextResponse.json({ brand: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
