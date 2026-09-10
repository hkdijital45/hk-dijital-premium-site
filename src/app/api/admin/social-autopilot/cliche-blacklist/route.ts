import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { ClicheEntry } from "@/lib/social-autopilot/types";

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  try {
    const entries = await supabaseRest<ClicheEntry[]>(`social_cliche_blacklist?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&order=created_at.desc`);
    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.phrase !== "string" || !body.phrase.trim()) return NextResponse.json({ error: "phrase zorunludur." }, { status: 400 });
  try {
    const rows = await supabaseRest<ClicheEntry[]>("social_cliche_blacklist", {
      method: "POST",
      body: JSON.stringify({ workspace_id: SOCIAL_WORKSPACE_ID, phrase: body.phrase.trim().toLowerCase(), category: body.category || "general" })
    });
    return NextResponse.json({ entry: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== "string") return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
  try {
    const rows = await supabaseRest<ClicheEntry[]>(`social_cliche_blacklist?id=eq.${encodeURIComponent(body.id)}&select=*`, {
      method: "PATCH", body: JSON.stringify({ active: Boolean(body.active) })
    });
    return NextResponse.json({ entry: rows[0] || null });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
