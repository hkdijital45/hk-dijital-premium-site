import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET() {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ briefing: null, source: "empty" });

  try {
    const rows = await supabaseRest<Array<Record<string, unknown>>>("ceo_briefings?select=*&order=briefing_date.desc&limit=1");
    return NextResponse.json({ briefing: rows[0] || null, source: "database" });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
