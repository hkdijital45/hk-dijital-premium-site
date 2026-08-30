import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { upsertCapacityProfile } from "@/lib/capacity-planner";

export async function GET() {
  const session = await requireModuleAccess("customer-risk");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ users: [], profiles: [] });

  try {
    const [users, profiles] = await Promise.all([
      supabaseRest<Array<{ id: string; full_name: string }>>("users?is_active=eq.true&select=id,full_name&limit=200"),
      supabaseRest<Array<Record<string, unknown>>>("user_capacity_profiles?select=*")
    ]);
    return NextResponse.json({ users, profiles });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("customer-risk");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const userId = String(body.userId || "");
  const weeklyHours = Math.max(1, Math.min(80, Number(body.weeklyHours) || 40));
  const skills = Array.isArray(body.skills) ? body.skills.map((item) => String(item)).slice(0, 20) : [];
  if (!userId) return NextResponse.json({ error: "userId zorunludur." }, { status: 400 });

  try {
    await upsertCapacityProfile(userId, weeklyHours, skills);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
