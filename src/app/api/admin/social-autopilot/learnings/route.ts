import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialAiLearning } from "@/lib/social-autopilot/types";

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    const learnings = await supabaseRest<SocialAiLearning[]>(`social_ai_learnings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&order=generated_at.desc&limit=30`);
    return NextResponse.json({ learnings });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
