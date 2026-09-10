import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import { generateLearnings } from "@/lib/social-autopilot/learning-engine";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { AiLearning, SocialAutopilotSettings } from "@/lib/social-autopilot/types";

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const learnings = await supabaseRest<AiLearning[]>(`social_ai_learnings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&order=generated_at.desc&limit=50`);
    return NextResponse.json({ learnings });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

// Manual "refresh learnings now" action. Deterministic by default —
// allowRuntimeAi only ever adds an optional prose polish on top when
// ai_operating_mode is optional_api_ai (see learning-engine.ts).
export async function POST() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const settingsRows = await supabaseRest<SocialAutopilotSettings[]>(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`);
    const settings = settingsRows[0] || null;
    const allowRuntimeAi = settings?.ai_operating_mode === "optional_api_ai";
    const result = await generateLearnings(null, allowRuntimeAi, settings?.ai_provider_preference);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
