import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { getActiveStrategy, getMostRecentStrategy } from "@/lib/social-autopilot/strategy-engine";

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const active = await getActiveStrategy();
    const mostRecent = active ? active : await getMostRecentStrategy();
    return NextResponse.json({ strategy: active, mostRecentStrategy: mostRecent });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
