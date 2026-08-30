import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET(request: Request) {
  const session = await requireModuleAccess("ad-optimization");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ suggestions: [], source: "empty" });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const filters = ["select=*,companies(name)", "order=generated_at.desc", "limit=200"];
  if (status) filters.push(`status=eq.${status}`);

  try {
    const suggestions = await supabaseRest<Array<Record<string, unknown>>>(`ad_optimization_suggestions?${filters.join("&")}`);
    return NextResponse.json({ suggestions, source: "database" });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
