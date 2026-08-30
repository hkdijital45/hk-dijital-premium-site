import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET() {
  const session = await requireModuleAccess("seo-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ jobs: [], source: "empty" });

  try {
    const jobs = await supabaseRest<Array<Record<string, unknown>>>("seo_autopilot_jobs?select=*&order=triggered_at.desc&limit=200");
    return NextResponse.json({ jobs, source: "database" });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
