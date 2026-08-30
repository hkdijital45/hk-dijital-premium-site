import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET() {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ drafts: [] });

  try {
    const drafts = await supabaseRest<Array<Record<string, unknown>>>("outreach_drafts?select=*,leads(company)&order=created_at.desc&limit=200");
    return NextResponse.json({ drafts });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id || "");
  const status = String(body.status || "");
  if (!id || !["approved", "rejected", "opted_out"].includes(status)) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  try {
    const updated = await supabaseRest<Array<Record<string, unknown>>>(`outreach_drafts?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, approved_by: status === "approved" ? session.profileId || null : null, approved_at: status === "approved" ? new Date().toISOString() : null })
    });
    return NextResponse.json({ draft: updated[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
