import { NextResponse } from "next/server";
import { requireMobileStaffSession } from "@/lib/mobile-auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const FIELDS = "id,name,sector,city,website,lifecycle_stage,created_at";

export async function GET(request: Request) {
  const session = requireMobileStaffSession(request);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const url = new URL(request.url);
  const search = url.searchParams.get("q")?.trim();

  try {
    const filters = [`select=${FIELDS}`, "deleted_at=is.null", "order=name.asc", "limit=200"];
    if (search) filters.push(`name=ilike.*${encodeURIComponent(search)}*`);
    const companies = await supabaseRest<Array<Record<string, unknown>>>(`companies?${filters.join("&")}`);
    return NextResponse.json({ companies });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
