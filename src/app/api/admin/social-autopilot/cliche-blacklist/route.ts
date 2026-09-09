import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { SOCIAL_WORKSPACE_ID } from "@/lib/social-autopilot/types";
import type { SocialClicheEntry } from "@/lib/social-autopilot/types";

export async function GET() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  try {
    const entries = await supabaseRest<SocialClicheEntry[]>(`social_cliche_blacklist?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&order=created_at.desc`);
    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const phrase = String(body.phrase || "").trim();
  if (!phrase) return NextResponse.json({ error: "İfade boş olamaz." }, { status: 400 });
  try {
    const rows = await supabaseRest<SocialClicheEntry[]>("social_cliche_blacklist", {
      method: "POST",
      body: JSON.stringify({ workspace_id: SOCIAL_WORKSPACE_ID, phrase, category: body.category || "general" })
    });
    return NextResponse.json({ entry: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  try {
    const rows = await supabaseRest<SocialClicheEntry[]>(`social_cliche_blacklist?id=eq.${encodeURIComponent(body.id)}&select=*`, {
      method: "PATCH", body: JSON.stringify({ active: Boolean(body.active) })
    });
    return NextResponse.json({ entry: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  try {
    await supabaseRest(`social_cliche_blacklist?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}
