import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, getSafeSupabaseError } from "@/lib/supabase";
import { getWeeklyCapacityBoard } from "@/lib/capacity-planner";

export async function GET(request: Request) {
  const session = await requireModuleAccess("customer-risk");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ board: [] });

  const weekStart = new URL(request.url).searchParams.get("weekStart") || undefined;
  try {
    return NextResponse.json({ board: await getWeeklyCapacityBoard(weekStart) });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
