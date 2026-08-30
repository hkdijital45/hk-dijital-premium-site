import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const statuses = ["draft", "awaiting_approval", "approved", "live", "archived"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const status = String(body.status || "");
  if (!statuses.includes(status)) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });

  try {
    const updated = await supabaseRest<Array<Record<string, unknown>>>(`creative_assets?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    return NextResponse.json({ asset: updated[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
