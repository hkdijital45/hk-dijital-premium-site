import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig } from "@/lib/supabase";
import { regenerateContentItem } from "@/lib/social-autopilot/orchestrator";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  const { id } = await params;
  try {
    const result = await regenerateContentItem(id);
    return NextResponse.json({ item: result.item, qualityScore: result.gateResult.overall_score, passed: result.passedThreshold });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
