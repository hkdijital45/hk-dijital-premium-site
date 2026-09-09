import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialStrategy } from "@/lib/social-autopilot/types";

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    const [active, history] = await Promise.all([
      supabaseRest<SocialStrategy[]>(`social_strategies?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&status=eq.active&select=*&limit=1`),
      supabaseRest<SocialStrategy[]>(`social_strategies?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&order=period_start.desc&limit=12`)
    ]);
    return NextResponse.json({ active: active[0] || null, history });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
