import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { DEFAULT_WORKSPACE_ID, type GrowthAutomationRun } from "@/lib/growth-intelligence/types";

export async function GET() {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ runs: [], source: "empty" });

  try {
    const runs = await supabaseRest<GrowthAutomationRun[]>(
      `growth_automation_runs?workspace_id=eq.${DEFAULT_WORKSPACE_ID}&select=*&order=started_at.desc&limit=50`
    );
    return NextResponse.json({ runs, source: "database" });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
